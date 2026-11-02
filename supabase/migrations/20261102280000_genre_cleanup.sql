-- Spine: better genre matching, and a way to fill in genres Open Library doesn't know.

-- 1. Genres were matched too loosely (e.g. a "Science fiction, fantasy, horror"
--    bookstore tag made Percy Jackson horror; "American literature" made modern
--    novels classics). Clear them so the app re-reads each book with the new rules.
--    Covers, years and page counts are kept.
update public.books set genres = '{}', enriched = false;

-- 2. Readers can pick a genre for a book on their shelf that has none.
create or replace function public.set_book_genre(p_book uuid, p_genre text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or p_genre not in (
    'literary','scifi','fantasy','mystery','romance','horror','historical','classics','history','memoir','science','poetry'
  ) then
    return false;
  end if;
  update public.books set genres = array[p_genre], enriched = true
    where id = p_book
      and genres = '{}'
      and exists (select 1 from public.shelf_entries e where e.book_id = p_book and e.user_id = auth.uid());
  return found;
end;
$$;

revoke execute on function public.set_book_genre(uuid, text) from public, anon;
grant execute on function public.set_book_genre(uuid, text) to authenticated;
