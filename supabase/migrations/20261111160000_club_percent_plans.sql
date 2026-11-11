-- Club plans by percent, for books whose chapter count nobody knows (REA-68 follow-up).
--
-- A club read is planned in chapters (week N: read through chapter X) or in
-- percent (week N: read to X%). Percent plans need no chapter count, and work
-- whichever way members check in: by percent, by page, or by chapter.
--
-- Also: book_chapter_guess() returns the chapter count readers have entered
-- for a book, so the host doesn't have to look it up.

alter table public.club_reads add column if not exists unit text not null default 'chapter'
  check (unit in ('chapter', 'percent'));

-- How far someone is through a book, in percent. 999 once they've finished
-- and ranked it (the same "finished" marker reached_chapter uses).
create or replace function public.reached_percent(p_book uuid, p_user uuid default auth.uid())
returns integer language sql stable security definer set search_path = public as $$
  select case
    when e.status = 'ranked' and not e.did_not_finish then 999
    when e.progress_unit = 'chapter' and e.progress_chapter is not null and coalesce(e.chapter_total, b.chapters) > 0
      then least(100, floor(e.progress_chapter * 100.0 / coalesce(e.chapter_total, b.chapters)))::int
    when e.progress_pct is not null then e.progress_pct::int
    when e.progress_chapter is not null and coalesce(e.chapter_total, b.chapters) > 0
      then least(100, floor(e.progress_chapter * 100.0 / coalesce(e.chapter_total, b.chapters)))::int
    else null
  end
  from public.shelf_entries e join public.books b on b.id = e.book_id
  where e.user_id = p_user and e.book_id = p_book
  limit 1
$$;
revoke execute on function public.reached_percent(uuid, uuid) from public, anon;
grant execute on function public.reached_percent(uuid, uuid) to authenticated;

-- How far a member is, in the read's own unit.
create or replace function public._club_reached(r public.club_reads, p_user uuid)
returns integer language sql stable security definer set search_path = public as $$
  select case when r.unit = 'percent' then public.reached_percent(r.book_id, p_user) else public.reached_chapter(r.book_id, p_user) end
$$;
revoke execute on function public._club_reached(public.club_reads, uuid) from public, anon, authenticated;

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
  reached := coalesce(public._club_reached(r, p_user), 0);
  if reached >= 999 then return true; end if;
  if p_week = 0 then return false; end if;
  through := (r.plan -> (p_week - 1) ->> 'through')::integer;
  return through is not null and reached >= through;
end;
$$;
revoke execute on function public._club_week_open(uuid, integer, uuid) from anon;

-- Where each member is, in the read's unit (chapter or percent).
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
           public._club_reached(r, m.user_id),
           exists (select 1 from public.club_read_before b where b.read_id = p_read and b.user_id = m.user_id)
    from public.club_members m
    where m.club_id = r.club_id and not public.is_blocked(m.user_id, auth.uid());
end;
$$;
revoke execute on function public.club_pace(uuid) from public, anon;
grant execute on function public.club_pace(uuid) to authenticated;

-- Only chapter plans tell us the chapter count.
create or replace function public._club_read_chapters()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  n integer;
begin
  if new.unit = 'chapter' and jsonb_typeof(new.plan) = 'array' and jsonb_array_length(new.plan) > 0 then
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
create trigger club_reads_chapters after insert or update of plan, unit on public.club_reads
  for each row execute function public._club_read_chapters();

-- Starting and editing a read take the unit now.
drop function if exists public.start_club_read(uuid, uuid, date, date, jsonb, integer);
create or replace function public.start_club_read(p_club uuid, p_book uuid, p_starts date, p_ends date, p_plan jsonb, p_list_position integer default null, p_unit text default 'chapter')
returns uuid language plpgsql security definer set search_path = public as $$
declare
  rid uuid;
begin
  if coalesce(public._club_role(p_club), '') not in ('host', 'cohost') then
    raise exception 'Only the host can pick the book' using errcode = '42501';
  end if;
  if coalesce(p_unit, 'chapter') not in ('chapter', 'percent') then
    raise exception 'Plan by chapter or percent' using errcode = '22023';
  end if;
  update public.club_reads set finished_at = now() where club_id = p_club and finished_at is null;
  insert into public.club_reads (club_id, book_id, list_position, starts_on, ends_on, plan, unit)
  values (p_club, p_book, p_list_position, p_starts, p_ends, coalesce(p_plan, '[]'::jsonb), coalesce(p_unit, 'chapter'))
  returning id into rid;
  insert into public.notifications (user_id, actor_id, kind, detail, target_type, target_id)
  select m.user_id, auth.uid(), 'club', 'new_read', 'club_read', rid
  from public.club_members m where m.club_id = p_club and m.user_id <> auth.uid();
  return rid;
end;
$$;
revoke execute on function public.start_club_read(uuid, uuid, date, date, jsonb, integer, text) from public, anon;
grant execute on function public.start_club_read(uuid, uuid, date, date, jsonb, integer, text) to authenticated;

drop function if exists public.update_club_read(uuid, date, jsonb);
create or replace function public.update_club_read(p_read uuid, p_ends date, p_plan jsonb, p_unit text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if coalesce(public._club_role((select club_id from public.club_reads where id = p_read)), '') not in ('host', 'cohost') then
    raise exception 'Only the host can change the plan' using errcode = '42501';
  end if;
  if p_unit is not null and p_unit not in ('chapter', 'percent') then
    raise exception 'Plan by chapter or percent' using errcode = '22023';
  end if;
  update public.club_reads
  set ends_on = coalesce(p_ends, ends_on), plan = coalesce(p_plan, plan), unit = coalesce(p_unit, unit)
  where id = p_read;
end;
$$;
revoke execute on function public.update_club_read(uuid, date, jsonb, text) from public, anon;
grant execute on function public.update_club_read(uuid, date, jsonb, text) to authenticated;

-- The chapter count readers have entered for a book (most common answer),
-- or null if nobody has.
create or replace function public.book_chapter_guess(p_book uuid)
returns integer language sql stable security definer set search_path = public as $$
  select coalesce(
    (select chapters from public.books where id = p_book),
    (select e.chapter_total from public.shelf_entries e
      where e.book_id = p_book and e.chapter_total is not null
      group by e.chapter_total order by count(*) desc, e.chapter_total limit 1)
  )
$$;
revoke execute on function public.book_chapter_guess(uuid) from public, anon;
grant execute on function public.book_chapter_guess(uuid) to authenticated;
