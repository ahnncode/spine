-- Spine: read-alongs. A few friends read one book together: shared progress,
-- a discussion that hides what you haven't reached yet, and a verdict reveal.

create table public.read_alongs (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books (id) on delete cascade,
  created_by uuid not null references auth.users (id) on delete cascade,
  target_date date,
  -- The read-along this group did before (book clubs grow one book at a time).
  previous_id uuid references public.read_alongs (id) on delete set null,
  revealed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.read_along_members (
  read_along_id uuid not null references public.read_alongs (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  state text not null default 'invited' check (state in ('invited', 'joined', 'declined', 'left')),
  invited_by uuid references auth.users (id) on delete set null,
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (read_along_id, user_id)
);
create index read_along_members_user on public.read_along_members (user_id);

create table public.read_along_messages (
  id uuid primary key default gen_random_uuid(),
  read_along_id uuid not null references public.read_alongs (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  -- How far the writer was when posting; others see it once they've caught up.
  progress_pct smallint not null default 0 check (progress_pct between 0 and 100),
  created_at timestamptz not null default now()
);
create index read_along_messages_ra on public.read_along_messages (read_along_id, created_at);

-- Whether a reader is in a read-along (invited counts, so invites can be previewed).
create or replace function public.in_read_along(ra uuid, uid uuid, joined_only boolean default false)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.read_along_members m
    where m.read_along_id = ra and m.user_id = uid
      and (m.state = 'joined' or (not joined_only and m.state = 'invited'))
  );
$$;
revoke execute on function public.in_read_along(uuid, uuid, boolean) from public, anon;

alter table public.read_alongs enable row level security;
alter table public.read_along_members enable row level security;
alter table public.read_along_messages enable row level security;

create policy "members see their read-alongs" on public.read_alongs
  for select to authenticated using (public.in_read_along(id, auth.uid()));
create policy "members see who's in" on public.read_along_members
  for select to authenticated using (public.in_read_along(read_along_id, auth.uid()));
create policy "joined members read the discussion" on public.read_along_messages
  for select to authenticated using (public.in_read_along(read_along_id, auth.uid(), true));
create policy "joined members post" on public.read_along_messages
  for insert to authenticated with check (user_id = auth.uid() and public.in_read_along(read_along_id, auth.uid(), true));
create policy "writers delete their messages" on public.read_along_messages
  for delete to authenticated using (user_id = auth.uid());
-- Everything else goes through the functions below.

-- Notifications learn about read-alongs.
alter table public.notifications add column detail text;
alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('reaction', 'comment', 'follow', 'badge', 'mention', 'poke', 'read_along'));

-- Put a book in someone's Reading now (unless they've already ranked it).
create or replace function public._start_reading(uid uuid, book uuid)
returns void language sql security definer set search_path = public as $$
  insert into public.shelf_entries (user_id, book_id, status, started_on)
  values (uid, book, 'reading', current_date)
  on conflict (user_id, book_id) do update
    set status = 'reading', started_on = coalesce(public.shelf_entries.started_on, current_date)
    where public.shelf_entries.status in ('want', 'unsorted');
$$;
revoke execute on function public._start_reading(uuid, uuid) from public, anon, authenticated;

-- Invite people you follow (up to 8 readers in all).
create or replace function public._invite(ra uuid, inviter uuid, users uuid[])
returns integer language plpgsql security definer set search_path = public as $$
declare
  n integer := 0;
  u uuid;
  total integer;
begin
  foreach u in array coalesce(users, '{}') loop
    select count(*) into total from public.read_along_members m where m.read_along_id = ra and m.state in ('invited', 'joined');
    exit when total >= 8;
    continue when u = inviter
      or not exists (select 1 from public.follows f where f.follower_id = inviter and f.followee_id = u)
      or public.is_blocked(inviter, u);
    insert into public.read_along_members (read_along_id, user_id, invited_by)
    values (ra, u, inviter)
    on conflict (read_along_id, user_id) do update set state = 'invited', invited_by = inviter
      where public.read_along_members.state in ('declined', 'left');
    if found then
      n := n + 1;
      insert into public.notifications (user_id, actor_id, kind, detail, target_type, target_id)
      values (u, inviter, 'read_along', 'invite', 'read_along', ra);
    end if;
  end loop;
  return n;
end;
$$;
revoke execute on function public._invite(uuid, uuid, uuid[]) from public, anon, authenticated;

create or replace function public.create_read_along(p_book uuid, p_users uuid[], p_target date default null, p_previous uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  ra uuid;
begin
  if auth.uid() is null or not exists (select 1 from public.books where id = p_book) then
    raise exception 'not allowed';
  end if;
  if p_previous is not null and not public.in_read_along(p_previous, auth.uid(), true) then
    p_previous := null;
  end if;
  insert into public.read_alongs (book_id, created_by, target_date, previous_id)
  values (p_book, auth.uid(), case when p_target >= current_date then p_target end, p_previous)
  returning id into ra;
  insert into public.read_along_members (read_along_id, user_id, state, joined_at)
  values (ra, auth.uid(), 'joined', now());
  perform public._start_reading(auth.uid(), p_book);
  perform public._invite(ra, auth.uid(), p_users[1:7]);
  return ra;
end;
$$;

create or replace function public.invite_to_read_along(p_id uuid, p_users uuid[])
returns integer language plpgsql security definer set search_path = public as $$
begin
  if not public.in_read_along(p_id, auth.uid(), true) then
    return 0;
  end if;
  return public._invite(p_id, auth.uid(), p_users);
end;
$$;

-- Join or decline an invite; or leave.
create or replace function public.respond_read_along(p_id uuid, p_join boolean)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  book uuid;
  host uuid;
begin
  update public.read_along_members m
    set state = case when p_join then 'joined' else 'declined' end,
        joined_at = case when p_join then now() else m.joined_at end
    where m.read_along_id = p_id and m.user_id = auth.uid() and m.state = 'invited';
  if not found then
    return false;
  end if;
  if p_join then
    select r.book_id, r.created_by into book, host from public.read_alongs r where r.id = p_id;
    perform public._start_reading(auth.uid(), book);
    insert into public.notifications (user_id, actor_id, kind, detail, target_type, target_id)
    select m.user_id, auth.uid(), 'read_along', 'joined', 'read_along', p_id
    from public.read_along_members m
    where m.read_along_id = p_id and m.state = 'joined' and m.user_id <> auth.uid();
  end if;
  return true;
end;
$$;

create or replace function public.leave_read_along(p_id uuid)
returns boolean language sql security definer set search_path = public as $$
  update public.read_along_members set state = 'left'
  where read_along_id = p_id and user_id = auth.uid() and state = 'joined'
  returning true;
$$;

-- Everyone's progress on the book. Scores stay hidden until everyone who
-- joined has ranked it (your own always shows).
create or replace function public.read_along_progress(p_id uuid)
returns table (user_id uuid, state text, shelf_status text, progress_pct smallint, last_checkin_on date, score numeric, ranked boolean)
language plpgsql stable security definer set search_path = public as $$
declare
  book uuid;
  everyone_done boolean;
begin
  if not public.in_read_along(p_id, auth.uid()) then
    return;
  end if;
  select r.book_id into book from public.read_alongs r where r.id = p_id;
  select bool_and(e.status = 'ranked') into everyone_done
    from public.read_along_members m
    left join public.shelf_entries e on e.user_id = m.user_id and e.book_id = book
    where m.read_along_id = p_id and m.state = 'joined';
  return query
  select m.user_id, m.state, e.status, e.progress_pct, e.last_checkin_on,
         case when coalesce(everyone_done, false) or m.user_id = auth.uid() then r.score end,
         coalesce(e.status = 'ranked', false)
  from public.read_along_members m
  left join public.shelf_entries e on e.user_id = m.user_id and e.book_id = book
  left join public.ranked_entries r on r.user_id = m.user_id and r.book_id = book
  where m.read_along_id = p_id and m.state in ('invited', 'joined')
  order by m.state desc, m.joined_at nulls last;
end;
$$;
revoke execute on function public.read_along_progress(uuid) from public, anon;
grant execute on function public.read_along_progress(uuid) to authenticated;

-- Messages remember how far along the writer was, and ping the others.
create or replace function public.on_read_along_message()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' and tg_when = 'BEFORE' then
    select case when e.status = 'ranked' then 100 else coalesce(e.progress_pct, 0) end into new.progress_pct
      from public.read_alongs r
      left join public.shelf_entries e on e.book_id = r.book_id and e.user_id = new.user_id
      where r.id = new.read_along_id;
    new.progress_pct := coalesce(new.progress_pct, 0);
    return new;
  end if;
  insert into public.notifications (user_id, actor_id, kind, detail, target_type, target_id)
  select m.user_id, new.user_id, 'read_along', 'message', 'read_along', new.read_along_id
  from public.read_along_members m
  where m.read_along_id = new.read_along_id and m.state = 'joined' and m.user_id <> new.user_id
    -- One unread message ping at a time per read-along.
    and not exists (
      select 1 from public.notifications n
      where n.user_id = m.user_id and n.kind = 'read_along' and n.detail = 'message'
        and n.target_id = new.read_along_id and n.read_at is null
    );
  return new;
end;
$$;
revoke execute on function public.on_read_along_message() from public, anon, authenticated;
create trigger read_along_messages_progress before insert on public.read_along_messages
  for each row execute function public.on_read_along_message();
create trigger read_along_messages_notify after insert on public.read_along_messages
  for each row execute function public.on_read_along_message();

-- When the last member ranks the book, reveal the verdict to everyone.
create or replace function public.check_read_along_verdicts()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  ra uuid;
begin
  if new.status <> 'ranked' then
    return new;
  end if;
  for ra in
    select r.id from public.read_alongs r
    join public.read_along_members me on me.read_along_id = r.id and me.user_id = new.user_id and me.state = 'joined'
    where r.book_id = new.book_id and r.revealed_at is null
  loop
    if (select count(*) from public.read_along_members m where m.read_along_id = ra and m.state = 'joined') >= 2
       and not exists (
         select 1 from public.read_along_members m
         left join public.shelf_entries e on e.user_id = m.user_id and e.book_id = new.book_id
         where m.read_along_id = ra and m.state = 'joined' and coalesce(e.status, '') <> 'ranked'
       ) then
      update public.read_alongs set revealed_at = now() where id = ra;
      insert into public.notifications (user_id, actor_id, kind, detail, target_type, target_id)
      select m.user_id, new.user_id, 'read_along', 'verdict', 'read_along', ra
      from public.read_along_members m where m.read_along_id = ra and m.state = 'joined';
    end if;
  end loop;
  return new;
end;
$$;
revoke execute on function public.check_read_along_verdicts() from public, anon, authenticated;
create trigger shelf_entries_read_along_verdict after insert or update of status on public.shelf_entries
  for each row execute function public.check_read_along_verdicts();

-- Read-alongs friends started or finished, for the feed. Only groups where
-- nobody is private or blocked with you, and only the start and the verdict.
create or replace function public.feed_read_alongs(p_days integer default 60)
returns table (id uuid, book_id uuid, members uuid[], created_at timestamptz, revealed_at timestamptz)
language sql stable security definer set search_path = public as $$
  select r.id, r.book_id, array_agg(m.user_id order by m.joined_at), r.created_at, r.revealed_at
  from public.read_alongs r
  join public.read_along_members m on m.read_along_id = r.id and m.state = 'joined'
  where greatest(r.created_at, coalesce(r.revealed_at, r.created_at)) > now() - make_interval(days => least(p_days, 365))
  group by r.id
  having count(*) >= 2
    and bool_or(m.user_id = auth.uid() or exists (select 1 from public.follows f where f.follower_id = auth.uid() and f.followee_id = m.user_id))
    and bool_and(coalesce((select not p.is_private from public.profiles p where p.id = m.user_id), true) or m.user_id = auth.uid())
    and not bool_or(public.is_blocked(m.user_id, auth.uid()));
$$;

revoke execute on function public.create_read_along(uuid, uuid[], date, uuid) from public, anon;
revoke execute on function public.invite_to_read_along(uuid, uuid[]) from public, anon;
revoke execute on function public.respond_read_along(uuid, boolean) from public, anon;
revoke execute on function public.leave_read_along(uuid) from public, anon;
revoke execute on function public.feed_read_alongs(integer) from public, anon;
grant execute on function public.create_read_along(uuid, uuid[], date, uuid) to authenticated;
grant execute on function public.invite_to_read_along(uuid, uuid[]) to authenticated;
grant execute on function public.respond_read_along(uuid, boolean) to authenticated;
grant execute on function public.leave_read_along(uuid) to authenticated;
grant execute on function public.feed_read_alongs(integer) to authenticated;

-- New badge: Book Club, for finishing a read-along.
create or replace function public._award_badges(uid uuid, announce boolean)
returns table (badge_key text, progress numeric, goal numeric, earned timestamptz, fresh boolean)
language plpgsql security definer set search_path = public as $$
declare
  had_any boolean;
  n_ranked int; n_want int; imported boolean; n_pages numeric; max_pages int;
  n_genres int; n_centuries int; old_soul boolean; hot_press boolean; n_authors int;
  n_critic int; best_weeks int; best_days int; goal_hit boolean; every_month boolean;
  n_h2h int; hot_take boolean; twin boolean; n_following int; n_comments int;
  n_referrals int; early boolean; n_clubs int;
begin
  if uid is null then
    return;
  end if;
  select exists (select 1 from public.badge_awards a where a.user_id = uid) into had_any;

  select count(*) into n_ranked from public.shelf_entries e where e.user_id = uid and e.status = 'ranked';
  select count(*) into n_want from public.shelf_entries e where e.user_id = uid and e.status = 'want';
  select exists (select 1 from public.shelf_entries e where e.user_id = uid and e.source in ('goodreads', 'storygraph')) into imported;

  select coalesce(sum(b.pages), 0), coalesce(max(b.pages), 0),
         count(distinct floor(b.year / 100.0)) filter (where b.year is not null),
         coalesce(bool_or(b.year < 1900), false),
         coalesce(bool_or(b.year = extract(year from e.finished_on)), false),
         count(distinct lower(b.author)) filter (where b.author is not null),
         count(*) filter (where e.note is not null or cardinality(e.tags) > 0)
    into n_pages, max_pages, n_centuries, old_soul, hot_press, n_authors, n_critic
    from public.shelf_entries e join public.books b on b.id = e.book_id
    where e.user_id = uid and e.status = 'ranked';

  select count(distinct g) into n_genres
    from public.shelf_entries e join public.books b on b.id = e.book_id, unnest(b.genres) g
    where e.user_id = uid and e.status = 'ranked';

  -- Longest run of consecutive weeks with a check-in, a start, or an in-app ranking.
  with acts as (
    select c.checked_on as d from public.reading_checkins c where c.user_id = uid
    union all select e.started_on from public.shelf_entries e where e.user_id = uid and e.started_on is not null
    union all select (e.ranked_at at time zone 'UTC')::date from public.shelf_entries e
      where e.user_id = uid and e.status = 'ranked' and e.source not in ('goodreads', 'storygraph') and e.ranked_at is not null
  ), weeks as (
    select distinct ((d - date '2000-01-03') / 7) as w from acts
  ), runs as (
    select count(*) as len from (select w, w - row_number() over (order by w) as grp from weeks) t group by grp
  )
  select coalesce(max(len), 0) into best_weeks from runs;

  -- Longest run of consecutive days with a check-in.
  with days as (
    select distinct c.checked_on as d from public.reading_checkins c where c.user_id = uid
  ), runs as (
    select count(*) as len from (select d, d - row_number() over (order by d)::int as grp from days) t group by grp
  )
  select coalesce(max(len), 0) into best_days from runs;

  select coalesce(bool_or(cnt >= p.yearly_goal), false) into goal_hit
    from public.profiles p
    left join (
      select extract(year from e.finished_on) as y, count(*) as cnt
      from public.shelf_entries e
      where e.user_id = uid and e.status = 'ranked' and e.finished_on is not null
      group by 1
    ) yr on true
    where p.id = uid and p.yearly_goal is not null;

  select coalesce(bool_or(months = 12), false) into every_month from (
    select extract(year from e.finished_on) as y, count(distinct extract(month from e.finished_on)) as months
    from public.shelf_entries e
    where e.user_id = uid and e.status = 'ranked' and e.finished_on is not null
    group by 1
  ) m;

  select p.head_to_heads, p.created_at < timestamptz '2027-01-01 00:00:00-05'
    into n_h2h, early from public.profiles p where p.id = uid;

  -- A score 3+ points from the community average on a book at least 10 readers ranked.
  select exists (
    select 1
    from public.ranked_entries r
    join (
      select s.book_id, avg(s.score) as a from public._public_scores() s group by s.book_id having count(*) >= 10
    ) c on c.book_id = r.book_id
    where r.user_id = uid and abs(r.score - c.a) >= 3
  ) into hot_take;

  -- Taste matches are computed from the signed-in reader's side, so this one
  -- only updates when you check your own badges.
  if uid = auth.uid() then
    select exists (select 1 from public.similar_readers(500) s where s.match >= 90) into twin;
  else
    twin := false;
  end if;
  select count(*) into n_following from public.follows f where f.follower_id = uid;
  select count(*) into n_comments from public.comments c where c.target_owner = uid and c.user_id <> uid;
  -- Read-alongs finished together (verdict revealed).
  select count(*) into n_clubs from public.read_alongs r
    join public.read_along_members m on m.read_along_id = r.id and m.user_id = uid and m.state = 'joined'
    where r.revealed_at is not null;
  -- Friends who joined with your link and ranked at least 3 books.
  select count(*) into n_referrals from public.profiles p
    where p.referred_by = uid
      and (select count(*) from public.shelf_entries e where e.user_id = p.id and e.status = 'ranked') >= 3;

  return query
  with m(b, v, t) as (
    values
      ('first_chapter',        n_ranked::numeric,                  1::numeric),
      ('moving_in',            imported::int::numeric,             1),
      ('wishlist',             n_want::numeric,                    5),
      ('shelf_starter',        n_ranked::numeric,                  10),
      ('early_adopter',        early::int::numeric,                1),
      ('bookworm',             n_ranked::numeric,                  50),
      ('century',              n_ranked::numeric,                  100),
      ('library_card',         n_ranked::numeric,                  250),
      ('doorstopper',          max_pages::numeric,                 700),
      ('page_turner',          n_pages,                            10000),
      ('long_haul',            n_pages,                            50000),
      ('steady',               best_weeks::numeric,                4),
      ('season_reader',        best_weeks::numeric,                12),
      ('unbroken',             best_weeks::numeric,                52),
      ('daily_pages',          best_days::numeric,                 7),
      ('goal_getter',          goal_hit::int::numeric,             1),
      ('every_month',          every_month::int::numeric,          1),
      ('explorer',             n_genres::numeric,                  5),
      ('full_passport',        n_genres::numeric,                  12),
      ('time_traveler',        n_centuries::numeric,               4),
      ('old_soul',             old_soul::int::numeric,             1),
      ('hot_off_the_press',    hot_press::int::numeric,            1),
      ('many_voices',          n_authors::numeric,                 50),
      ('decisive',             n_h2h::numeric,                     100),
      ('critic',               n_critic::numeric,                  10),
      ('hot_take',             hot_take::int::numeric,             1),
      ('reading_twin',         twin::int::numeric,                 1),
      ('good_company',         n_following::numeric,               10),
      ('conversation_starter', n_comments::numeric,                10),
      ('connector',            n_referrals::numeric,               3),
      ('book_club',            n_clubs::numeric,                   1)
  ),
  newly as (
    insert into public.badge_awards (user_id, badge)
    select uid, m.b from m where m.v >= m.t
    on conflict (user_id, badge) do nothing
    returning public.badge_awards.badge as b, public.badge_awards.earned_at as at
  ),
  announced as (
    insert into public.notifications (user_id, actor_id, kind, badge)
    select uid, uid, 'badge', n.b from newly n where had_any and announce
    returning 1
  )
  select m.b, m.v, m.t, coalesce(n.at, a.earned_at), n.b is not null and had_any and announce
  from m
  left join newly n on n.b = m.b
  left join public.badge_awards a on a.user_id = uid and a.badge = m.b;
end;
$$;
