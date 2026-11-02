-- Scores you set yourself for your first few books, and the scoring that
-- fills in around them. Mirrors bucketScores() in src/lib/ranking.ts.

alter table public.shelf_entries
  add column manual_score numeric(3, 1),
  add constraint manual_score_range check (manual_score is null or manual_score between 0 and 10);

-- The view's columns change, so it's rebuilt (the score functions read it by
-- name at run time and keep working).
drop view public.ranked_entries;

create view public.ranked_entries with (security_invoker = true) as
with ordered as (
  select
    e.*,
    row_number() over (partition by e.user_id, e.bucket order by e.sort_key desc) as bucket_pos,
    count(*) over (partition by e.user_id, e.bucket) as bucket_count,
    row_number() over (partition by e.user_id order by e.bucket, e.sort_key desc) as overall_rank,
    case e.bucket when 'loved' then 10.0 when 'fine' then 6.6 else 3.3 end as range_hi,
    case e.bucket when 'loved' then 6.7 when 'fine' then 3.4 else 0.0 end as range_lo
  from public.shelf_entries e
  where e.status = 'ranked'
)
select
  o.id, o.user_id, o.book_id, o.status, o.bucket, o.sort_key, o.needs_sort, o.compare_count,
  o.stars, o.finished_on, o.note, o.source, o.created_at, o.updated_at, o.started_on, o.ranked_at,
  o.progress_pct, o.last_checkin_on, o.manual_score,
  o.bucket_pos, o.bucket_count, o.overall_rank,
  round(
    case
      when o.manual_score is not null then least(o.range_hi, greatest(o.range_lo, o.manual_score))
      else
        -- Straight line between the nearest anchors above and below; the
        -- tier's range ends act as anchors at positions 0 and count + 1.
        coalesce(a.s, o.range_hi)
        + (coalesce(b.s, o.range_lo) - coalesce(a.s, o.range_hi))
          * (o.bucket_pos - coalesce(a.p, 0))::numeric
          / (coalesce(b.p, o.bucket_count + 1) - coalesce(a.p, 0))
    end, 1) as score
from ordered o
left join lateral (
  select x.bucket_pos as p, least(x.range_hi, greatest(x.range_lo, x.manual_score)) as s
  from ordered x
  where x.user_id = o.user_id and x.bucket = o.bucket and x.manual_score is not null and x.bucket_pos < o.bucket_pos
  order by x.bucket_pos desc
  limit 1
) a on true
left join lateral (
  select x.bucket_pos as p, least(x.range_hi, greatest(x.range_lo, x.manual_score)) as s
  from ordered x
  where x.user_id = o.user_id and x.bucket = o.bucket and x.manual_score is not null and x.bucket_pos > o.bucket_pos
  order by x.bucket_pos asc
  limit 1
) b on true;

grant select on public.ranked_entries to authenticated;
revoke all on public.ranked_entries from anon;
