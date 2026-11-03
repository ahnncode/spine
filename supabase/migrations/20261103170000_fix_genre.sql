-- Spine: fix a wrong genre. Allowed when the book has no genre, you picked it,
-- or nobody else has the book on their shelf (so it only affects you).

create or replace function public.set_book_genre(p_book uuid, p_genre text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or p_genre not in (
    'literary','scifi','fantasy','mystery','romance','horror','historical','classics','history','memoir','science','poetry'
  ) then
    return false;
  end if;
  update public.books b set genres = array[p_genre], enriched = true, genre_set_by = auth.uid()
    where b.id = p_book
      and exists (select 1 from public.shelf_entries e where e.book_id = p_book and e.user_id = auth.uid())
      and (
        b.genres = '{}'
        or b.genre_set_by = auth.uid()
        or not exists (select 1 from public.shelf_entries e where e.book_id = p_book and e.user_id <> auth.uid())
      );
  return found;
end;
$$;
