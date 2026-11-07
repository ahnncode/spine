-- readread: check in by chapter (the default), page, or percent.
--
-- Chapter counts aren't in Open Library or Apple's data in any reliable way,
-- so readers supply them. The first reader to enter a book's chapter count
-- shares it with everyone as a suggestion; each reader keeps their own total
-- on their shelf entry, so a different edition never overwrites anyone.
-- progress_pct stays the common measure (bars, feed, read-alongs): a chapter
-- check-in also saves its percent when the total is known.

alter table public.books
  add column if not exists chapters smallint check (chapters between 1 and 999);

alter table public.shelf_entries
  add column if not exists progress_unit text not null default 'chapter' check (progress_unit in ('chapter', 'page', 'percent')),
  add column if not exists progress_chapter smallint check (progress_chapter between 0 and 999),
  add column if not exists chapter_total smallint check (chapter_total between 1 and 999);

alter table public.reading_checkins
  add column if not exists chapter smallint check (chapter between 0 and 999),
  add column if not exists chapter_total smallint check (chapter_total between 1 and 999);

-- Share a chapter count for a book that doesn't have one yet. Only readers
-- with the book on their shelf can, and only the first answer sticks.
create or replace function public.suggest_book_chapters(p_book uuid, p_chapters integer)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or p_chapters is null or p_chapters < 1 or p_chapters > 999 then
    return false;
  end if;
  update public.books b set chapters = p_chapters
    where b.id = p_book
      and b.chapters is null
      and exists (select 1 from public.shelf_entries e where e.book_id = p_book and e.user_id = auth.uid());
  return found;
end;
$$;
revoke execute on function public.suggest_book_chapters(uuid, integer) from public, anon;
grant execute on function public.suggest_book_chapters(uuid, integer) to authenticated;

-- Books already being tracked by percent keep percent; new books start on chapters.
update public.shelf_entries set progress_unit = 'percent'
  where progress_pct is not null and progress_chapter is null and progress_unit = 'chapter';
