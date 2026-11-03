-- Spine: correct a book's title or author when the catalogue got it wrong.
-- Same rule as genres: the book must be on your shelf, and either nobody else
-- has it or you're the one who corrected it before.

alter table public.books add column details_set_by uuid references auth.users (id) on delete set null;

create or replace function public.fix_book_details(p_book uuid, p_title text, p_author text)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  t text := nullif(btrim(p_title), '');
  a text := nullif(btrim(p_author), '');
begin
  if auth.uid() is null or t is null or char_length(t) > 500 or char_length(coalesce(a, '')) > 300 then
    return false;
  end if;
  update public.books b set title = t, author = a, details_set_by = auth.uid()
    where b.id = p_book
      and exists (select 1 from public.shelf_entries e where e.book_id = p_book and e.user_id = auth.uid())
      and (
        b.details_set_by = auth.uid()
        or not exists (select 1 from public.shelf_entries e where e.book_id = p_book and e.user_id <> auth.uid())
      );
  return found;
end;
$$;

revoke execute on function public.fix_book_details(uuid, text, text) from public, anon;
grant execute on function public.fix_book_details(uuid, text, text) to authenticated;

-- The one that started this: a misspelled Open Library record.
update public.books set title = 'Frankenstein', author = 'Mary Shelley'
  where id = 'd21282cf-81a3-42c6-a01c-ed73f7662722' and title = 'Frankenstei';
