-- readread: replace a book's cover when every picture we had for it is
-- broken. Only Apple Books artwork is accepted, and only from someone who has
-- the book on their shelf (the app calls this after the old picture failed).

create or replace function public.repair_book_cover(p_book uuid, p_url text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or p_url !~ '^https://is[0-9]+-ssl\.mzstatic\.com/' or char_length(p_url) > 500 then
    return false;
  end if;
  update public.books b set cover_url = p_url, cover_checked = true
    where b.id = p_book
      and exists (select 1 from public.shelf_entries e where e.book_id = p_book and e.user_id = auth.uid());
  return found;
end;
$$;

revoke all on function public.repair_book_cover(uuid, text) from public, anon;
grant execute on function public.repair_book_cover(uuid, text) to authenticated;
