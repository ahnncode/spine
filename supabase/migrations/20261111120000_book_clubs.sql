-- readread: book clubs.
--
-- A club has members (host, co-hosts, members), an optional reading list,
-- and one current read at a time: a book, start and finish dates, and a
-- weekly plan of chapters (with the host's questions for each week). Each
-- week has a room that opens once you've read that far; members who read the
-- book before can skip ahead to every room.
--
-- Anyone can find a club and see its name, list and current book. Joining is
-- one tap, or needs the club's password; the password is stored salted and
-- hashed and never leaves the database.

-- ---------------------------------------------------------------------------
-- Reading lists (seeded below: Booker Prize winners, and the 2026 longlist)

create table public.reading_lists (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

create table public.reading_list_items (
  list_id uuid not null references public.reading_lists (id) on delete cascade,
  position integer not null,
  year integer,
  title text not null,
  author text not null,
  note text,
  primary key (list_id, position)
);

alter table public.reading_lists enable row level security;
alter table public.reading_list_items enable row level security;
create policy "lists are public" on public.reading_lists for select to authenticated using (true);
create policy "list items are public" on public.reading_list_items for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- Clubs and members

create table public.clubs (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 60),
  description text check (description is null or char_length(description) <= 500),
  color text not null default 'ember' check (color in ('ember', 'cobalt', 'forest', 'plum', 'ink', 'gold', 'teal')),
  list_id uuid references public.reading_lists (id) on delete set null,
  password_salt text,
  password_hash text,
  has_password boolean generated always as (password_hash is not null) stored,
  created_by uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index clubs_name on public.clubs (lower(name));

create table public.club_members (
  club_id uuid not null references public.clubs (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('host', 'cohost', 'member')),
  joined_at timestamptz not null default now(),
  primary key (club_id, user_id)
);
create index club_members_user on public.club_members (user_id);
create unique index club_members_one_host on public.club_members (club_id) where role = 'host';

-- Wrong password tries, for the lockout (5 in 15 minutes).
create table public.club_join_attempts (
  club_id uuid not null references public.clubs (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  at timestamptz not null default now()
);
create index club_join_attempts_recent on public.club_join_attempts (club_id, user_id, at);

create or replace function public._club_role(p_club uuid, p_user uuid default auth.uid())
returns text language sql stable security definer set search_path = public as $$
  select role from public.club_members where club_id = p_club and user_id = p_user
$$;
revoke execute on function public._club_role(uuid, uuid) from anon;

create or replace function public._club_hash(p_salt text, p_password text)
returns text language sql immutable as $$
  select encode(sha256(convert_to(p_salt || ':' || p_password, 'UTF8')), 'hex')
$$;
revoke execute on function public._club_hash(text, text) from public, anon, authenticated;

alter table public.clubs enable row level security;
alter table public.club_members enable row level security;
alter table public.club_join_attempts enable row level security;

-- Clubs are public, minus the password columns (column grants hide them).
revoke all on public.clubs from anon, authenticated;
grant select (id, name, description, color, list_id, has_password, created_by, created_at) on public.clubs to authenticated;
grant delete on public.clubs to authenticated;
create policy "clubs are public" on public.clubs for select to authenticated using (true);
create policy "hosts delete their club" on public.clubs for delete to authenticated using (public._club_role(id) = 'host');

create policy "members are public, except across a block" on public.club_members
  for select to authenticated using (not public.is_blocked(user_id, auth.uid()));
-- Joining, leaving and roles go through the functions below.

-- Start a club; you're its host.
create or replace function public.create_club(p_name text, p_description text default null, p_color text default 'ember', p_list text default null, p_password text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  club uuid;
  salt text := case when nullif(p_password, '') is not null then gen_random_uuid()::text end;
begin
  if uid is null then raise exception 'Sign in first' using errcode = '42501'; end if;
  if nullif(p_password, '') is not null and char_length(p_password) < 4 then
    raise exception 'Use a password of at least 4 characters' using errcode = '22023';
  end if;
  insert into public.clubs (name, description, color, list_id, password_salt, password_hash, created_by)
  values (btrim(p_name), nullif(btrim(coalesce(p_description, '')), ''), coalesce(p_color, 'ember'),
          (select id from public.reading_lists where slug = p_list),
          salt, case when salt is not null then public._club_hash(salt, p_password) end, uid)
  returning id into club;
  insert into public.club_members (club_id, user_id, role) values (club, uid, 'host');
  return club;
end;
$$;
revoke execute on function public.create_club(text, text, text, text, text) from public, anon;
grant execute on function public.create_club(text, text, text, text, text) to authenticated;

-- Edit a club (host or co-host). Pass a password to set or change it; p_clear_password removes it.
create or replace function public.update_club(p_club uuid, p_name text, p_description text, p_color text, p_list text default null, p_password text default null, p_clear_password boolean default false)
returns void language plpgsql security definer set search_path = public as $$
declare
  salt text := case when nullif(p_password, '') is not null then gen_random_uuid()::text end;
begin
  if public._club_role(p_club) not in ('host', 'cohost') then
    raise exception 'Only the host can change the club' using errcode = '42501';
  end if;
  update public.clubs set
    name = btrim(p_name),
    description = nullif(btrim(coalesce(p_description, '')), ''),
    color = coalesce(p_color, color),
    list_id = case when p_list is null then list_id when p_list = '' then null else (select id from public.reading_lists where slug = p_list) end,
    password_salt = case when p_clear_password then null when salt is not null then salt else password_salt end,
    password_hash = case when p_clear_password then null when salt is not null then public._club_hash(salt, p_password) else password_hash end
  where id = p_club;
end;
$$;
revoke execute on function public.update_club(uuid, text, text, text, text, text, boolean) from public, anon;
grant execute on function public.update_club(uuid, text, text, text, text, text, boolean) to authenticated;

-- Join a club, with its password if it has one. Returns 'joined',
-- 'wrong_password' or 'locked' (5 wrong tries in 15 minutes). It returns
-- rather than raising so a wrong try is still recorded.
create or replace function public.join_club(p_club uuid, p_password text default null)
returns text language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  c public.clubs;
begin
  if uid is null then raise exception 'Sign in first' using errcode = '42501'; end if;
  select * into c from public.clubs where id = p_club;
  if c.id is null then raise exception 'That club doesn''t exist' using errcode = '22023'; end if;
  if exists (select 1 from public.club_members where club_id = p_club and user_id = uid) then return 'joined'; end if;
  if exists (select 1 from public.club_members m where m.club_id = p_club and m.role = 'host' and public.is_blocked(m.user_id, uid)) then
    raise exception 'You can''t join this club' using errcode = '42501';
  end if;
  if c.password_hash is not null then
    if (select count(*) from public.club_join_attempts a where a.club_id = p_club and a.user_id = uid and a.at > now() - interval '15 minutes') >= 5 then
      return 'locked';
    end if;
    if p_password is null or public._club_hash(c.password_salt, p_password) <> c.password_hash then
      insert into public.club_join_attempts (club_id, user_id) values (p_club, uid);
      return 'wrong_password';
    end if;
  end if;
  insert into public.club_members (club_id, user_id, role) values (p_club, uid, 'member');
  delete from public.club_join_attempts where club_id = p_club and user_id = uid;
  return 'joined';
end;
$$;
revoke execute on function public.join_club(uuid, text) from public, anon;
grant execute on function public.join_club(uuid, text) to authenticated;

create or replace function public.leave_club(p_club uuid)
returns void language sql security definer set search_path = public as $$
  delete from public.club_members where club_id = p_club and user_id = auth.uid()
$$;
revoke execute on function public.leave_club(uuid) from public, anon;
grant execute on function public.leave_club(uuid) to authenticated;

-- Host makes someone a co-host or a member again.
create or replace function public.set_club_role(p_club uuid, p_user uuid, p_role text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public._club_role(p_club) <> 'host' then raise exception 'Only the host can do that' using errcode = '42501'; end if;
  if p_role not in ('cohost', 'member') then raise exception 'Pick co-host or member' using errcode = '22023'; end if;
  update public.club_members set role = p_role where club_id = p_club and user_id = p_user and role <> 'host';
end;
$$;
revoke execute on function public.set_club_role(uuid, uuid, text) from public, anon;
grant execute on function public.set_club_role(uuid, uuid, text) to authenticated;

-- Host or co-host removes a member (never the host; co-hosts can't remove co-hosts).
create or replace function public.remove_club_member(p_club uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  me text := public._club_role(p_club);
  them text := public._club_role(p_club, p_user);
begin
  if me is null or me = 'member' or them = 'host' or (me = 'cohost' and them = 'cohost') then
    raise exception 'You can''t remove this member' using errcode = '42501';
  end if;
  delete from public.club_members where club_id = p_club and user_id = p_user;
end;
$$;
revoke execute on function public.remove_club_member(uuid, uuid) from public, anon;
grant execute on function public.remove_club_member(uuid, uuid) to authenticated;

-- The host leaving hands the club on: to a co-host, else the longest-standing
-- member. Nobody left: the club goes.
create or replace function public._club_handoff()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  heir uuid;
begin
  if old.role <> 'host' then return old; end if;
  select user_id into heir from public.club_members
   where club_id = old.club_id and user_id <> old.user_id
   order by (role = 'cohost') desc, joined_at asc limit 1;
  if heir is null then
    delete from public.clubs where id = old.club_id;
  else
    update public.club_members set role = 'host' where club_id = old.club_id and user_id = heir;
  end if;
  return old;
end;
$$;
revoke execute on function public._club_handoff() from public, anon, authenticated;
create trigger club_members_handoff after delete on public.club_members
  for each row execute function public._club_handoff();

-- ---------------------------------------------------------------------------
-- Reads: the book a club is reading, its dates and weekly plan

create table public.club_reads (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete cascade,
  book_id uuid not null references public.books (id) on delete cascade,
  list_position integer,
  starts_on date not null,
  ends_on date not null check (ends_on >= starts_on),
  -- [{"through": 6, "due": "2026-12-13", "questions": ["…"]}, …], one per week
  plan jsonb not null default '[]'::jsonb check (jsonb_typeof(plan) = 'array'),
  finished_at timestamptz,
  created_at timestamptz not null default now()
);
create index club_reads_club on public.club_reads (club_id, created_at desc);
create unique index club_reads_one_current on public.club_reads (club_id) where finished_at is null;

-- Members who read the book before: they skip the reading and join every room.
create table public.club_read_before (
  read_id uuid not null references public.club_reads (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  primary key (read_id, user_id)
);

alter table public.club_reads enable row level security;
alter table public.club_read_before enable row level security;
create policy "reads are public" on public.club_reads for select to authenticated using (true);
create policy "read-before is seen by members" on public.club_read_before for select to authenticated
  using (exists (select 1 from public.club_reads r where r.id = read_id and public._club_role(r.club_id) is not null));

-- Start the club's next read (host or co-host). Any current read is finished first.
create or replace function public.start_club_read(p_club uuid, p_book uuid, p_starts date, p_ends date, p_plan jsonb, p_list_position integer default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  rid uuid;
begin
  if public._club_role(p_club) not in ('host', 'cohost') then
    raise exception 'Only the host can pick the book' using errcode = '42501';
  end if;
  update public.club_reads set finished_at = now() where club_id = p_club and finished_at is null;
  insert into public.club_reads (club_id, book_id, list_position, starts_on, ends_on, plan)
  values (p_club, p_book, p_list_position, p_starts, p_ends, coalesce(p_plan, '[]'::jsonb))
  returning id into rid;
  insert into public.notifications (user_id, actor_id, kind, detail, target_type, target_id)
  select m.user_id, auth.uid(), 'club', 'new_read', 'club_read', rid
  from public.club_members m where m.club_id = p_club and m.user_id <> auth.uid();
  return rid;
end;
$$;
revoke execute on function public.start_club_read(uuid, uuid, date, date, jsonb, integer) from public, anon;
grant execute on function public.start_club_read(uuid, uuid, date, date, jsonb, integer) to authenticated;

-- Change the dates or the plan (including each week's questions).
create or replace function public.update_club_read(p_read uuid, p_ends date, p_plan jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public._club_role((select club_id from public.club_reads where id = p_read)) not in ('host', 'cohost') then
    raise exception 'Only the host can change the plan' using errcode = '42501';
  end if;
  update public.club_reads set ends_on = coalesce(p_ends, ends_on), plan = coalesce(p_plan, plan) where id = p_read;
end;
$$;
revoke execute on function public.update_club_read(uuid, date, jsonb) from public, anon;
grant execute on function public.update_club_read(uuid, date, jsonb) to authenticated;

create or replace function public.finish_club_read(p_read uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public._club_role((select club_id from public.club_reads where id = p_read)) not in ('host', 'cohost') then
    raise exception 'Only the host can finish the read' using errcode = '42501';
  end if;
  update public.club_reads set finished_at = coalesce(finished_at, now()) where id = p_read;
end;
$$;
revoke execute on function public.finish_club_read(uuid) from public, anon;
grant execute on function public.finish_club_read(uuid) to authenticated;

-- Mark (or unmark) that you read this book before.
create or replace function public.set_read_before(p_read uuid, p_before boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public._club_role((select club_id from public.club_reads where id = p_read)) is null then
    raise exception 'Join the club first' using errcode = '42501';
  end if;
  if p_before then
    insert into public.club_read_before (read_id, user_id) values (p_read, auth.uid()) on conflict do nothing;
  else
    delete from public.club_read_before where read_id = p_read and user_id = auth.uid();
  end if;
end;
$$;
revoke execute on function public.set_read_before(uuid, boolean) from public, anon;
grant execute on function public.set_read_before(uuid, boolean) to authenticated;

-- Whether a week's room is open to you: a member who read the book before,
-- has finished it, or has reached that week's last chapter. Week 0 is the
-- whole-book room: read before or finished.
create or replace function public._club_week_open(p_read uuid, p_week integer, p_user uuid default auth.uid())
returns boolean language plpgsql stable security definer set search_path = public as $$
declare
  r public.club_reads;
  reached integer;
  through integer;
begin
  select * into r from public.club_reads where id = p_read;
  if r.id is null or public._club_role(r.club_id, p_user) is null then return false; end if;
  if exists (select 1 from public.club_read_before b where b.read_id = p_read and b.user_id = p_user) then return true; end if;
  reached := coalesce(public.reached_chapter(r.book_id, p_user), 0);
  if reached >= 999 then return true; end if;
  if p_week = 0 then return false; end if;
  through := (r.plan -> (p_week - 1) ->> 'through')::integer;
  return through is not null and reached >= through;
end;
$$;
revoke execute on function public._club_week_open(uuid, integer, uuid) from anon;

-- Where each member is in the club's book: chapter only, never more. Members only.
create or replace function public.club_pace(p_read uuid)
returns table (user_id uuid, reached integer, read_before boolean)
language plpgsql stable security definer set search_path = public as $$
declare
  r public.club_reads;
begin
  select * into r from public.club_reads where id = p_read;
  if r.id is null or public._club_role(r.club_id) is null then return; end if;
  return query
    select m.user_id,
           public.reached_chapter(r.book_id, m.user_id),
           exists (select 1 from public.club_read_before b where b.read_id = p_read and b.user_id = m.user_id)
    from public.club_members m
    where m.club_id = r.club_id and not public.is_blocked(m.user_id, auth.uid());
end;
$$;
revoke execute on function public.club_pace(uuid) from public, anon;
grant execute on function public.club_pace(uuid) to authenticated;

-- Club cards for lists and search: member counts and the current book.
create or replace function public.club_cards(p_ids uuid[] default null, p_query text default null, p_limit integer default 30)
returns table (id uuid, name text, description text, color text, list_id uuid, has_password boolean, created_at timestamptz, members bigint, current_read uuid, current_book uuid, ends_on date)
language sql stable security definer set search_path = public as $$
  select c.id, c.name, c.description, c.color, c.list_id, c.has_password, c.created_at,
         (select count(*) from public.club_members m where m.club_id = c.id),
         r.id, r.book_id, r.ends_on
  from public.clubs c
  left join public.club_reads r on r.club_id = c.id and r.finished_at is null
  where (p_ids is null or c.id = any (p_ids))
    and (p_query is null or c.name ilike '%' || p_query || '%' or c.description ilike '%' || p_query || '%')
    and not exists (select 1 from public.club_members h where h.club_id = c.id and h.role = 'host' and public.is_blocked(h.user_id, auth.uid()))
  order by (select count(*) from public.club_members m where m.club_id = c.id) desc, c.created_at desc
  limit least(coalesce(p_limit, 30), 100)
$$;
revoke execute on function public.club_cards(uuid[], text, integer) from public, anon;
grant execute on function public.club_cards(uuid[], text, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- Week rooms

create table public.club_comments (
  id uuid primary key default gen_random_uuid(),
  read_id uuid not null references public.club_reads (id) on delete cascade,
  week smallint not null check (week between 0 and 52),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  parent_id uuid references public.club_comments (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index club_comments_room on public.club_comments (read_id, week, created_at);

create or replace function public._club_parent_ok(p_parent uuid, p_read uuid, p_week integer)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.club_comments c where c.id = p_parent and c.read_id = p_read and c.week = p_week and c.parent_id is null)
$$;
revoke execute on function public._club_parent_ok(uuid, uuid, integer) from anon;

alter table public.club_comments enable row level security;
create policy "week rooms are read by members who reached them" on public.club_comments
  for select to authenticated using (
    user_id = auth.uid() or (public._club_week_open(read_id, week) and not public.is_blocked(user_id, auth.uid()))
  );
create policy "members post in rooms they've reached" on public.club_comments
  for insert to authenticated with check (
    user_id = auth.uid() and public._club_week_open(read_id, week)
    and (parent_id is null or public._club_parent_ok(parent_id, read_id, week))
  );
create policy "authors and hosts delete room comments" on public.club_comments
  for delete to authenticated using (
    user_id = auth.uid()
    or public._club_role((select r.club_id from public.club_reads r where r.id = read_id)) in ('host', 'cohost')
  );

-- Comment counts per week, for members (counts only, even for weeks ahead).
create or replace function public.club_room_counts(p_read uuid)
returns table (week smallint, comments bigint)
language sql stable security definer set search_path = public as $$
  select c.week, count(*) from public.club_comments c
  join public.club_reads r on r.id = c.read_id
  where c.read_id = p_read and public._club_role(r.club_id) is not null
  group by c.week
$$;
revoke execute on function public.club_room_counts(uuid) from public, anon;
grant execute on function public.club_room_counts(uuid) to authenticated;

-- Hearts and reports cover club comments; replies notify.
alter table public.reactions drop constraint reactions_target_type_check;
alter table public.reactions add constraint reactions_target_type_check
  check (target_type in ('entry', 'checkin', 'chapter_comment', 'club_comment'));

create or replace function public.set_target_owner()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.target_type = 'entry' then
    select user_id into new.target_owner from public.shelf_entries where id = new.target_id;
  elsif new.target_type = 'checkin' then
    select user_id into new.target_owner from public.reading_checkins where id = new.target_id;
  elsif new.target_type = 'chapter_comment' then
    select c.user_id into new.target_owner from public.chapter_comments c
      where c.id = new.target_id and (c.user_id = new.user_id or public._in_room(c.book_id, c.chapter));
  elsif new.target_type = 'club_comment' then
    select c.user_id into new.target_owner from public.club_comments c
      where c.id = new.target_id and (c.user_id = new.user_id or public._club_week_open(c.read_id, c.week, new.user_id));
  end if;
  if new.target_owner is null then
    raise exception 'that post no longer exists';
  end if;
  return new;
end;
$$;
revoke execute on function public.set_target_owner() from public, anon, authenticated;

alter table public.reports drop constraint reports_target_type_check;
alter table public.reports add constraint reports_target_type_check
  check (target_type in ('comment', 'entry', 'checkin', 'profile', 'chapter_comment', 'club_comment'));

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('reaction', 'comment', 'follow', 'badge', 'mention', 'poke', 'read_along', 'picks', 'ask', 'room', 'club'));

create or replace function public._notify_club_reply()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  to_user uuid;
begin
  if new.parent_id is null then return new; end if;
  select user_id into to_user from public.club_comments where id = new.parent_id;
  if to_user is not null and to_user <> new.user_id and not public.is_blocked(to_user, new.user_id) then
    insert into public.notifications (user_id, actor_id, kind, detail, target_type, target_id)
    values (to_user, new.user_id, 'club', 'reply', 'club_comment', new.parent_id);
  end if;
  return new;
end;
$$;
revoke execute on function public._notify_club_reply() from public, anon, authenticated;
create trigger club_comments_notify after insert on public.club_comments
  for each row execute function public._notify_club_reply();

-- ---------------------------------------------------------------------------
-- Seed lists. Checked against thebookerprizes.com (winners 1969–2024 from its
-- winners page, 2025 and 2026 from its prize-year pages) on 2026-11-11.

with l as (
  insert into public.reading_lists (slug, name, description)
  values ('booker-winners', 'Booker Prize winners', 'Every winner of the Booker Prize, from 1969 to today.')
  returning id
)
insert into public.reading_list_items (list_id, position, year, title, author, note)
select l.id, v.position, v.year, v.title, v.author, v.note
from l, (values
  (1, 1969, 'Something to Answer For', 'P. H. Newby', null),
  (2, 1970, 'The Elected Member', 'Bernice Rubens', null),
  (3, 1970, 'Troubles', 'J. G. Farrell', 'Lost Man Booker, awarded in 2010'),
  (4, 1971, 'In a Free State', 'V. S. Naipaul', null),
  (5, 1972, 'G.', 'John Berger', null),
  (6, 1973, 'The Siege of Krishnapur', 'J. G. Farrell', null),
  (7, 1974, 'The Conservationist', 'Nadine Gordimer', 'Joint winner'),
  (8, 1974, 'Holiday', 'Stanley Middleton', 'Joint winner'),
  (9, 1975, 'Heat and Dust', 'Ruth Prawer Jhabvala', null),
  (10, 1976, 'Saville', 'David Storey', null),
  (11, 1977, 'Staying On', 'Paul Scott', null),
  (12, 1978, 'The Sea, the Sea', 'Iris Murdoch', null),
  (13, 1979, 'Offshore', 'Penelope Fitzgerald', null),
  (14, 1980, 'Rites of Passage', 'William Golding', null),
  (15, 1981, 'Midnight''s Children', 'Salman Rushdie', null),
  (16, 1982, 'Schindler''s Ark', 'Thomas Keneally', null),
  (17, 1983, 'Life and Times of Michael K', 'J. M. Coetzee', null),
  (18, 1984, 'Hotel du Lac', 'Anita Brookner', null),
  (19, 1985, 'The Bone People', 'Keri Hulme', null),
  (20, 1986, 'The Old Devils', 'Kingsley Amis', null),
  (21, 1987, 'Moon Tiger', 'Penelope Lively', null),
  (22, 1988, 'Oscar and Lucinda', 'Peter Carey', null),
  (23, 1989, 'The Remains of the Day', 'Kazuo Ishiguro', null),
  (24, 1990, 'Possession', 'A. S. Byatt', null),
  (25, 1991, 'The Famished Road', 'Ben Okri', null),
  (26, 1992, 'The English Patient', 'Michael Ondaatje', 'Joint winner'),
  (27, 1992, 'Sacred Hunger', 'Barry Unsworth', 'Joint winner'),
  (28, 1993, 'Paddy Clarke Ha Ha Ha', 'Roddy Doyle', null),
  (29, 1994, 'How Late It Was, How Late', 'James Kelman', null),
  (30, 1995, 'The Ghost Road', 'Pat Barker', null),
  (31, 1996, 'Last Orders', 'Graham Swift', null),
  (32, 1997, 'The God of Small Things', 'Arundhati Roy', null),
  (33, 1998, 'Amsterdam', 'Ian McEwan', null),
  (34, 1999, 'Disgrace', 'J. M. Coetzee', null),
  (35, 2000, 'The Blind Assassin', 'Margaret Atwood', null),
  (36, 2001, 'True History of the Kelly Gang', 'Peter Carey', null),
  (37, 2002, 'Life of Pi', 'Yann Martel', null),
  (38, 2003, 'Vernon God Little', 'DBC Pierre', null),
  (39, 2004, 'The Line of Beauty', 'Alan Hollinghurst', null),
  (40, 2005, 'The Sea', 'John Banville', null),
  (41, 2006, 'The Inheritance of Loss', 'Kiran Desai', null),
  (42, 2007, 'The Gathering', 'Anne Enright', null),
  (43, 2008, 'The White Tiger', 'Aravind Adiga', null),
  (44, 2009, 'Wolf Hall', 'Hilary Mantel', null),
  (45, 2010, 'The Finkler Question', 'Howard Jacobson', null),
  (46, 2011, 'The Sense of an Ending', 'Julian Barnes', null),
  (47, 2012, 'Bring Up the Bodies', 'Hilary Mantel', null),
  (48, 2013, 'The Luminaries', 'Eleanor Catton', null),
  (49, 2014, 'The Narrow Road to the Deep North', 'Richard Flanagan', null),
  (50, 2015, 'A Brief History of Seven Killings', 'Marlon James', null),
  (51, 2016, 'The Sellout', 'Paul Beatty', null),
  (52, 2017, 'Lincoln in the Bardo', 'George Saunders', null),
  (53, 2018, 'Milkman', 'Anna Burns', null),
  (54, 2019, 'Girl, Woman, Other', 'Bernardine Evaristo', 'Joint winner'),
  (55, 2019, 'The Testaments', 'Margaret Atwood', 'Joint winner'),
  (56, 2020, 'Shuggie Bain', 'Douglas Stuart', null),
  (57, 2021, 'The Promise', 'Damon Galgut', null),
  (58, 2022, 'The Seven Moons of Maali Almeida', 'Shehan Karunatilaka', null),
  (59, 2023, 'Prophet Song', 'Paul Lynch', null),
  (60, 2024, 'Orbital', 'Samantha Harvey', null),
  (61, 2025, 'Flesh', 'David Szalay', null),
  (62, 2026, 'The End of Everything', 'M. John Harrison', null)
) as v(position, year, title, author, note);

with l as (
  insert into public.reading_lists (slug, name, description)
  values ('booker-2026', 'Booker Prize 2026', 'The 13 books on the 2026 longlist, including the six shortlisted and the winner.')
  returning id
)
insert into public.reading_list_items (list_id, position, year, title, author, note)
select l.id, v.position, 2026, v.title, v.author, v.note
from l, (values
  (1, 'The End of Everything', 'M. John Harrison', 'Winner'),
  (2, 'The Disappearers', 'Marlon James', 'Shortlisted'),
  (3, 'Black Bag', 'Luke Kennard', 'Shortlisted'),
  (4, 'May We Feed the King', 'Rebecca Perry', 'Shortlisted'),
  (5, 'The Things We Never Say', 'Elizabeth Strout', 'Shortlisted'),
  (6, 'John of John', 'Douglas Stuart', 'Shortlisted'),
  (7, 'The Shadow of the Object', 'Chloe Aridjis', 'Longlisted'),
  (8, 'Switzy', 'Emma Cline', 'Longlisted'),
  (9, 'Helen of Nowhere', 'Makenna Goodman', 'Longlisted'),
  (10, 'The Renovation', 'Kenan Orhan', 'Longlisted'),
  (11, 'The Palm House', 'Gwendoline Riley', 'Longlisted'),
  (12, 'All Them Dogs', 'Djamel White', 'Longlisted'),
  (13, 'The Vivisectors', 'Missouri Williams', 'Longlisted')
) as v(position, title, author, note);
