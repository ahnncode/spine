-- Spine: StoryGraph imports count like Goodreads ones (Moving In badge; their
-- old dates aren't streak activity).

create or replace function public._award_badges(uid uuid, announce boolean)
returns table (badge_key text, progress numeric, goal numeric, earned timestamptz, fresh boolean)
language plpgsql security definer set search_path = public as $$
declare
  had_any boolean;
  n_ranked int; n_want int; imported boolean; n_pages numeric; max_pages int;
  n_genres int; n_centuries int; old_soul boolean; hot_press boolean; n_authors int;
  n_critic int; best_weeks int; best_days int; goal_hit boolean; every_month boolean;
  n_h2h int; hot_take boolean; twin boolean; n_following int; n_comments int;
  n_referrals int; early boolean;
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
      ('connector',            n_referrals::numeric,               3)
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
