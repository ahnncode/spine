-- Spine: backup covers also for books whose Open Library cover is listed but empty.
create or replace function public.set_book_cover(p_book uuid, p_url text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    return false;
  end if;
  update public.books b set cover_url = coalesce(b.cover_url, p_url), cover_checked = true
    where b.id = p_book
      and exists (select 1 from public.shelf_entries e where e.book_id = p_book and e.user_id = auth.uid());
  return found;
end;
$$;

-- Look again at every book still without a backup cover, with the new check.
update public.books set cover_checked = false where cover_url is null;
