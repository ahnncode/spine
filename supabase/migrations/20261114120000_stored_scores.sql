-- Stored scores (REA-81).
--
-- Until now every score was worked out on read: ranked_entries ran window
-- functions over every ranked shelf entry, and _public_scores() (behind taste
-- match, predicted scores and recommendations) read it for every public reader
-- on every call. That cost grows with the whole app, per page view.
--
-- Now each reader's positions and scores are worked out when their ranked
-- shelf changes and kept in entry_scores. The maths is the same as before (and
-- as src/lib/ranking.ts). ranked_entries keeps the same columns, so the app
-- needs no changes.
--
-- Run this whole file once in the Supabase SQL Editor. It backfills every
-- reader at the end.

create table if not exists public.entry_scores (
  entry_id uuid primary key references public.shelf_entries (id) on delete cascade,
  user_id uuid not null,
  book_id uuid not null,
  bucket_pos integer not null,
  bucket_count integer not null,
  overall_rank integer not null,
  score numeric not null
);

create index if not exists entry_scores_user on public.entry_scores (user_id, overall_rank);
create index if not exists entry_scores_book on public.entry_scores (book_id);

-- Same visibility as the shelf itself. Only the view and the functions below
-- read it; nobody writes to it but the recompute function.
alter table public.entry_scores enable row level security;
drop policy if exists "scores follow shelf visibility" on public.entry_scores;
create policy "scores follow shelf visibility"
  on public.entry_scores for select to authenticated using (public.is_visible(user_id));
revoke all on public.entry_scores from public, anon, authenticated;
grant select on public.entry_scores to authenticated;

-- Work out positions and scores for some readers' ranked shelves.
create or replace function public._recompute_scores(p_users uuid[])
returns void language plpgsql security definer set search_path = public as $$
declare
  slot integer;
begin
  -- One recompute per reader at a time. Readers share 128 lock slots, taken in
  -- a fixed order, so two recomputes can't deadlock and a backfill of every
  -- reader holds at most 128 locks.
  for slot in
    select distinct abs(hashtext(x::text)) % 128 from unnest(p_users) x where x is not null order by 1
  loop
    perform pg_advisory_xact_lock(84211, slot);
  end loop;

  delete from public.entry_scores where user_id = any (p_users);

  -- Anchors (books with a hand-set score) are found with window functions and
  -- joined by position, so the cost stays linear in the shelf's size.
  insert into public.entry_scores (entry_id, user_id, book_id, bucket_pos, bucket_count, overall_rank, score)
  with ordered as (
    select
      e.id, e.user_id, e.book_id, e.bucket, e.manual_score,
      row_number() over (partition by e.user_id, e.bucket order by e.sort_key desc, e.id) as bucket_pos,
      count(*) over (partition by e.user_id, e.bucket) as bucket_count,
      row_number() over (partition by e.user_id order by e.bucket, e.sort_key desc, e.id) as overall_rank,
      case e.bucket when 'loved' then 10.0 when 'fine' then 6.6 else 3.3 end as range_hi,
      case e.bucket when 'loved' then 6.7 when 'fine' then 3.4 else 0.0 end as range_lo
    from public.shelf_entries e
    where e.status = 'ranked' and e.user_id = any (p_users)
  ), anchored as (
    select o.*,
      case when o.manual_score is not null then least(o.range_hi, greatest(o.range_lo, o.manual_score)) end as anchor_s,
      max(case when o.manual_score is not null then o.bucket_pos end) over (
        partition by o.user_id, o.bucket order by o.bucket_pos rows between unbounded preceding and 1 preceding) as a_p,
      min(case when o.manual_score is not null then o.bucket_pos end) over (
        partition by o.user_id, o.bucket order by o.bucket_pos rows between 1 following and unbounded following) as b_p
    from ordered o
  )
  select
    o.id, o.user_id, o.book_id, o.bucket_pos, o.bucket_count, o.overall_rank,
    round(
      case
        when o.manual_score is not null then o.anchor_s
        else
          coalesce(a.anchor_s, o.range_hi)
          + (coalesce(b.anchor_s, o.range_lo) - coalesce(a.anchor_s, o.range_hi))
            * (o.bucket_pos - coalesce(o.a_p, 0))::numeric
            / (coalesce(o.b_p, o.bucket_count + 1) - coalesce(o.a_p, 0))
      end, 1)
  from anchored o
  left join anchored a on a.user_id = o.user_id and a.bucket = o.bucket and a.bucket_pos = o.a_p
  left join anchored b on b.user_id = o.user_id and b.bucket = o.bucket and b.bucket_pos = o.b_p;
end;
$$;

revoke execute on function public._recompute_scores(uuid[]) from public, anon, authenticated;

-- Keep scores current. Statement-level, so a 1,500-book import recomputes
-- each reader once rather than once per row.
create or replace function public._scores_after_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public._recompute_scores(array(
    select distinct user_id from new_rows where status = 'ranked'
  ));
  return null;
end;
$$;

create or replace function public._scores_after_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Only changes that move a ranking: notes, dates, progress and the like don't.
  perform public._recompute_scores(array(
    select distinct n.user_id
    from new_rows n join old_rows o on o.id = n.id
    where (n.status = 'ranked' or o.status = 'ranked')
      and (n.status, n.bucket, n.sort_key, n.manual_score, n.user_id)
          is distinct from (o.status, o.bucket, o.sort_key, o.manual_score, o.user_id)
    union
    select o.user_id
    from new_rows n join old_rows o on o.id = n.id
    where o.status = 'ranked' and o.user_id is distinct from n.user_id
  ));
  return null;
end;
$$;

create or replace function public._scores_after_delete()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- The deleted rows' scores go with them (on delete cascade); the rest of
  -- that reader's shelf moves up.
  perform public._recompute_scores(array(
    select distinct user_id from old_rows where status = 'ranked'
  ));
  return null;
end;
$$;

revoke execute on function public._scores_after_insert() from public, anon, authenticated;
revoke execute on function public._scores_after_update() from public, anon, authenticated;
revoke execute on function public._scores_after_delete() from public, anon, authenticated;

drop trigger if exists shelf_entries_scores_insert on public.shelf_entries;
drop trigger if exists shelf_entries_scores_update on public.shelf_entries;
drop trigger if exists shelf_entries_scores_delete on public.shelf_entries;

create trigger shelf_entries_scores_insert
  after insert on public.shelf_entries
  referencing new table as new_rows
  for each statement execute function public._scores_after_insert();

create trigger shelf_entries_scores_update
  after update on public.shelf_entries
  referencing new table as new_rows old table as old_rows
  for each statement execute function public._scores_after_update();

create trigger shelf_entries_scores_delete
  after delete on public.shelf_entries
  referencing old table as old_rows
  for each statement execute function public._scores_after_delete();

-- Same columns, same order as before; scores now come from entry_scores.
create or replace view public.ranked_entries with (security_invoker = true) as
select
  e.id, e.user_id, e.book_id, e.status, e.bucket, e.sort_key, e.needs_sort, e.compare_count,
  e.stars, e.finished_on, e.note, e.source, e.created_at, e.updated_at, e.started_on, e.ranked_at,
  e.progress_pct, e.last_checkin_on, e.manual_score, e.tags, e.note_spoiler,
  s.bucket_pos::bigint as bucket_pos, s.bucket_count::bigint as bucket_count, s.overall_rank::bigint as overall_rank,
  s.score,
  e.format
from public.shelf_entries e
join public.entry_scores s on s.entry_id = e.id
where e.status = 'ranked';

-- The aggregate functions read stored scores directly instead of the view.
-- Not security definer (and no search_path setting) on purpose: that lets
-- Postgres inline it into its callers, so "where book_id = X" in book_stats
-- uses the book index instead of reading every score. Its only callers are
-- security-definer functions, so it still runs with their rights, and
-- nobody else may call it.
create or replace function public._public_scores()
returns table (user_id uuid, book_id uuid, score numeric)
language sql stable as $$
  select s.user_id, s.book_id, s.score
  from public.entry_scores s
  join public.profiles p on p.id = s.user_id
  where (not p.is_private or s.user_id = auth.uid())
    and not exists (
      select 1 from public.blocks bl
      where (bl.blocker_id = s.user_id and bl.blocked_id = auth.uid())
         or (bl.blocker_id = auth.uid() and bl.blocked_id = s.user_id)
    );
$$;
revoke all on function public._public_scores() from public, anon, authenticated;

-- Backfill every reader with a ranked book.
select public._recompute_scores(array(
  select distinct user_id from public.shelf_entries where status = 'ranked'
));
