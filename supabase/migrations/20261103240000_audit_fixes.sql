-- Spine: fixes from the pre-launch audit.

-- 1. A read-along survives its host deleting their account.
alter table public.read_alongs alter column created_by drop not null;
alter table public.read_alongs drop constraint read_alongs_created_by_fkey;
alter table public.read_alongs add constraint read_alongs_created_by_fkey
  foreign key (created_by) references auth.users (id) on delete set null;

-- 2. No new invites once the verdict is out.
create or replace function public._invite(ra uuid, inviter uuid, users uuid[])
returns integer language plpgsql security definer set search_path = public as $$
declare
  n integer := 0;
  u uuid;
  total integer;
begin
  -- Finished read-alongs are closed: start the next book instead.
  if exists (select 1 from public.read_alongs r where r.id = ra and r.revealed_at is not null) then
    return 0;
  end if;
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

-- 3. After the reveal, scores stay visible (even if someone joins later).
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
  select r.book_id, r.revealed_at is not null into book, everyone_done from public.read_alongs r where r.id = p_id;
  -- Once revealed, scores stay visible even if someone joins or re-ranks later.
  if not everyone_done then
  select bool_and(e.status = 'ranked') into everyone_done
    from public.read_along_members m
    left join public.shelf_entries e on e.user_id = m.user_id and e.book_id = book
    where m.read_along_id = p_id and m.state = 'joined';
  end if;
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

-- 4. Importing old reviews that happen to contain "@name" doesn't notify anyone.
create or replace function public.notify_mentions()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  body text;
  old_body text;
  author uuid;
  owner uuid;
  t_type text;
  t_id uuid;
begin
  if tg_table_name = 'comments' then
    body := new.body; author := new.user_id; owner := new.target_owner; t_type := new.target_type; t_id := new.target_id;
  elsif tg_table_name = 'shelf_entries' then
    -- Reviews brought in from Goodreads or StoryGraph aren't new posts.
    if tg_op = 'INSERT' and new.source in ('goodreads', 'storygraph') then
      return new;
    end if;
    body := new.note; author := new.user_id; owner := new.user_id; t_type := 'entry'; t_id := new.id;
    if tg_op = 'UPDATE' then old_body := old.note; end if;
  else
    body := new.note; author := new.user_id; owner := new.user_id; t_type := 'checkin'; t_id := new.id;
    if tg_op = 'UPDATE' then old_body := old.note; end if;
  end if;
  if body is null or position('@' in body) = 0 then
    return new;
  end if;
  -- Posts on a private shelf can't be seen by the person mentioned.
  if coalesce((select p.is_private from public.profiles p where p.id = owner), false) then
    return new;
  end if;
  insert into public.notifications (user_id, actor_id, kind, target_type, target_id)
  select p.id, author, 'mention', t_type, t_id
  from public.profiles p
  where p.username = any (public.mentioned_usernames(body))
    and not (p.username = any (public.mentioned_usernames(old_body)))
    and p.id <> author
    and p.id <> owner -- the post's owner already gets a comment notification
    and not public.is_blocked(p.id, author);
  return new;
end;
$$;
