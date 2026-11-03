-- Spine: quiet history for the year-end Wrapped. Nothing here is shown yet;
-- it records how reading unfolds so the Wrap can tell the story later.
-- Both tables are private to their reader.

-- Every shelf change: saved, started, finished, re-ranked, moved back, removed.
create table public.shelf_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  book_id uuid not null references public.books (id) on delete cascade,
  event text not null check (event in ('saved', 'started', 'added_read', 'ranked', 'reranked', 'status', 'removed')),
  from_status text,
  to_status text,
  bucket text,
  source text,
  created_at timestamptz not null default now()
);
create index shelf_events_user_time on public.shelf_events (user_id, created_at);
alter table public.shelf_events enable row level security;
create policy "readers see their own history" on public.shelf_events
  for select to authenticated using (user_id = auth.uid());

create or replace function public.log_shelf_event()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.shelf_events (user_id, book_id, event, to_status, bucket, source)
    values (new.user_id, new.book_id,
      case new.status when 'want' then 'saved' when 'reading' then 'started' when 'unsorted' then 'added_read' else 'ranked' end,
      new.status, new.bucket, new.source);
  elsif tg_op = 'DELETE' then
    -- Deleting an account (or a book) removes its history too; don't log that.
    if not exists (select 1 from auth.users u where u.id = old.user_id)
       or not exists (select 1 from public.books b where b.id = old.book_id) then
      return old;
    end if;
    insert into public.shelf_events (user_id, book_id, event, from_status, bucket)
    values (old.user_id, old.book_id, 'removed', old.status, old.bucket);
    return old;
  elsif new.status is distinct from old.status then
    insert into public.shelf_events (user_id, book_id, event, from_status, to_status, bucket, source)
    values (new.user_id, new.book_id,
      case when new.status = 'ranked' then 'ranked' when new.status = 'reading' and old.status <> 'reading' then 'started' else 'status' end,
      old.status, new.status, new.bucket, new.source);
  elsif new.status = 'ranked' and (new.bucket is distinct from old.bucket or new.ranked_at is distinct from old.ranked_at
                                   or new.manual_score is distinct from old.manual_score) then
    insert into public.shelf_events (user_id, book_id, event, from_status, to_status, bucket, source)
    values (new.user_id, new.book_id, 'reranked', old.bucket, new.bucket, new.bucket, new.source);
  end if;
  return new;
end;
$$;
revoke execute on function public.log_shelf_event() from public, anon, authenticated;
create trigger shelf_entries_log after insert or update or delete on public.shelf_entries
  for each row execute function public.log_shelf_event();

-- Every head-to-head answer: which book won (for "toughest calls" and "undefeated").
create table public.matchups (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  winner_book uuid not null references public.books (id) on delete cascade,
  loser_book uuid not null references public.books (id) on delete cascade,
  tie boolean not null default false,
  context text not null default 'placement' check (context in ('placement', 'sharpen')),
  created_at timestamptz not null default now(),
  check (winner_book <> loser_book)
);
create index matchups_user_time on public.matchups (user_id, created_at);
alter table public.matchups enable row level security;
create policy "readers log their own matchups" on public.matchups
  for insert to authenticated with check (user_id = auth.uid());
create policy "readers see their own matchups" on public.matchups
  for select to authenticated using (user_id = auth.uid());

-- Start the history from what's on shelves today, so this year's Wrap isn't empty.
insert into public.shelf_events (user_id, book_id, event, to_status, bucket, source, created_at)
select e.user_id, e.book_id,
  case e.status when 'want' then 'saved' when 'reading' then 'started' when 'unsorted' then 'added_read' else 'ranked' end,
  e.status, e.bucket, e.source,
  coalesce(case when e.status = 'ranked' then e.ranked_at end, e.created_at)
from public.shelf_entries e;
