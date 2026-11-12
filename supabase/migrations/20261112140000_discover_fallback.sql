-- Discover for new readers (REA-29). Picks from readers who rank like you come
-- first. While there aren't enough of those, the rest of the list is filled
-- with books readers loved in the genres you love, then the best-loved books
-- on readread. As real matches appear they push the fallbacks out.
--
-- New columns: source ('match' | 'genre' | 'loved') and genre (for 'genre').
-- For fallbacks, predicted is the readers' average, not a prediction for you.

drop function if exists public.recommendations(integer);

create function public.recommendations(p_limit integer default 20)
returns table (book_id uuid, predicted numeric, basis integer, source text, genre text)
language sql stable security definer set search_path = public as $$
  with mine as (
    select e.book_id from public.shelf_entries e where e.user_id = auth.uid()
  ),
  -- 1. Loved by readers who rank like you.
  sim as (
    select * from public.similar_readers(500) where match > 40
  ),
  votes as (
    select s.book_id, s.score, power(sim.match - 40, 2) as w
    from public._public_scores() s
    join sim on sim.user_id = s.user_id
    where s.score >= 6.7
      and s.book_id not in (select book_id from mine)
  ),
  matched as (
    select v.book_id, round((sum(v.score * v.w) / sum(v.w))::numeric, 1) as predicted,
           count(*)::int as basis
    from votes v
    group by v.book_id
  ),
  -- Everyone else's scores, for the fallbacks.
  community as (
    select s.book_id, avg(s.score) as avg_score, count(*)::int as readers
    from public._public_scores() s
    where s.user_id is distinct from auth.uid()
      and s.book_id not in (select book_id from mine)
      and s.book_id not in (select book_id from matched)
    group by s.book_id
    having avg(s.score) >= 7
  ),
  -- 2. The genres of the books you ranked highest, most common first.
  fav as (
    select g, count(*) as n
    from public.ranked_entries r
    join public.books b on b.id = r.book_id, unnest(b.genres) g
    where r.user_id = auth.uid() and r.score >= 6.7
    group by g
  ),
  by_genre as (
    select distinct on (c.book_id) c.book_id, c.avg_score, c.readers, f.g, f.n
    from community c
    join public.books b on b.id = c.book_id
    join fav f on f.g = any (b.genres)
    order by c.book_id, f.n desc
  ),
  picks as (
    select m.book_id, m.predicted, m.basis, 'match'::text as source, null::text as genre,
           1 as tier, m.predicted as k1, m.basis::numeric as k2
    from matched m
    union all
    select bg.book_id, round(bg.avg_score::numeric, 1), bg.readers, 'genre', bg.g,
           2, bg.n::numeric, bg.avg_score + least(bg.readers, 5) * 0.1
    from by_genre bg
    union all
    -- 3. The best-loved books on readread, steadied by how many readers agree.
    select c.book_id, round(c.avg_score::numeric, 1), c.readers, 'loved', null,
           3, c.avg_score + least(c.readers, 5) * 0.1, c.readers::numeric
    from community c
    where c.book_id not in (select book_id from by_genre)
  )
  select p.book_id, p.predicted, p.basis, p.source, p.genre
  from picks p
  order by p.tier, p.k1 desc, p.k2 desc
  limit greatest(1, least(p_limit, 50));
$$;

revoke all on function public.recommendations(integer) from public, anon;
grant execute on function public.recommendations(integer) to authenticated;
