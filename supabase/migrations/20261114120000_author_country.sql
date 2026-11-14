-- World passport: which country each book's author is from, and whether the
-- book was translated into English. Looked up by the app (Open Library author
-- → Wikidata) the first time someone has the book, and kept on the catalog
-- book for everyone.

alter table public.books
  add column if not exists author_country text,
  add column if not exists translated boolean,
  add column if not exists country_checked_at timestamptz;

alter table public.books drop constraint if exists books_author_country_valid;
alter table public.books
  add constraint books_author_country_valid check (author_country is null or author_country ~ '^[A-Z]{2}$');

-- Save a lookup. The first answer sticks; a lookup that found nothing only
-- records when it was tried, so the app can try again after a while.
create or replace function public.set_book_country(p_book uuid, p_country text, p_translated boolean default null)
returns void language sql security definer set search_path = public as $$
  update public.books set
    author_country = coalesce(author_country, case when upper(p_country) ~ '^[A-Z]{2}$' then upper(p_country) end),
    translated = coalesce(translated, p_translated),
    country_checked_at = now()
  where id = p_book and auth.uid() is not null;
$$;
revoke execute on function public.set_book_country(uuid, text, boolean) from public, anon;
grant execute on function public.set_book_country(uuid, text, boolean) to authenticated;
