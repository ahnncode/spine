-- readread: correct a book's year to its first publication. Only ever moves
-- the year earlier (reissues and ebooks carry later dates), and only for
-- someone who has the book on their shelf.

create or replace function public.set_book_year(p_book uuid, p_year int)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or p_year is null or p_year < 1000 or p_year > extract(year from now())::int then
    return false;
  end if;
  update public.books b set year = p_year
    where b.id = p_book
      and (b.year is null or p_year < b.year)
      and exists (select 1 from public.shelf_entries e where e.book_id = p_book and e.user_id = auth.uid());
  return found;
end;
$$;

revoke all on function public.set_book_year(uuid, int) from public, anon;
grant execute on function public.set_book_year(uuid, int) to authenticated;
