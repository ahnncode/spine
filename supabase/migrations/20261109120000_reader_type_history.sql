-- readread: keep every reader type a reader has had, so we can study drift
-- later (how types move as people read more, which letters flip, how fast a
-- type settles). reader_types only holds the latest; this appends a row each
-- time it's saved.
--
-- The app only saves when the type has really moved (a new letter, drive or
-- wing, a new book count, or a spectrum shifting 3+ points), so this stays
-- small: a few rows per reader per month at most.
--
-- Private: readers can read their own history; nobody can write it directly.
-- Rows are filled in by the trigger below.

create table if not exists public.reader_type_history (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  code text not null,
  pcts smallint[] not null,
  drive text not null,
  wing text,
  book_count integer not null,
  recorded_at timestamptz not null default now()
);

create index if not exists reader_type_history_user_time
  on public.reader_type_history (user_id, recorded_at);

alter table public.reader_type_history enable row level security;

drop policy if exists "readers see their own type history" on public.reader_type_history;
create policy "readers see their own type history"
  on public.reader_type_history for select to authenticated using (user_id = auth.uid());

create or replace function public._log_reader_type()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Skip saves that changed nothing (e.g. a retried upsert).
  if tg_op = 'UPDATE'
     and new.code = old.code and new.pcts = old.pcts and new.drive = old.drive
     and new.wing is not distinct from old.wing and new.book_count = old.book_count then
    return new;
  end if;
  insert into public.reader_type_history (user_id, code, pcts, drive, wing, book_count, recorded_at)
  values (new.user_id, new.code, new.pcts, new.drive, new.wing, new.book_count, coalesce(new.updated_at, now()));
  return new;
end;
$$;

revoke all on function public._log_reader_type() from public, anon, authenticated;

drop trigger if exists reader_types_history on public.reader_types;
create trigger reader_types_history
  after insert or update on public.reader_types
  for each row execute function public._log_reader_type();

-- Start everyone's history from the type they have now.
insert into public.reader_type_history (user_id, code, pcts, drive, wing, book_count, recorded_at)
select r.user_id, r.code, r.pcts, r.drive, r.wing, r.book_count, r.updated_at
from public.reader_types r
where not exists (select 1 from public.reader_type_history h where h.user_id = r.user_id);
