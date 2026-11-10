-- readread: chapter rooms. Every chapter of a book has a comment thread, open
-- only to readers who've reached that chapter, so nobody sees a spoiler.
-- Chapter 0 is the "Whole book" room, open once you've finished.
--
-- Where you are comes from your shelf entry: finished (ranked) opens every
-- room; otherwise your chapter, or for page/percent tracking your percent of
-- the chapter count (yours, else the book's shared one).

create table public.chapter_comments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  book_id uuid not null references public.books (id) on delete cascade,
  chapter smallint not null check (chapter between 0 and 999),
  parent_id uuid references public.chapter_comments (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 500),
  created_at timestamptz not null default now()
);
create index chapter_comments_room on public.chapter_comments (book_id, chapter, created_at);
create index chapter_comments_parent on public.chapter_comments (parent_id) where parent_id is not null;

-- The furthest chapter you've reached in a book: 999 when finished, null
-- when it isn't on your shelf (or you haven't started).
create or replace function public.reached_chapter(p_book uuid, p_user uuid default auth.uid())
returns integer language sql stable security definer set search_path = public as $$
  select case
    when e.status = 'ranked' and not e.did_not_finish then 999
    when e.progress_unit = 'chapter' and e.progress_chapter is not null then e.progress_chapter
    when e.progress_pct is not null and coalesce(e.chapter_total, b.chapters) is not null
      then floor(e.progress_pct / 100.0 * coalesce(e.chapter_total, b.chapters))::int
    when e.progress_chapter is not null then e.progress_chapter
    else null
  end
  from public.shelf_entries e join public.books b on b.id = e.book_id
  where e.user_id = p_user and e.book_id = p_book
  limit 1
$$;
revoke execute on function public.reached_chapter(uuid, uuid) from anon;
grant execute on function public.reached_chapter(uuid, uuid) to authenticated;

-- Whether you can be in a room: chapter N needs N reached; the whole-book room needs finished.
create or replace function public._in_room(p_book uuid, p_chapter integer)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.reached_chapter(p_book) >= case when p_chapter = 0 then 999 else p_chapter end, false)
$$;
revoke execute on function public._in_room(uuid, integer) from anon;

-- A reply's parent must be a top-level comment in the same room (one level of replies).
create or replace function public._room_parent_ok(p_parent uuid, p_book uuid, p_chapter integer)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.chapter_comments c
    where c.id = p_parent and c.book_id = p_book and c.chapter = p_chapter and c.parent_id is null
  )
$$;
revoke execute on function public._room_parent_ok(uuid, uuid, integer) from anon;

alter table public.chapter_comments enable row level security;

create policy "rooms are read by readers who reached them"
  on public.chapter_comments for select to authenticated using (
    user_id = auth.uid()
    or (public._in_room(book_id, chapter) and public.is_visible(user_id))
  );
create policy "readers post in rooms they've reached"
  on public.chapter_comments for insert to authenticated with check (
    user_id = auth.uid()
    and public._in_room(book_id, chapter)
    and (parent_id is null or public._room_parent_ok(parent_id, book_id, chapter))
  );
create policy "readers delete their own room comments"
  on public.chapter_comments for delete to authenticated using (user_id = auth.uid());

-- Comment counts per room for a book, for the rooms list on the book page.
-- Counts rooms you can't open yet too (just the number, never the text).
create or replace function public.chapter_room_counts(p_book uuid)
returns table (chapter smallint, comments bigint, latest timestamptz)
language sql stable security definer set search_path = public as $$
  select c.chapter, count(*), max(c.created_at)
  from public.chapter_comments c
  where c.book_id = p_book and public.is_visible(c.user_id)
  group by c.chapter
$$;
revoke execute on function public.chapter_room_counts(uuid) from public, anon;
grant execute on function public.chapter_room_counts(uuid) to authenticated;

-- Hearts on room comments reuse reactions.
alter table public.reactions drop constraint reactions_target_type_check;
alter table public.reactions add constraint reactions_target_type_check
  check (target_type in ('entry', 'checkin', 'chapter_comment'));

create or replace function public.set_target_owner()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.target_type = 'entry' then
    select user_id into new.target_owner from public.shelf_entries where id = new.target_id;
  elsif new.target_type = 'checkin' then
    select user_id into new.target_owner from public.reading_checkins where id = new.target_id;
  elsif new.target_type = 'chapter_comment' then
    -- Only readers who can see the comment can heart it.
    select c.user_id into new.target_owner from public.chapter_comments c
      where c.id = new.target_id and (c.user_id = new.user_id or public._in_room(c.book_id, c.chapter));
  end if;
  if new.target_owner is null then
    raise exception 'that post no longer exists';
  end if;
  return new;
end;
$$;
revoke execute on function public.set_target_owner() from public, anon, authenticated;

-- Reports cover room comments too.
alter table public.reports drop constraint reports_target_type_check;
alter table public.reports add constraint reports_target_type_check
  check (target_type in ('comment', 'entry', 'checkin', 'profile', 'chapter_comment'));

-- A reply tells the person you replied to.
alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('reaction', 'comment', 'follow', 'badge', 'mention', 'poke', 'read_along', 'picks', 'ask', 'room'));

create or replace function public._notify_room_reply()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  to_user uuid;
begin
  if new.parent_id is null then
    return new;
  end if;
  select user_id into to_user from public.chapter_comments where id = new.parent_id;
  if to_user is not null and to_user <> new.user_id and not public.is_blocked(to_user, new.user_id) then
    insert into public.notifications (user_id, actor_id, kind, detail, target_type, target_id)
    values (to_user, new.user_id, 'room', 'reply', 'chapter_comment', new.parent_id);
  end if;
  return new;
end;
$$;
revoke execute on function public._notify_room_reply() from public, anon, authenticated;
create trigger chapter_comments_notify after insert on public.chapter_comments
  for each row execute function public._notify_room_reply();
