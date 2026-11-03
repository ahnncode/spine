-- Spine: backup cover art from Apple Books when Open Library has none.

alter table public.books
  add column cover_url text,
  add column cover_checked boolean not null default false,
  add constraint cover_url_valid check (
    cover_url is null or (char_length(cover_url) <= 400 and cover_url ~ '^https://is[0-9]+-ssl\.mzstatic\.com/image/thumb/')
  );

-- Record a backup cover (or that there isn't one) for a book on your shelf.
create or replace function public.set_book_cover(p_book uuid, p_url text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    return false;
  end if;
  update public.books b set cover_url = coalesce(b.cover_url, p_url), cover_checked = true
    where b.id = p_book
      and b.cover_id is null
      and exists (select 1 from public.shelf_entries e where e.book_id = p_book and e.user_id = auth.uid());
  return found;
end;
$$;

revoke execute on function public.set_book_cover(uuid, text) from public, anon;
grant execute on function public.set_book_cover(uuid, text) to authenticated;
