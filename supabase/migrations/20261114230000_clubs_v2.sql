-- Book clubs v2: safer discovery (REA-95), meetings with RSVP (REA-91) and
-- the blind-rank reveal (REA-92).
--
-- Run this whole file once in the Supabase SQL Editor, before the deploy
-- that ships the new club screens.

create extension if not exists pgcrypto with schema extensions;

-- ===========================================================================
-- 1. Safer discovery (REA-95)

-- Clubs can be reported. Removing one from the reports page deletes it.
alter table public.reports drop constraint if exists reports_target_type_check;
alter table public.reports add constraint reports_target_type_check
  check (target_type in ('comment', 'entry', 'checkin', 'profile', 'chapter_comment', 'club_comment', 'club'));

-- Passwords: bcrypt from now on. Old salted SHA-256 hashes still work, and
-- are upgraded to bcrypt the first time someone joins with the password.
create or replace function public._club_password_hash(p_password text)
returns text language sql volatile set search_path = public, extensions as $$
  select crypt(p_password, gen_salt('bf', 10))
$$;
revoke execute on function public._club_password_hash(text) from public, anon, authenticated;

create or replace function public._club_password_ok(p_club uuid, p_password text)
returns boolean language plpgsql security definer set search_path = public, extensions as $$
declare
  c public.clubs;
begin
  select * into c from public.clubs where id = p_club;
  if c.password_hash is null then return true; end if;
  if p_password is null then return false; end if;
  if c.password_hash like '$2%' then
    return crypt(p_password, c.password_hash) = c.password_hash;
  end if;
  -- Legacy hash: check it, then upgrade.
  if public._club_hash(c.password_salt, p_password) = c.password_hash then
    update public.clubs set password_hash = public._club_password_hash(p_password), password_salt = null where id = p_club;
    return true;
  end if;
  return false;
end;
$$;
revoke execute on function public._club_password_ok(uuid, text) from public, anon, authenticated;

create or replace function public.create_club(p_name text, p_description text default null, p_color text default 'ember', p_list text default null, p_password text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  club uuid;
begin
  if uid is null then raise exception 'Sign in first' using errcode = '42501'; end if;
  if nullif(p_password, '') is not null and char_length(p_password) < 6 then
    raise exception 'Use a password of at least 6 characters' using errcode = '22023';
  end if;
  insert into public.clubs (name, description, color, list_id, password_salt, password_hash, created_by)
  values (btrim(p_name), nullif(btrim(coalesce(p_description, '')), ''), coalesce(p_color, 'ember'),
          (select id from public.reading_lists where slug = p_list),
          null, case when nullif(p_password, '') is not null then public._club_password_hash(p_password) end, uid)
  returning id into club;
  insert into public.club_members (club_id, user_id, role) values (club, uid, 'host');
  return club;
end;
$$;
revoke execute on function public.create_club(text, text, text, text, text) from public, anon;
grant execute on function public.create_club(text, text, text, text, text) to authenticated;

create or replace function public.update_club(p_club uuid, p_name text, p_description text, p_color text, p_list text default null, p_password text default null, p_clear_password boolean default false)
returns void language plpgsql security definer set search_path = public as $$
begin
  if coalesce(public._club_role(p_club), '') not in ('host', 'cohost') then
    raise exception 'Only the host can change the club' using errcode = '42501';
  end if;
  if nullif(p_password, '') is not null and char_length(p_password) < 6 then
    raise exception 'Use a password of at least 6 characters' using errcode = '22023';
  end if;
  update public.clubs set
    name = btrim(p_name),
    description = nullif(btrim(coalesce(p_description, '')), ''),
    color = coalesce(p_color, color),
    list_id = case when p_list is null then list_id when p_list = '' then null else (select id from public.reading_lists where slug = p_list) end,
    password_salt = case when p_clear_password or nullif(p_password, '') is not null then null else password_salt end,
    password_hash = case when p_clear_password then null
                         when nullif(p_password, '') is not null then public._club_password_hash(p_password)
                         else password_hash end
  where id = p_club;
end;
$$;
revoke execute on function public.update_club(uuid, text, text, text, text, text, boolean) from public, anon;
grant execute on function public.update_club(uuid, text, text, text, text, text, boolean) to authenticated;

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
    if not public._club_password_ok(p_club, p_password) then
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

-- Discovery lists a club once it has 3 members. Clubs you ask for by id
-- (your clubs, an invite link) always show.
create or replace function public.club_cards(p_ids uuid[] default null, p_query text default null, p_limit integer default 30)
returns table (id uuid, name text, description text, color text, list_id uuid, has_password boolean, created_at timestamptz, members bigint, current_read uuid, current_book uuid, ends_on date)
language sql stable security definer set search_path = public as $$
  with counted as (
    select c.*, (select count(*) from public.club_members m where m.club_id = c.id) as n
    from public.clubs c
    where (p_ids is null or c.id = any (p_ids))
      and (p_query is null or c.name ilike '%' || p_query || '%' or c.description ilike '%' || p_query || '%')
  )
  select c.id, c.name, c.description, c.color, c.list_id, c.has_password, c.created_at, c.n,
         r.id, r.book_id, r.ends_on
  from counted c
  left join public.club_reads r on r.club_id = c.id and r.finished_at is null
  where (p_ids is not null or c.n >= 3 or exists (select 1 from public.club_members me where me.club_id = c.id and me.user_id = auth.uid()))
    and not exists (select 1 from public.club_members h where h.club_id = c.id and h.role = 'host' and public.is_blocked(h.user_id, auth.uid()))
  order by c.n desc, c.created_at desc
  limit least(coalesce(p_limit, 30), 100)
$$;
revoke execute on function public.club_cards(uuid[], text, integer) from public, anon;
grant execute on function public.club_cards(uuid[], text, integer) to authenticated;

-- Reports page: a reported club shows its name and description, by its host.
create or replace function public.admin_reports()
returns table (
  target_type text, target_id uuid, reports integer, reasons text[], first_at timestamptz, last_at timestamptz,
  author_id uuid, author_name text, author_username text, body text, link text, author_reports integer
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  return query
  with open as (
    select r.target_type as t, r.target_id as id, count(*)::int as n,
           array_remove(array_agg(r.reason order by r.created_at), null) as why,
           min(r.created_at) as first_at, max(r.created_at) as last_at
    from public.reports r
    where r.status = 'open'
    group by r.target_type, r.target_id
  ),
  detail as (
    select o.*,
      case o.t
        when 'comment' then (select c.user_id from public.comments c where c.id = o.id)
        when 'chapter_comment' then (select c.user_id from public.chapter_comments c where c.id = o.id)
        when 'club_comment' then (select c.user_id from public.club_comments c where c.id = o.id)
        when 'club' then (select m.user_id from public.club_members m where m.club_id = o.id and m.role = 'host')
        when 'entry' then (select e.user_id from public.shelf_entries e where e.id = o.id)
        when 'checkin' then (select k.user_id from public.reading_checkins k where k.id = o.id)
        when 'profile' then o.id
      end as who,
      case o.t
        when 'comment' then (select c.body from public.comments c where c.id = o.id)
        when 'chapter_comment' then (select c.body from public.chapter_comments c where c.id = o.id)
        when 'club_comment' then (select c.body from public.club_comments c where c.id = o.id)
        when 'club' then (select c.name || coalesce(E'\n' || c.description, '') from public.clubs c where c.id = o.id)
        when 'entry' then (select e.note from public.shelf_entries e where e.id = o.id)
        when 'checkin' then (select k.note from public.reading_checkins k where k.id = o.id)
        when 'profile' then (select p.bio from public.profiles p where p.id = o.id)
      end as said,
      case o.t
        when 'comment' then (select '/book/' || e.book_id from public.comments c join public.shelf_entries e on e.id = c.target_id where c.id = o.id)
        when 'chapter_comment' then (select '/book/' || c.book_id || '/room/' || c.chapter from public.chapter_comments c where c.id = o.id)
        when 'club_comment' then (select '/clubs/' || cr.club_id || '/week/' || c.week from public.club_comments c join public.club_reads cr on cr.id = c.read_id where c.id = o.id)
        when 'club' then '/clubs/' || o.id
        when 'entry' then (select '/book/' || e.book_id from public.shelf_entries e where e.id = o.id)
        when 'checkin' then (select '/book/' || k.book_id from public.reading_checkins k where k.id = o.id)
        when 'profile' then null
      end as href
    from open o
  )
  select d.t, d.id, d.n, d.why, d.first_at, d.last_at,
         d.who, p.display_name, p.username, d.said,
         coalesce(d.href, case when p.username is not null then '/u/' || p.username end),
         (count(*) over (partition by d.who))::int
  from detail d
  left join public.profiles p on p.id = d.who
  order by d.n desc, d.last_at desc;
end;
$$;
revoke execute on function public.admin_reports() from public, anon;
grant execute on function public.admin_reports() to authenticated;

create or replace function public.admin_resolve_report(p_type text, p_target uuid, p_action text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if p_action not in ('dismiss', 'remove') then
    raise exception 'Unknown action %', p_action;
  end if;

  if p_action = 'remove' then
    case p_type
      when 'comment' then delete from public.comments where id = p_target;
      when 'chapter_comment' then delete from public.chapter_comments where id = p_target;
      when 'club_comment' then delete from public.club_comments where id = p_target;
      when 'club' then delete from public.clubs where id = p_target;
      when 'entry' then update public.shelf_entries set note = null where id = p_target;
      when 'checkin' then update public.reading_checkins set note = null where id = p_target;
      when 'profile' then update public.profiles set bio = null where id = p_target;
      else raise exception 'Unknown target %', p_type;
    end case;
  end if;

  update public.reports
     set status = case when p_action = 'dismiss' then 'dismissed' else 'resolved' end,
         resolved_at = now(),
         resolved_by = auth.uid()
   where target_type = p_type and target_id = p_target and status = 'open';
end;
$$;
revoke execute on function public.admin_resolve_report(text, uuid, text) from public, anon;
grant execute on function public.admin_resolve_report(text, uuid, text) to authenticated;

-- ===========================================================================
-- 2. Meetings and RSVP (REA-91)

-- At most one meeting per club read: when, where (a place, a call link, or
-- both) and a note.
create table if not exists public.club_meetings (
  read_id uuid primary key references public.club_reads (id) on delete cascade,
  starts_at timestamptz not null,
  place text check (place is null or char_length(place) <= 200),
  link text check (link is null or (char_length(link) <= 500 and link ~* '^https://')),
  note text check (note is null or char_length(note) <= 300),
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.club_rsvps (
  read_id uuid not null references public.club_reads (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  answer text not null check (answer in ('going', 'maybe', 'no')),
  updated_at timestamptz not null default now(),
  primary key (read_id, user_id)
);

alter table public.club_meetings enable row level security;
alter table public.club_rsvps enable row level security;
revoke all on public.club_meetings, public.club_rsvps from anon, authenticated;
grant select on public.club_meetings, public.club_rsvps to authenticated;

-- Members see their club's meeting and who's coming.
drop policy if exists "members see the meeting" on public.club_meetings;
create policy "members see the meeting" on public.club_meetings for select to authenticated
  using (public._club_role((select r.club_id from public.club_reads r where r.id = read_id)) is not null);
drop policy if exists "members see who's coming" on public.club_rsvps;
create policy "members see who's coming" on public.club_rsvps for select to authenticated
  using (public._club_role((select r.club_id from public.club_reads r where r.id = read_id)) is not null
         and not public.is_blocked(user_id, auth.uid()));

-- Host or co-host sets, moves or (with p_starts_at null) cancels the meeting.
-- Members hear about it when it's set or moved.
create or replace function public.set_club_meeting(p_read uuid, p_starts_at timestamptz, p_place text default null, p_link text default null, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  r public.club_reads;
  before timestamptz;
begin
  select * into r from public.club_reads where id = p_read;
  if r.id is null or coalesce(public._club_role(r.club_id), '') not in ('host', 'cohost') then
    raise exception 'Only the host can set the meeting' using errcode = '42501';
  end if;
  if p_starts_at is null then
    delete from public.club_meetings where read_id = p_read;
    return;
  end if;
  if nullif(btrim(coalesce(p_link, '')), '') is not null and btrim(p_link) !~* '^https://' then
    raise exception 'Use a link that starts with https://' using errcode = '22023';
  end if;
  select starts_at into before from public.club_meetings where read_id = p_read;
  insert into public.club_meetings (read_id, starts_at, place, link, note, updated_by, updated_at)
  values (p_read, p_starts_at, nullif(btrim(coalesce(p_place, '')), ''), nullif(btrim(coalesce(p_link, '')), ''),
          nullif(btrim(coalesce(p_note, '')), ''), auth.uid(), now())
  on conflict (read_id) do update set
    starts_at = excluded.starts_at, place = excluded.place, link = excluded.link, note = excluded.note,
    updated_by = excluded.updated_by, updated_at = now();
  if before is distinct from p_starts_at then
    insert into public.notifications (user_id, actor_id, kind, detail, target_type, target_id)
    select m.user_id, auth.uid(), 'club', case when before is null then 'meeting' else 'meeting_moved' end, 'club_read', p_read
    from public.club_members m where m.club_id = r.club_id and m.user_id <> auth.uid();
  end if;
end;
$$;
revoke execute on function public.set_club_meeting(uuid, timestamptz, text, text, text) from public, anon;
grant execute on function public.set_club_meeting(uuid, timestamptz, text, text, text) to authenticated;

-- A member answers going / maybe / no (null takes the answer back).
create or replace function public.rsvp_club_meeting(p_read uuid, p_answer text)
returns void language plpgsql security definer set search_path = public as $$
declare
  club uuid := (select r.club_id from public.club_reads r where r.id = p_read);
begin
  if club is null or public._club_role(club) is null then
    raise exception 'Join the club first' using errcode = '42501';
  end if;
  if not exists (select 1 from public.club_meetings where read_id = p_read) then
    raise exception 'There''s no meeting yet' using errcode = '22023';
  end if;
  if p_answer is null then
    delete from public.club_rsvps where read_id = p_read and user_id = auth.uid();
  elsif p_answer in ('going', 'maybe', 'no') then
    insert into public.club_rsvps (read_id, user_id, answer) values (p_read, auth.uid(), p_answer)
    on conflict (read_id, user_id) do update set answer = excluded.answer, updated_at = now();
  else
    raise exception 'Answer going, maybe or no' using errcode = '22023';
  end if;
end;
$$;
revoke execute on function public.rsvp_club_meeting(uuid, text) from public, anon;
grant execute on function public.rsvp_club_meeting(uuid, text) to authenticated;

-- Upcoming meetings for the clubs you're in (for Your clubs).
create or replace function public.my_club_meetings()
returns table (club_id uuid, read_id uuid, starts_at timestamptz, answer text)
language sql stable security definer set search_path = public as $$
  select r.club_id, r.id, mt.starts_at, v.answer
  from public.club_members m
  join public.club_reads r on r.club_id = m.club_id and r.finished_at is null
  join public.club_meetings mt on mt.read_id = r.id
  left join public.club_rsvps v on v.read_id = r.id and v.user_id = m.user_id
  where m.user_id = auth.uid() and mt.starts_at > now() - interval '3 hours'
$$;
revoke execute on function public.my_club_meetings() from public, anon;
grant execute on function public.my_club_meetings() to authenticated;

-- ===========================================================================
-- 3. The reveal (REA-92)

-- Everyone ranks the club's book on their own shelf. In the club, scores stay
-- hidden until the reveal opens: when the host opens it, when the meeting
-- starts, or when the read is wrapped up.
alter table public.club_reads add column if not exists revealed_at timestamptz;

create or replace function public._club_reveal_open(p_read uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.club_reads r
    left join public.club_meetings mt on mt.read_id = r.id
    where r.id = p_read
      and (r.revealed_at is not null or r.finished_at is not null or (mt.starts_at is not null and mt.starts_at <= now()))
  )
$$;
revoke execute on function public._club_reveal_open(uuid) from public, anon, authenticated;

create or replace function public.open_club_reveal(p_read uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  r public.club_reads;
begin
  select * into r from public.club_reads where id = p_read;
  if r.id is null or coalesce(public._club_role(r.club_id), '') not in ('host', 'cohost') then
    raise exception 'Only the host can open the reveal' using errcode = '42501';
  end if;
  if r.revealed_at is not null then return; end if;
  update public.club_reads set revealed_at = now() where id = p_read;
  insert into public.notifications (user_id, actor_id, kind, detail, target_type, target_id)
  select m.user_id, auth.uid(), 'club', 'reveal', 'club_read', p_read
  from public.club_members m where m.club_id = r.club_id and m.user_id <> auth.uid();
end;
$$;
revoke execute on function public.open_club_reveal(uuid) from public, anon;
grant execute on function public.open_club_reveal(uuid) to authenticated;

-- Who in the club has ranked the book, and (once the reveal is open) their
-- scores. Private profiles and blocked readers are left out, except yourself.
-- Before the reveal only your own score comes back.
create or replace function public.club_reveal(p_read uuid)
returns table (user_id uuid, score numeric, is_open boolean)
language plpgsql stable security definer set search_path = public as $$
declare
  r public.club_reads;
  open boolean;
begin
  select * into r from public.club_reads where id = p_read;
  if r.id is null or public._club_role(r.club_id) is null then
    raise exception 'Join the club first' using errcode = '42501';
  end if;
  open := public._club_reveal_open(p_read);
  return query
  select m.user_id,
         case when open or m.user_id = auth.uid() then s.score end,
         open
  from public.club_members m
  join public.entry_scores s on s.user_id = m.user_id and s.book_id = r.book_id
  join public.profiles p on p.id = m.user_id
  where m.club_id = r.club_id
    and (m.user_id = auth.uid() or (not p.is_private and not public.is_blocked(m.user_id, auth.uid())));
end;
$$;
revoke execute on function public.club_reveal(uuid) from public, anon;
grant execute on function public.club_reveal(uuid) to authenticated;
