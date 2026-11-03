-- Spine: let readers change a genre they picked by hand.

alter table public.books add column genre_set_by uuid references auth.users (id) on delete set null;

create or replace function public.set_book_genre(p_book uuid, p_genre text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or p_genre not in (
    'literary','scifi','fantasy','mystery','romance','horror','historical','classics','history','memoir','science','poetry'
  ) then
    return false;
  end if;
  -- Only books with no genre yet, or ones you sorted yourself.
  update public.books set genres = array[p_genre], enriched = true, genre_set_by = auth.uid()
    where id = p_book
      and (genres = '{}' or genre_set_by = auth.uid())
      and exists (select 1 from public.shelf_entries e where e.book_id = p_book and e.user_id = auth.uid());
  return found;
end;
$$;
