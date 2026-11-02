-- Spine core schema: profiles, a shared book catalog, and each reader's shelf.

create extension if not exists pgcrypto;

-- Profiles ---------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles are readable by signed-in readers"
  on public.profiles for select to authenticated using (true);

create policy "readers update their own profile"
  on public.profiles for update to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, split_part(new.email, '@', 1))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Books (shared catalog) -------------------------------------------------
-- dedupe_key is a normalized "title|author" so the same book coming from a
-- Goodreads import and from Open Library search lands on one row.
create table public.books (
  id uuid primary key default gen_random_uuid(),
  dedupe_key text not null unique,
  title text not null,
  author text,
  isbn13 text,
  ol_work_key text,
  cover_id integer,
  year integer,
  pages integer,
  created_at timestamptz not null default now()
);

alter table public.books enable row level security;

create policy "books are readable by signed-in readers"
  on public.books for select to authenticated using (true);

create policy "signed-in readers can add books"
  on public.books for insert to authenticated with check (true);

-- Shelf entries ----------------------------------------------------------
create type public.shelf_status as enum ('ranked', 'want', 'unsorted');
create type public.shelf_bucket as enum ('loved', 'fine', 'disliked');

create table public.shelf_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  book_id uuid not null references public.books (id) on delete cascade,
  status public.shelf_status not null,
  bucket public.shelf_bucket,
  -- Higher sort_key = ranked higher within its bucket.
  sort_key double precision,
  -- Imported books start roughly ordered by stars; quick matchups refine them.
  needs_sort boolean not null default false,
  compare_count integer not null default 0,
  stars smallint,
  finished_on date,
  note text,
  source text not null default 'app',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, book_id),
  constraint ranked_has_position check (
    status <> 'ranked' or (bucket is not null and sort_key is not null)
  )
);

create index shelf_entries_user_order
  on public.shelf_entries (user_id, status, bucket, sort_key desc);

alter table public.shelf_entries enable row level security;

create policy "readers manage their own shelf"
  on public.shelf_entries for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger shelf_entries_touch
  before update on public.shelf_entries
  for each row execute function public.touch_updated_at();
