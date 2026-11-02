-- Reading check-ins: "I read some of this" (optionally with progress).
-- They keep weekly streaks alive without needing to finish a book a week.

create table public.reading_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  book_id uuid not null references public.books (id) on delete cascade,
  checked_on date not null default current_date,
  progress_pct smallint,
  created_at timestamptz not null default now(),
  constraint one_checkin_per_book_per_day unique (user_id, book_id, checked_on),
  constraint progress_range check (progress_pct is null or progress_pct between 0 and 100),
  constraint not_in_future check (checked_on <= current_date + 1)
);

create index reading_checkins_user_day on public.reading_checkins (user_id, checked_on desc);

alter table public.reading_checkins enable row level security;

create policy "check-ins are visible unless private"
  on public.reading_checkins for select to authenticated using (public.is_visible(user_id));
create policy "readers check in as themselves"
  on public.reading_checkins for insert to authenticated with check (auth.uid() = user_id);
create policy "readers update their own check-ins"
  on public.reading_checkins for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "readers remove their own check-ins"
  on public.reading_checkins for delete to authenticated using (auth.uid() = user_id);

-- Latest progress lives on the shelf entry too, for the shelf and feed.
alter table public.shelf_entries
  add column progress_pct smallint,
  add column last_checkin_on date,
  add constraint entry_progress_range check (progress_pct is null or progress_pct between 0 and 100);
