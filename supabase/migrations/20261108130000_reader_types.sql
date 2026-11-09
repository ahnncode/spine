-- readread: each reader's reader type, saved so other people can see it
-- (the pill on profiles, the colour ring around avatars, compare with you).
--
-- The type is worked out in the app from the reader's own shelf, including
-- private history (books given up on), so the result is stored rather than
-- recomputed from what others can see. Visible to anyone who can see the
-- reader (not private, not blocked); only the reader can write their own.

create table if not exists public.reader_types (
  user_id uuid primary key references auth.users (id) on delete cascade,
  code text not null check (code ~ '^[WD][HM][FG][EC]$'),
  -- Range, Lens, Rhythm, Bar: 0–100 toward W, H, F, E.
  pcts smallint[] not null check (array_length(pcts, 1) = 4),
  drive text not null check (drive in ('escape', 'thrill', 'feeling', 'wonder', 'understanding', 'craft')),
  wing text check (wing in ('escape', 'thrill', 'feeling', 'wonder', 'understanding', 'craft')),
  book_count integer not null default 0 check (book_count >= 0),
  updated_at timestamptz not null default now()
);

alter table public.reader_types enable row level security;

drop policy if exists "reader types are visible unless private" on public.reader_types;
create policy "reader types are visible unless private"
  on public.reader_types for select to authenticated using (public.is_visible(user_id));

drop policy if exists "readers save their own type" on public.reader_types;
create policy "readers save their own type"
  on public.reader_types for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "readers update their own type" on public.reader_types;
create policy "readers update their own type"
  on public.reader_types for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "readers remove their own type" on public.reader_types;
create policy "readers remove their own type"
  on public.reader_types for delete to authenticated using (user_id = auth.uid());
