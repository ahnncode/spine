-- Spine: replace author names stored in another script (村上春樹) with their
-- English spelling (Haruki Murakami). Only for books on your shelf, only when
-- the stored name isn't in the Latin alphabet, and only with a Latin name.
create or replace function public.set_book_author(p_book uuid, p_author text)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  a text := nullif(btrim(p_author), '');
begin
  if auth.uid() is null or a is null or char_length(a) > 300
     or a ~ '[^\u0000-ɏḀ-ỿ -⁯]' then
    return false;
  end if;
  update public.books b set author = a
    where b.id = p_book
      and b.author ~ '[^\u0000-ɏḀ-ỿ -⁯]'
      and exists (select 1 from public.shelf_entries e where e.book_id = p_book and e.user_id = auth.uid());
  return found;
end;
$$;
revoke execute on function public.set_book_author(uuid, text) from public, anon;
grant execute on function public.set_book_author(uuid, text) to authenticated;
