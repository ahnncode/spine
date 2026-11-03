-- Spine: @mentions in thoughts, check-ins and comments, and a once-a-day poke.

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('reaction', 'comment', 'follow', 'badge', 'mention', 'poke'));

-- Mentions -----------------------------------------------------------------
-- Usernames written as @name in a piece of text (lowercased, at most 10).
create or replace function public.mentioned_usernames(body text)
returns text[] language sql immutable as $$
  select coalesce(array_agg(distinct s.name), '{}')
  from (
    select lower(x[1]) as name
    from regexp_matches(coalesce(body, ''), '(?:^|[^a-zA-Z0-9_@])@([a-zA-Z0-9_]{3,20})', 'g') as x
    limit 10
  ) s;
$$;

-- Notify readers named in new text. On edits, only names that weren't there before.
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
revoke execute on function public.notify_mentions() from public, anon, authenticated;

create trigger comments_mentions after insert on public.comments
  for each row execute function public.notify_mentions();
create trigger entries_mentions after insert or update of note on public.shelf_entries
  for each row execute function public.notify_mentions();
create trigger checkins_mentions after insert or update of note on public.reading_checkins
  for each row execute function public.notify_mentions();

-- Pokes --------------------------------------------------------------------
create table public.pokes (
  from_id uuid not null references auth.users (id) on delete cascade,
  to_id uuid not null references auth.users (id) on delete cascade,
  day date not null default current_date,
  created_at timestamptz not null default now(),
  primary key (from_id, to_id, day),
  check (from_id <> to_id)
);
alter table public.pokes enable row level security;
create policy "readers see pokes they sent" on public.pokes
  for select to authenticated using (from_id = auth.uid());
-- Sending goes through poke() below.

-- Poke someone you follow, once a day. Returns 'ok', 'already' or 'not_allowed'.
create or replace function public.poke(p_user uuid)
returns text language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or p_user = auth.uid()
     or not exists (select 1 from public.follows f where f.follower_id = auth.uid() and f.followee_id = p_user)
     or public.is_blocked(auth.uid(), p_user) then
    return 'not_allowed';
  end if;
  insert into public.pokes (from_id, to_id) values (auth.uid(), p_user) on conflict do nothing;
  if not found then
    return 'already';
  end if;
  insert into public.notifications (user_id, actor_id, kind) values (p_user, auth.uid(), 'poke');
  return 'ok';
end;
$$;
revoke execute on function public.poke(uuid) from public, anon;
grant execute on function public.poke(uuid) to authenticated;
