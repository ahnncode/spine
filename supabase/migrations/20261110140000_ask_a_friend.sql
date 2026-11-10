-- readread: Ask a friend. Pick 2 to 4 books from your want-to-read and let
-- the people who follow you vote on what you read next.
--
-- One open poll at a time: asking again closes the old one. A poll closes
-- after 48 hours, or as soon as you start one of its books (a trigger below
-- records which one you went with).

create table public.pick_polls (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  book_ids uuid[] not null check (cardinality(book_ids) between 2 and 4),
  note text check (note is null or char_length(btrim(note)) between 1 and 140),
  created_at timestamptz not null default now(),
  closes_at timestamptz not null default now() + interval '48 hours',
  closed_at timestamptz,
  chosen_book uuid references public.books (id) on delete set null
);
create index pick_polls_user on public.pick_polls (user_id, created_at desc);
create index pick_polls_open on public.pick_polls (user_id) where closed_at is null;

create table public.pick_votes (
  poll_id uuid not null references public.pick_polls (id) on delete cascade,
  voter_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  book_id uuid not null references public.books (id) on delete cascade,
  reason text check (reason is null or char_length(btrim(reason)) between 1 and 140),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (poll_id, voter_id)
);
create index pick_votes_poll on public.pick_votes (poll_id);

-- Open: not closed and not past its 48 hours.
create or replace function public._poll_open(p public.pick_polls)
returns boolean language sql stable as $$
  select p.closed_at is null and p.closes_at > now()
$$;

-- Who can see a poll: whoever asked, and readers who follow them (not across a block).
create or replace function public._can_see_poll(p_poll uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.pick_polls p
    where p.id = p_poll
      and (p.user_id = auth.uid()
        or (exists (select 1 from public.follows f where f.follower_id = auth.uid() and f.followee_id = p.user_id)
            and not public.is_blocked(p.user_id, auth.uid())))
  )
$$;
revoke execute on function public._can_see_poll(uuid) from anon;

-- Whether you've voted on a poll (outside RLS, so the votes policy can use it).
create or replace function public._voted_on(p_poll uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.pick_votes v where v.poll_id = p_poll and v.voter_id = auth.uid())
$$;
revoke execute on function public._voted_on(uuid) from anon;

alter table public.pick_polls enable row level security;
alter table public.pick_votes enable row level security;

create policy "polls are seen by the asker and their followers"
  on public.pick_polls for select to authenticated using (public._can_see_poll(id));
-- Polls are created and closed through ask_friends() and close_my_poll() below.

create policy "votes are seen by the asker and by readers who voted"
  on public.pick_votes for select to authenticated using (
    voter_id = auth.uid()
    or exists (select 1 from public.pick_polls p where p.id = poll_id and p.user_id = auth.uid())
    or public._voted_on(poll_id)
  );

create policy "followers vote on open polls"
  on public.pick_votes for insert to authenticated with check (
    voter_id = auth.uid()
    and public._can_see_poll(poll_id)
    and exists (
      select 1 from public.pick_polls p
      where p.id = poll_id and p.user_id <> auth.uid() and public._poll_open(p) and book_id = any (p.book_ids)
    )
  );

create policy "voters change their vote while it's open"
  on public.pick_votes for update to authenticated
  using (voter_id = auth.uid())
  with check (
    voter_id = auth.uid()
    and exists (select 1 from public.pick_polls p where p.id = poll_id and public._poll_open(p) and book_id = any (p.book_ids))
  );

create policy "voters take back their vote"
  on public.pick_votes for delete to authenticated using (voter_id = auth.uid());

-- Notifications get a kind for this: detail 'asked' (to followers),
-- 'voted' (to the asker) and 'called' (to voters whose pick you went with).
alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('reaction', 'comment', 'follow', 'badge', 'mention', 'poke', 'read_along', 'picks', 'ask'));

-- Ask your followers. Closes any poll you still have open.
create or replace function public.ask_friends(p_books uuid[], p_note text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  v_books uuid[];
  poll uuid;
begin
  if uid is null then
    raise exception 'Sign in first' using errcode = '42501';
  end if;
  select array_agg(distinct b) into v_books from unnest(p_books) b;
  if cardinality(v_books) not between 2 and 4 then
    raise exception 'Pick 2 to 4 different books' using errcode = '22023';
  end if;
  if (select count(*) from public.books where id = any (v_books)) <> cardinality(v_books) then
    raise exception 'One of those books doesn''t exist' using errcode = '22023';
  end if;

  update public.pick_polls set closed_at = now() where user_id = uid and closed_at is null;

  insert into public.pick_polls (user_id, book_ids, note)
  values (uid, v_books, nullif(btrim(coalesce(p_note, '')), ''))
  returning id into poll;

  insert into public.notifications (user_id, actor_id, kind, detail, target_type, target_id)
  select f.follower_id, uid, 'ask', 'asked', 'pick_poll', poll
  from public.follows f
  where f.followee_id = uid and not public.is_blocked(uid, f.follower_id);

  return poll;
end;
$$;
revoke execute on function public.ask_friends(uuid[], text) from public, anon;
grant execute on function public.ask_friends(uuid[], text) to authenticated;

-- Close your open poll early, optionally saying which book you went with.
create or replace function public.close_my_poll(p_poll uuid, p_chosen uuid default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.pick_polls
     set closed_at = coalesce(closed_at, now()),
         chosen_book = case when p_chosen = any (book_ids) then p_chosen else chosen_book end
   where id = p_poll and user_id = auth.uid();
end;
$$;
revoke execute on function public.close_my_poll(uuid, uuid) from public, anon;
grant execute on function public.close_my_poll(uuid, uuid) to authenticated;

-- Each vote (new or changed) tells the asker, once per voter per poll.
create or replace function public._notify_pick_vote()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  asker uuid;
begin
  select user_id into asker from public.pick_polls where id = new.poll_id;
  if asker is not null and asker <> new.voter_id
     and not exists (select 1 from public.notifications n
                      where n.user_id = asker and n.actor_id = new.voter_id and n.kind = 'ask'
                        and n.detail = 'voted' and n.target_id = new.poll_id) then
    insert into public.notifications (user_id, actor_id, kind, detail, target_type, target_id)
    values (asker, new.voter_id, 'ask', 'voted', 'pick_poll', new.poll_id);
  end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke execute on function public._notify_pick_vote() from public, anon, authenticated;
create trigger pick_votes_notify before insert or update on public.pick_votes
  for each row execute function public._notify_pick_vote();

-- Starting a book from your open poll closes it with that book as the pick,
-- and tells the friends who voted for it.
create or replace function public._close_poll_on_start()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  poll public.pick_polls;
begin
  if new.status <> 'reading' or (tg_op = 'UPDATE' and old.status = 'reading') then
    return new;
  end if;
  select * into poll from public.pick_polls p
   where p.user_id = new.user_id and p.closed_at is null and new.book_id = any (p.book_ids)
   order by p.created_at desc limit 1;
  if poll.id is null then
    return new;
  end if;
  update public.pick_polls set closed_at = now(), chosen_book = new.book_id where id = poll.id;
  insert into public.notifications (user_id, actor_id, kind, detail, target_type, target_id)
  select v.voter_id, new.user_id, 'ask', 'called', 'pick_poll', poll.id
  from public.pick_votes v where v.poll_id = poll.id and v.book_id = new.book_id;
  return new;
end;
$$;
revoke execute on function public._close_poll_on_start() from public, anon, authenticated;
create trigger shelf_entries_close_poll after insert or update of status on public.shelf_entries
  for each row execute function public._close_poll_on_start();
