-- Similar readers, worked out ahead of time (REA-82).
--
-- similar_readers() compared you with every reader on each call, and
-- predicted_score(), recommendations() and the Twin badge all call it. Now
-- each reader's closest matches are kept in reader_similarity:
--
--   - after someone ranks, their matches are refreshed within a minute or two
--     (a queue, emptied every minute by pg_cron);
--   - every night everyone is refreshed, so matches also move when the
--     *other* reader ranks more books.
--
-- Until a reader's first refresh, similar_readers() works it out live, as
-- before, so nobody sees an empty list while they wait.
--
-- Needs 20261114120000_stored_scores.sql (entry_scores) to have run first.
-- Run this whole file once in the Supabase SQL Editor.

-- ---------------------------------------------------------------------------
-- Tables

create table if not exists public.reader_similarity (
  user_id uuid not null references auth.users (id) on delete cascade,
  other_id uuid not null references auth.users (id) on delete cascade,
  match integer not null,
  overlap integer not null,
  primary key (user_id, other_id)
);
create index if not exists reader_similarity_best on public.reader_similarity (user_id, match desc, overlap desc);

-- When each reader's matches were last worked out (also marks "has been done",
-- so someone with no matches at all isn't recomputed live on every call).
create table if not exists public.similarity_computed (
  user_id uuid primary key references auth.users (id) on delete cascade,
  computed_at timestamptz not null default now()
);

-- Readers whose matches need refreshing.
create table if not exists public.similarity_queue (
  user_id uuid primary key references auth.users (id) on delete cascade,
  queued_at timestamptz not null default now()
);

-- Only the functions below touch these.
alter table public.reader_similarity enable row level security;
alter table public.similarity_computed enable row level security;
alter table public.similarity_queue enable row level security;
revoke all on public.reader_similarity, public.similarity_computed, public.similarity_queue from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Working out matches

-- The 300 closest public readers for each of these readers, with at least 3
-- books in common. Same formula as before: 100 minus 15 per point of average
-- difference. Blocks are applied when reading, since they depend on who asks.
create or replace function public._compute_similarity(p_users uuid[])
returns void language sql security definer set search_path = public as $$
  delete from public.reader_similarity where user_id = any (p_users);

  insert into public.reader_similarity (user_id, other_id, match, overlap)
  with mine as (
    select s.user_id, s.book_id, s.score
    from public.entry_scores s
    where s.user_id = any (p_users)
  ), pairs as (
    select m.user_id, s.user_id as other_id, count(*) as overlap,
           greatest(0, least(100, round(100 - 15 * avg(abs(s.score - m.score)))))::int as match
    from mine m
    join public.entry_scores s on s.book_id = m.book_id and s.user_id <> m.user_id
    join public.profiles p on p.id = s.user_id and not p.is_private
    group by m.user_id, s.user_id
    having count(*) >= 3
  ), ranked as (
    select *, row_number() over (partition by user_id order by match desc, overlap desc, other_id) as rn
    from pairs
  )
  select user_id, other_id, match, overlap from ranked where rn <= 300;

  insert into public.similarity_computed (user_id, computed_at)
  select distinct u, now() from unnest(p_users) u where u is not null
  on conflict (user_id) do update set computed_at = excluded.computed_at;
$$;
revoke execute on function public._compute_similarity(uuid[]) from public, anon, authenticated;

-- Work through the queue for up to about 40 seconds, 50 readers at a time.
-- Run every minute by pg_cron; a second copy that starts while one is still
-- running steps aside.
create or replace function public.process_similarity_queue()
returns integer language plpgsql security definer set search_path = public as $$
declare
  batch uuid[];
  done integer := 0;
  started timestamptz := clock_timestamp();
begin
  if not pg_try_advisory_xact_lock(84212) then
    return 0;
  end if;
  loop
    select array_agg(user_id) into batch
    from (
      select q.user_id from public.similarity_queue q
      order by q.queued_at
      limit 50
      for update skip locked
    ) picked;
    exit when batch is null;

    delete from public.similarity_queue where user_id = any (batch);
    perform public._compute_similarity(batch);
    done := done + cardinality(batch);

    exit when clock_timestamp() - started > interval '40 seconds';
  end loop;
  return done;
end;
$$;
revoke execute on function public.process_similarity_queue() from public, anon, authenticated;

-- Put everyone with ranked books in the queue (nightly).
create or replace function public.queue_all_similarity()
returns integer language sql security definer set search_path = public as $$
  with added as (
    insert into public.similarity_queue (user_id)
    select distinct s.user_id from public.entry_scores s
    on conflict (user_id) do nothing
    returning 1
  )
  select count(*)::int from added;
$$;
revoke execute on function public.queue_all_similarity() from public, anon, authenticated;

-- Readers who just ranked go in the queue. Hooked into the score recompute
-- from 20261114120000_stored_scores.sql, which runs whenever a ranked shelf
-- changes.
create or replace function public._queue_similarity_after_scores()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.similarity_queue (user_id)
  select distinct user_id from new_rows
  on conflict (user_id) do nothing;
  return null;
end;
$$;
revoke execute on function public._queue_similarity_after_scores() from public, anon, authenticated;

drop trigger if exists entry_scores_queue_similarity on public.entry_scores;
create trigger entry_scores_queue_similarity
  after insert on public.entry_scores
  referencing new table as new_rows
  for each statement execute function public._queue_similarity_after_scores();

-- ---------------------------------------------------------------------------
-- Reading matches

-- Same signature and results as before. Reads stored matches; works them out
-- live only for a reader who hasn't had a first refresh yet.
create or replace function public.similar_readers(p_limit integer default 50)
returns table (user_id uuid, match integer, overlap integer)
language sql stable security definer set search_path = public as $$
  with done as (
    select exists (select 1 from public.similarity_computed c where c.user_id = auth.uid()) as yes
  ), stored as (
    select rs.other_id as user_id, rs.match, rs.overlap
    from public.reader_similarity rs
    join public.profiles p on p.id = rs.other_id
    where (select yes from done)
      and rs.user_id = auth.uid()
      and not p.is_private
      and not public.is_blocked(rs.other_id, auth.uid())
  ), mine as (
    select book_id, score from public._public_scores()
    where user_id = auth.uid() and not (select yes from done)
  ), live as (
    select s.user_id, greatest(0, least(100, round(100 - 15 * avg(abs(s.score - m.score)))))::int as match,
           count(*)::int as overlap
    from public._public_scores() s
    join mine m on m.book_id = s.book_id
    where s.user_id <> auth.uid()
    group by s.user_id
    having count(*) >= 3
  )
  select * from (select * from stored union all select * from live) x
  order by match desc, overlap desc
  limit p_limit;
$$;

-- ---------------------------------------------------------------------------
-- Schedules

create extension if not exists pg_cron;
select cron.unschedule(jobid) from cron.job where jobname in ('similarity-queue', 'similarity-nightly');
-- Every minute: refresh readers who just ranked.
select cron.schedule('similarity-queue', '* * * * *', 'select public.process_similarity_queue()');
-- Every night at 08:20 UTC (1:20am Mountain, 3:20am Eastern): queue everyone.
select cron.schedule('similarity-nightly', '20 8 * * *', 'select public.queue_all_similarity()');

-- First fill: queue everyone now; the every-minute job works through it.
select public.queue_all_similarity();
