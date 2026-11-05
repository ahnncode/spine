-- readread: read or listened. Each shelf entry says how you took the book in
-- (read, listened, or both), for the headphones mark, "listened to" in the
-- feed, Wrapped's split, and two new badges. Ranking doesn't change.

alter table public.shelf_entries
  add column if not exists format text not null default 'read'
  check (format in ('read', 'listen', 'both'));

-- Same view as before, with format added at the end.
create or replace view public.ranked_entries with (security_invoker = true) as
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
  o.progress_pct, o.last_checkin_on, o.manual_score, o.tags, o.note_spoiler,
  o.bucket_pos, o.bucket_count, o.overall_rank,
  round(
    case
      when o.manual_score is not null then least(o.range_hi, greatest(o.range_lo, o.manual_score))
      else
        coalesce(a.s, o.range_hi)
        + (coalesce(b.s, o.range_lo) - coalesce(a.s, o.range_hi))
          * (o.bucket_pos - coalesce(a.p, 0))::numeric
          / (coalesce(b.p, o.bucket_count + 1) - coalesce(a.p, 0))
    end, 1) as score,
  o.format
from ordered o
left join lateral (
  select x.bucket_pos as p, least(x.range_hi, greatest(x.range_lo, x.manual_score)) as s
  from ordered x
  where x.user_id = o.user_id and x.bucket = o.bucket and x.manual_score is not null and x.bucket_pos < o.bucket_pos
  order by x.bucket_pos desc limit 1
) a on true
left join lateral (
  select x.bucket_pos as p, least(x.range_hi, greatest(x.range_lo, x.manual_score)) as s
  from ordered x
  where x.user_id = o.user_id and x.bucket = o.bucket and x.manual_score is not null and x.bucket_pos > o.bucket_pos
  order by x.bucket_pos asc limit 1
) b on true;

-- Badges: everything as before, plus All Ears and Both Ways.
create or replace function public._award_badges(uid uuid, announce boolean)
returns table (badge_key text, progress numeric, goal numeric, earned timestamptz, fresh boolean)
language plpgsql security definer set search_path = public as $$
declare
  had_any boolean;
  n_ranked int; n_want int; imported boolean; n_pages numeric; max_pages int;
  n_genres int; n_centuries int; old_soul boolean; hot_press boolean; n_authors int;
  n_critic int; best_weeks int; best_days int; goal_hit boolean; every_month boolean;
  n_h2h int; hot_take boolean; twin boolean; n_following int; n_comments int;
  n_referrals int; early boolean; n_clubs int; scrooge boolean;
  leap boolean; spooky boolean; sunk boolean; n_letters int; sitting boolean; goodbye boolean;
  called boolean; meta boolean; poke_run int; meld boolean;
  n_listened int; both_ways boolean;
begin
  if uid is null then
    return;
  end if;
  select exists (select 1 from public.badge_awards a where a.user_id = uid) into had_any;

  select count(*) into n_ranked from public.shelf_entries e where e.user_id = uid and e.status = 'ranked';
  select count(*) into n_want from public.shelf_entries e where e.user_id = uid and e.status = 'want';
  select exists (select 1 from public.shelf_entries e where e.user_id = uid and e.source in ('goodreads', 'storygraph')) into imported;

  select coalesce(sum(b.pages), 0), coalesce(max(b.pages), 0),
         count(distinct floor(b.year / 100.0)) filter (where b.year is not null),
         coalesce(bool_or(b.year < 1900), false),
         coalesce(bool_or(b.year = extract(year from e.finished_on)), false),
         count(distinct lower(b.author)) filter (where b.author is not null),
         count(*) filter (where e.note is not null or cardinality(e.tags) > 0)
    into n_pages, max_pages, n_centuries, old_soul, hot_press, n_authors, n_critic
    from public.shelf_entries e join public.books b on b.id = e.book_id
    where e.user_id = uid and e.status = 'ranked';

  select count(distinct g) into n_genres
    from public.shelf_entries e join public.books b on b.id = e.book_id, unnest(b.genres) g
    where e.user_id = uid and e.status = 'ranked';

  -- Longest run of consecutive weeks with a check-in, a start, or an in-app ranking.
  with acts as (
    select c.checked_on as d from public.reading_checkins c where c.user_id = uid
    union all select e.started_on from public.shelf_entries e where e.user_id = uid and e.started_on is not null
    union all select (e.ranked_at at time zone 'UTC')::date from public.shelf_entries e
      where e.user_id = uid and e.status = 'ranked' and e.source not in ('goodreads', 'storygraph') and e.ranked_at is not null
  ), weeks as (
    select distinct ((d - date '2000-01-03') / 7) as w from acts
  ), runs as (
    select count(*) as len from (select w, w - row_number() over (order by w) as grp from weeks) t group by grp
  )
  select coalesce(max(len), 0) into best_weeks from runs;

  -- Longest run of consecutive days with a check-in.
  with days as (
    select distinct c.checked_on as d from public.reading_checkins c where c.user_id = uid
  ), runs as (
    select count(*) as len from (select d, d - row_number() over (order by d)::int as grp from days) t group by grp
  )
  select coalesce(max(len), 0) into best_days from runs;

  select coalesce(bool_or(cnt >= p.yearly_goal), false) into goal_hit
    from public.profiles p
    left join (
      select extract(year from e.finished_on) as y, count(*) as cnt
      from public.shelf_entries e
      where e.user_id = uid and e.status = 'ranked' and e.finished_on is not null
      group by 1
    ) yr on true
    where p.id = uid and p.yearly_goal is not null;

  select coalesce(bool_or(months = 12), false) into every_month from (
    select extract(year from e.finished_on) as y, count(distinct extract(month from e.finished_on)) as months
    from public.shelf_entries e
    where e.user_id = uid and e.status = 'ranked' and e.finished_on is not null
    group by 1
  ) m;

  select p.head_to_heads, p.created_at < timestamptz '2027-01-01 00:00:00-05'
    into n_h2h, early from public.profiles p where p.id = uid;

  -- A score 3+ points from the community average on a book at least 10 readers ranked.
  select exists (
    select 1
    from public.ranked_entries r
    join (
      select s.book_id, avg(s.score) as a from public._public_scores() s group by s.book_id having count(*) >= 10
    ) c on c.book_id = r.book_id
    where r.user_id = uid and abs(r.score - c.a) >= 3
  ) into hot_take;

  -- Taste matches are computed from the signed-in reader's side, so this one
  -- only updates when you check your own badges.
  if uid = auth.uid() then
    select exists (select 1 from public.similar_readers(500) s where s.match >= 90) into twin;
  else
    twin := false;
  end if;
  select count(*) into n_following from public.follows f where f.follower_id = uid;
  select count(*) into n_comments from public.comments c where c.target_owner = uid and c.user_id <> uid;
  -- Read-alongs finished together (verdict revealed).
  select count(*) into n_clubs from public.read_alongs r
    join public.read_along_members m on m.read_along_id = r.id and m.user_id = uid and m.state = 'joined'
    where r.revealed_at is not null;
  -- Reading on Christmas Day, any year.
  select exists (
    select 1 from public.reading_checkins c
      where c.user_id = uid and extract(month from c.checked_on) = 12 and extract(day from c.checked_on) = 25
    union all
    select 1 from public.shelf_entries e
      where e.user_id = uid and e.source not in ('goodreads', 'storygraph')
        and ((extract(month from e.started_on) = 12 and extract(day from e.started_on) = 25)
          or (e.status = 'ranked' and extract(month from e.finished_on) = 12 and extract(day from e.finished_on) = 25))
  ) into scrooge;
  -- Secret badges -----------------------------------------------------------
  -- Leap Reader: reading on February 29.
  select exists (
    select 1 from public.reading_checkins c
      where c.user_id = uid and extract(month from c.checked_on) = 2 and extract(day from c.checked_on) = 29
    union all
    select 1 from public.shelf_entries e
      where e.user_id = uid and e.source not in ('goodreads', 'storygraph')
        and ((extract(month from e.started_on) = 2 and extract(day from e.started_on) = 29)
          or (e.status = 'ranked' and extract(month from e.finished_on) = 2 and extract(day from e.finished_on) = 29))
  ) into leap;

  select
    -- Trick or Read: finish a horror book on Halloween.
    coalesce(bool_or(e.source not in ('goodreads', 'storygraph') and 'horror' = any (b.genres)
      and extract(month from e.finished_on) = 10 and extract(day from e.finished_on) = 31), false),
    -- Sunk Cost: 500+ pages, then "not for me".
    coalesce(bool_or(e.bucket = 'disliked' and b.pages >= 500), false),
    -- Alphabet Soup: titles starting with every letter (ignoring The/A/An).
    count(distinct upper(left(regexp_replace(b.title, '^(the|a|an)\s+', '', 'i'), 1)))
      filter (where upper(left(regexp_replace(b.title, '^(the|a|an)\s+', '', 'i'), 1)) between 'A' and 'Z'),
    -- One Sitting: start and finish a 400+ page book on the same day.
    coalesce(bool_or(e.source not in ('goodreads', 'storygraph') and b.pages >= 400
      and e.started_on is not null and e.started_on = e.finished_on), false),
    -- The Long Goodbye: finish a year or more after starting.
    coalesce(bool_or(e.source not in ('goodreads', 'storygraph') and e.started_on is not null
      and e.finished_on - e.started_on >= 365), false),
    -- Very Meta: a book about books.
    coalesce(bool_or(b.title ~* '\m(book|books|bookshop|bookstore|bookseller|library|librarian|reader|readers|reading)\M'), false)
    into spooky, sunk, n_letters, sitting, goodbye, meta
    from public.shelf_entries e join public.books b on b.id = e.book_id
    where e.user_id = uid and e.status = 'ranked';

  -- Called It: loved your weekly mystery pick.
  select exists (
    select 1 from public.weekly_picks w
      join public.ranked_entries r on r.user_id = uid and r.book_id = w.book_id and r.bucket = 'loved'
      where w.user_id = uid and w.kind = 'mystery'
  ) into called;

  -- Persistent: poke the same friend 7 days running.
  with runs as (
    select count(*) as len
    from (select to_id, day, day - (row_number() over (partition by to_id order by day))::int as grp
          from public.pokes where from_id = uid) t
    group by to_id, grp
  )
  select coalesce(max(len), 0) into poke_run from runs;

  -- Mind Meld: the same top 3 as someone you follow.
  select n_ranked >= 3 and exists (
    select 1 from public.follows f
    where f.follower_id = uid
      and (select count(*) from public.ranked_entries a
             join public.ranked_entries t on t.book_id = a.book_id and t.user_id = f.followee_id and t.overall_rank <= 3
           where a.user_id = uid and a.overall_rank <= 3) = 3
  ) into meld;

  -- Audiobooks: books you listened to (or both read and listened), and a month
  -- with one of each.
  select count(*) into n_listened from public.shelf_entries e
    where e.user_id = uid and e.status = 'ranked' and e.format in ('listen', 'both');
  select exists (
    select 1 from public.shelf_entries e
    where e.user_id = uid and e.status = 'ranked' and e.finished_on is not null
    group by extract(year from e.finished_on), extract(month from e.finished_on)
    having bool_or(e.format in ('listen', 'both')) and bool_or(e.format in ('read', 'both')) and count(*) >= 2
  ) into both_ways;

  -- Friends who joined with your link and ranked at least 3 books.
  select count(*) into n_referrals from public.profiles p
    where p.referred_by = uid
      and (select count(*) from public.shelf_entries e where e.user_id = p.id and e.status = 'ranked') >= 3;

  return query
  with m(b, v, t) as (
    values
      ('first_chapter',        n_ranked::numeric,                  1::numeric),
      ('moving_in',            imported::int::numeric,             1),
      ('wishlist',             n_want::numeric,                    5),
      ('shelf_starter',        n_ranked::numeric,                  10),
      ('early_adopter',        early::int::numeric,                1),
      ('bookworm',             n_ranked::numeric,                  50),
      ('century',              n_ranked::numeric,                  100),
      ('library_card',         n_ranked::numeric,                  250),
      ('doorstopper',          max_pages::numeric,                 700),
      ('page_turner',          n_pages,                            10000),
      ('long_haul',            n_pages,                            50000),
      ('steady',               best_weeks::numeric,                4),
      ('season_reader',        best_weeks::numeric,                12),
      ('unbroken',             best_weeks::numeric,                52),
      ('daily_pages',          best_days::numeric,                 7),
      ('goal_getter',          goal_hit::int::numeric,             1),
      ('every_month',          every_month::int::numeric,          1),
      ('explorer',             n_genres::numeric,                  5),
      ('full_passport',        n_genres::numeric,                  12),
      ('time_traveler',        n_centuries::numeric,               4),
      ('old_soul',             old_soul::int::numeric,             1),
      ('hot_off_the_press',    hot_press::int::numeric,            1),
      ('many_voices',          n_authors::numeric,                 50),
      ('decisive',             n_h2h::numeric,                     100),
      ('critic',               n_critic::numeric,                  10),
      ('hot_take',             hot_take::int::numeric,             1),
      ('reading_twin',         twin::int::numeric,                 1),
      ('good_company',         n_following::numeric,               10),
      ('conversation_starter', n_comments::numeric,                10),
      ('connector',            n_referrals::numeric,               3),
      ('book_club',            n_clubs::numeric,                   1),
      ('scrooge',              scrooge::int::numeric,              1),
      ('leap_reader',          leap::int::numeric,                 1),
      ('trick_or_read',        spooky::int::numeric,               1),
      ('sunk_cost',            sunk::int::numeric,                 1),
      ('alphabet_soup',        n_letters::numeric,                 26),
      ('one_sitting',          sitting::int::numeric,              1),
      ('long_goodbye',         goodbye::int::numeric,              1),
      ('called_it',            called::int::numeric,               1),
      ('very_meta',            meta::int::numeric,                 1),
      ('persistent',           poke_run::numeric,                  7),
      ('mind_meld',            coalesce(meld, false)::int::numeric, 1),
      ('all_ears',             n_listened::numeric,                10),
      ('both_ways',            coalesce(both_ways, false)::int::numeric, 1)
  ),
  newly as (
    insert into public.badge_awards (user_id, badge)
    select uid, m.b from m where m.v >= m.t
    on conflict (user_id, badge) do nothing
    returning public.badge_awards.badge as b, public.badge_awards.earned_at as at
  ),
  announced as (
    insert into public.notifications (user_id, actor_id, kind, badge)
    select uid, uid, 'badge', n.b from newly n where had_any and announce
    returning 1
  )
  select m.b, m.v, m.t, coalesce(n.at, a.earned_at), n.b is not null and had_any and announce
  from m
  left join newly n on n.b = m.b
  left join public.badge_awards a on a.user_id = uid and a.badge = m.b;
end;
$$;
