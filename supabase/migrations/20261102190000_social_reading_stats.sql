-- Spine, part 2: currently reading, genres, profiles & follows, privacy-aware
-- sharing, and the score functions behind community scores, taste match,
-- predicted scores and recommendations.

-- Shelf status becomes text so new states (like 'reading') can be added in
-- the same migration that uses them.
alter table public.shelf_entries drop constraint ranked_has_position;
alter table public.shelf_entries alter column status type text using status::text;
drop type public.shelf_status;
alter table public.shelf_entries
  add constraint shelf_status_valid check (status in ('ranked', 'want', 'unsorted', 'reading')),
  add constraint ranked_has_position check (status <> 'ranked' or (bucket is not null and sort_key is not null));

alter table public.shelf_entries
  add column started_on date,
  add column ranked_at timestamptz;

update public.shelf_entries set ranked_at = created_at where status = 'ranked' and ranked_at is null;

-- Books: genres derived from Open Library subjects, filled in over time.
alter table public.books
  add column genres text[] not null default '{}',
  add column enriched boolean not null default false;

-- Profiles: handle, privacy and reading goal.
alter table public.profiles
  add column username text,
  add column is_private boolean not null default false,
  add column yearly_goal integer,
  add constraint username_format check (username is null or username ~ '^[a-z0-9_]{3,20}$'),
  add constraint yearly_goal_range check (yearly_goal is null or yearly_goal between 1 and 1000);

create unique index profiles_username_key on public.profiles (username);

-- Follows (one-way, no approval) --------------------------------------------
create table public.follows (
  follower_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  followee_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  constraint no_self_follow check (follower_id <> followee_id)
);

create index follows_followee on public.follows (followee_id);

alter table public.follows enable row level security;

create policy "follows are visible to signed-in readers"
  on public.follows for select to authenticated using (true);
create policy "readers follow as themselves"
  on public.follows for insert to authenticated with check (follower_id = auth.uid());
create policy "readers unfollow as themselves"
  on public.follows for delete to authenticated using (follower_id = auth.uid());

-- Who can see whose shelf ----------------------------------------------------
create or replace function public.is_visible(owner uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select owner = auth.uid()
      or coalesce((select not p.is_private from public.profiles p where p.id = owner), true);
$$;

drop policy "readers manage their own shelf" on public.shelf_entries;

create policy "shelves are visible unless private"
  on public.shelf_entries for select to authenticated using (public.is_visible(user_id));
create policy "readers add to their own shelf"
  on public.shelf_entries for insert to authenticated with check (auth.uid() = user_id);
create policy "readers change their own shelf"
  on public.shelf_entries for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "readers remove from their own shelf"
  on public.shelf_entries for delete to authenticated using (auth.uid() = user_id);

-- Scores ---------------------------------------------------------------------
-- Mirrors src/lib/ranking.ts: the best book in a bucket gets the top of the
-- bucket's range and the rest spread evenly down it.
create or replace view public.ranked_entries with (security_invoker = true) as
with ordered as (
  select
    e.*,
    row_number() over (partition by e.user_id, e.bucket order by e.sort_key desc) as bucket_pos,
    count(*) over (partition by e.user_id, e.bucket) as bucket_count,
    row_number() over (partition by e.user_id order by e.bucket, e.sort_key desc) as overall_rank
  from public.shelf_entries e
  where e.status = 'ranked'
)
select
  o.*,
  round((
    case o.bucket when 'loved' then 10.0 when 'fine' then 6.6 else 3.3 end
    - (o.bucket_pos - 1) *
      (case o.bucket when 'loved' then 3.3 when 'fine' then 3.2 else 3.3 end) / o.bucket_count
  )::numeric, 1) as score
from ordered o;

-- Internal: scores for every public reader (bypasses row security, so only
-- the aggregate functions below use it).
create or replace function public._public_scores()
returns table (user_id uuid, book_id uuid, score numeric)
language sql stable security definer set search_path = public as $$
  select r.user_id, r.book_id, r.score
  from public.ranked_entries r
  join public.profiles p on p.id = r.user_id
  where not p.is_private or r.user_id = auth.uid();
$$;
revoke all on function public._public_scores() from public, anon, authenticated;

-- Community score for one book.
create or replace function public.book_stats(p_book uuid)
returns table (avg_score numeric, readers integer)
language sql stable security definer set search_path = public as $$
  select round(avg(s.score), 1), count(*)::int
  from public._public_scores() s
  where s.book_id = p_book;
$$;

-- How closely the signed-in reader agrees with each given reader, from the
-- books both have ranked. 100 = identical scores; each point of average
-- disagreement costs 15. Needs 3+ shared books.
create or replace function public.taste_matches(p_users uuid[])
returns table (user_id uuid, match integer, overlap integer)
language sql stable security definer set search_path = public as $$
  with mine as (
    select book_id, score from public._public_scores() where user_id = auth.uid()
  ), theirs as (
    select s.user_id, s.book_id, s.score
    from public._public_scores() s
    where s.user_id = any (p_users) and s.user_id <> auth.uid()
  )
  select t.user_id,
         case when count(*) >= 3
              then greatest(0, least(100, round(100 - 15 * avg(abs(t.score - m.score)))))::int
         end,
         count(*)::int
  from theirs t
  join mine m on m.book_id = t.book_id
  group by t.user_id;
$$;

-- Readers similar to the signed-in reader, best match first.
create or replace function public.similar_readers(p_limit integer default 50)
returns table (user_id uuid, match integer, overlap integer)
language sql stable security definer set search_path = public as $$
  with mine as (
    select book_id, score from public._public_scores() where user_id = auth.uid()
  ), pairs as (
    select s.user_id, count(*) as overlap, avg(abs(s.score - m.score)) as diff
    from public._public_scores() s
    join mine m on m.book_id = s.book_id
    where s.user_id <> auth.uid()
    group by s.user_id
    having count(*) >= 3
  )
  select user_id, greatest(0, least(100, round(100 - 15 * diff)))::int, overlap::int
  from pairs
  order by 2 desc, 3 desc
  limit p_limit;
$$;

-- What the signed-in reader would probably score a book, weighted toward
-- readers who rank like them.
create or replace function public.predicted_score(p_book uuid)
returns table (predicted numeric, basis integer)
language sql stable security definer set search_path = public as $$
  with sim as (
    select * from public.similar_readers(500) where match > 40
  ), votes as (
    select s.score, power(sim.match - 40, 2) as w
    from public._public_scores() s
    join sim on sim.user_id = s.user_id
    where s.book_id = p_book
  )
  select case when count(*) > 0 then round((sum(score * w) / sum(w))::numeric, 1) end, count(*)::int
  from votes;
$$;

-- Books readers like you loved that aren't on your shelf yet.
create or replace function public.recommendations(p_limit integer default 20)
returns table (book_id uuid, predicted numeric, basis integer)
language sql stable security definer set search_path = public as $$
  with sim as (
    select * from public.similar_readers(500) where match > 40
  ), votes as (
    select s.book_id, s.score, power(sim.match - 40, 2) as w
    from public._public_scores() s
    join sim on sim.user_id = s.user_id
    where s.score >= 6.7
      and not exists (
        select 1 from public.shelf_entries e
        where e.user_id = auth.uid() and e.book_id = s.book_id
      )
  )
  select book_id, round((sum(score * w) / sum(w))::numeric, 1), count(*)::int
  from votes
  group by book_id
  order by 2 desc, 3 desc
  limit p_limit;
$$;

-- Fill in missing details on a catalog book (cover, genres, year) without
-- letting anyone overwrite what's already there.
create or replace function public.enrich_book(
  p_book uuid, p_cover integer, p_genres text[], p_year integer, p_pages integer, p_work text
) returns void language sql security definer set search_path = public as $$
  update public.books set
    cover_id = coalesce(cover_id, p_cover),
    genres = case when genres = '{}' then coalesce(p_genres, '{}') else genres end,
    year = coalesce(year, p_year),
    pages = coalesce(pages, p_pages),
    ol_work_key = coalesce(ol_work_key, p_work),
    enriched = true
  where id = p_book;
$$;

grant execute on function
  public.book_stats(uuid),
  public.taste_matches(uuid[]),
  public.similar_readers(integer),
  public.predicted_score(uuid),
  public.recommendations(integer),
  public.enrich_book(uuid, integer, text[], integer, integer, text)
to authenticated;

revoke execute on function
  public.book_stats(uuid),
  public.taste_matches(uuid[]),
  public.similar_readers(integer),
  public.predicted_score(uuid),
  public.recommendations(integer),
  public.enrich_book(uuid, integer, text[], integer, integer, text)
from anon;
