-- Covers from Google Books, for Korean books (Apple doesn't sell books in
-- Korea, and Open Library has few Korean covers). REA-69.
alter table public.books drop constraint if exists cover_url_valid;
alter table public.books add constraint cover_url_valid check (
  cover_url is null or (
    char_length(cover_url) <= 400 and (
      cover_url ~ '^https://is[0-9]+-ssl\.mzstatic\.com/image/thumb/'
      or cover_url ~ '^https://books\.google\.com/books/(publisher/)?content\?'
    )
  )
);
