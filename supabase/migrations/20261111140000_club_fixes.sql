-- Book club fixes from the audit (REA-68).
--
-- 1. A club pick saves the book's chapter count from the plan, so members who
--    check in by percent (audiobook listeners) still open the week rooms.
-- 2. Invite links: every club gets a private code that members can share;
--    the link lets people in without the password. Hosts can reset it.
-- 3. Hosts hear when someone joins; members hear when a book wraps up.
-- 0. Security: the host-only checks let non-members through, because a
--    non-member's role is null and `null not in (...)` is not true. Every
--    check now treats "not a member" as "not the host".

-- 0. Host-only checks -------------------------------------------------------

create or replace function public.update_club(p_club uuid, p_name text, p_description text, p_color text, p_list text default null, p_password text default null, p_clear_password boolean default false)
returns void language plpgsql security definer set search_path = public as $$
declare
  salt text := case when nullif(p_password, '') is not null then gen_random_uuid()::text end;
begin
  if coalesce(public._club_role(p_club), '') not in ('host', 'cohost') then
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

create or replace function public.set_club_role(p_club uuid, p_user uuid, p_role text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if coalesce(public._club_role(p_club), '') <> 'host' then raise exception 'Only the host can do that' using errcode = '42501'; end if;
  if p_role not in ('cohost', 'member') then raise exception 'Pick co-host or member' using errcode = '22023'; end if;
  update public.club_members set role = p_role where club_id = p_club and user_id = p_user and role <> 'host';
end;
$$;

create or replace function public.start_club_read(p_club uuid, p_book uuid, p_starts date, p_ends date, p_plan jsonb, p_list_position integer default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  rid uuid;
begin
  if coalesce(public._club_role(p_club), '') not in ('host', 'cohost') then
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

create or replace function public.update_club_read(p_read uuid, p_ends date, p_plan jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if coalesce(public._club_role((select club_id from public.club_reads where id = p_read)), '') not in ('host', 'cohost') then
    raise exception 'Only the host can change the plan' using errcode = '42501';
  end if;
  update public.club_reads set ends_on = coalesce(p_ends, ends_on), plan = coalesce(p_plan, plan) where id = p_read;
end;
$$;

-- 1. Chapter counts ---------------------------------------------------------

create or replace function public._club_read_chapters()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  n integer;
begin
  if jsonb_typeof(new.plan) = 'array' and jsonb_array_length(new.plan) > 0 then
    n := nullif(new.plan -> (jsonb_array_length(new.plan) - 1) ->> 'through', '')::integer;
    if n between 1 and 999 then
      update public.books set chapters = n where id = new.book_id and chapters is null;
    end if;
  end if;
  return new;
end;
$$;
revoke execute on function public._club_read_chapters() from public, anon, authenticated;
drop trigger if exists club_reads_chapters on public.club_reads;
create trigger club_reads_chapters after insert or update of plan on public.club_reads
  for each row execute function public._club_read_chapters();

-- Reads that already exist.
update public.books b
set chapters = (r.plan -> (jsonb_array_length(r.plan) - 1) ->> 'through')::integer
from public.club_reads r
where r.book_id = b.id and b.chapters is null
  and jsonb_typeof(r.plan) = 'array' and jsonb_array_length(r.plan) > 0;

-- 2. Invite links -----------------------------------------------------------

-- Not in the column grants, so only the functions below can read it.
alter table public.clubs add column if not exists invite_code text not null
  default substr(md5(gen_random_uuid()::text), 1, 12);
create unique index if not exists clubs_invite_code on public.clubs (invite_code);

-- Members get the code to share.
create or replace function public.club_invite_code(p_club uuid)
returns text language plpgsql stable security definer set search_path = public as $$
begin
  if public._club_role(p_club) is null then return null; end if;
  return (select invite_code from public.clubs where id = p_club);
end;
$$;
revoke execute on function public.club_invite_code(uuid) from public, anon;
grant execute on function public.club_invite_code(uuid) to authenticated;

-- Hosts can make old links stop working.
create or replace function public.reset_club_invite(p_club uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  code text := substr(md5(gen_random_uuid()::text), 1, 12);
begin
  if coalesce(public._club_role(p_club), '') not in ('host', 'cohost') then
    raise exception 'Only the host can reset the link' using errcode = '42501';
  end if;
  update public.clubs set invite_code = code where id = p_club;
  return code;
end;
$$;
revoke execute on function public.reset_club_invite(uuid) from public, anon;
grant execute on function public.reset_club_invite(uuid) to authenticated;

-- Tell the host someone joined.
create or replace function public._notify_club_join()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.role = 'member' then
    insert into public.notifications (user_id, actor_id, kind, detail, target_type, target_id)
    select m.user_id, new.user_id, 'club', 'joined', 'club', new.club_id
    from public.club_members m
    where m.club_id = new.club_id and m.role = 'host' and m.user_id <> new.user_id
      and not public.is_blocked(m.user_id, new.user_id);
  end if;
  return new;
end;
$$;
revoke execute on function public._notify_club_join() from public, anon, authenticated;
drop trigger if exists club_members_notify on public.club_members;
create trigger club_members_notify after insert on public.club_members
  for each row execute function public._notify_club_join();

-- Join with an invite code instead of the password. Same lockout as passwords.
create or replace function public.join_club_by_invite(p_club uuid, p_code text)
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
  if (select count(*) from public.club_join_attempts a where a.club_id = p_club and a.user_id = uid and a.at > now() - interval '15 minutes') >= 5 then
    return 'locked';
  end if;
  if p_code is null or p_code <> c.invite_code then
    insert into public.club_join_attempts (club_id, user_id) values (p_club, uid);
    return 'bad_invite';
  end if;
  insert into public.club_members (club_id, user_id, role) values (p_club, uid, 'member');
  delete from public.club_join_attempts where club_id = p_club and user_id = uid;
  return 'joined';
end;
$$;
revoke execute on function public.join_club_by_invite(uuid, text) from public, anon;
grant execute on function public.join_club_by_invite(uuid, text) to authenticated;

-- 3. Wrapping up a book -----------------------------------------------------

create or replace function public.finish_club_read(p_read uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  r public.club_reads;
begin
  select * into r from public.club_reads where id = p_read;
  if r.id is null or coalesce(public._club_role(r.club_id), '') not in ('host', 'cohost') then
    raise exception 'Only the host can finish the read' using errcode = '42501';
  end if;
  if r.finished_at is not null then return; end if;
  update public.club_reads set finished_at = now() where id = p_read;
  insert into public.notifications (user_id, actor_id, kind, detail, target_type, target_id)
  select m.user_id, auth.uid(), 'club', 'finished', 'club_read', p_read
  from public.club_members m where m.club_id = r.club_id and m.user_id <> auth.uid();
end;
$$;
revoke execute on function public.finish_club_read(uuid) from public, anon;
grant execute on function public.finish_club_read(uuid) to authenticated;
