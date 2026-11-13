-- Growth numbers for the founder (REA-76): signups, weekly active rankers,
-- D7/D30 retention, imports and invites, week by week. Admins only.

-- Accounts that shouldn't count: the demo account, test accounts. Admins are
-- always left out too. No policies: only the functions below read it.
create table if not exists public.internal_accounts (
  user_id uuid primary key references auth.users (id) on delete cascade,
  note text,
  added_at timestamptz not null default now()
);
alter table public.internal_accounts enable row level security;
revoke all on public.internal_accounts from anon, authenticated;

create or replace function public.is_internal(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins a where a.user_id = p_user)
      or exists (select 1 from public.internal_accounts i where i.user_id = p_user)
$$;
revoke execute on function public.is_internal(uuid) from public, anon, authenticated;

-- Anything a reader does in the app, with when they did it.
create or replace function public.growth_activity()
returns table (user_id uuid, at timestamptz, ranking boolean)
language sql stable security definer set search_path = public as $$
  select m.user_id, m.created_at, true from public.matchups m
  union all
  -- An import inserting books isn't the reader ranking anything; a quick-rate
  -- or a placement after the import is.
  select e.user_id, e.created_at,
         (e.event = 'reranked' or (e.event = 'ranked' and (e.from_status is not null or coalesce(e.source, 'app') not in ('goodreads', 'storygraph'))))
  from public.shelf_events e
  union all select r.user_id, r.created_at, false from public.reactions r
  union all select c.user_id, c.created_at, false from public.comments c
  union all select k.user_id, k.created_at, false from public.reading_checkins k
  union all select f.follower_id, f.created_at, false from public.follows f
$$;
revoke execute on function public.growth_activity() from public, anon, authenticated;

-- One row per week (Monday to Sunday, UTC), newest first.
--   signups            new accounts that week
--   signups_invited    of those, joined through someone's invite link
--   signups_outside    of those, not invited and didn't follow you in their first 3 days
--                      (a rough count of people who don't know you)
--   active_rankers     did at least one matchup, placement or quick-rate that week
--   active_readers     did anything at all that week
--   matchups           head-to-heads that week
--   importers          readers who imported a Goodreads or StoryGraph library that week
--   imported_books     books those imports brought in
--   d7_cohort/d7_back  signups that week old enough to judge, and how many were
--                      active again 7-13 days after signing up
--   d30_cohort/d30_back  the same for 30-36 days after signing up
create or replace function public.admin_growth(p_weeks integer default 12)
returns table (
  week_start date,
  partial boolean,
  signups integer,
  signups_invited integer,
  signups_outside integer,
  active_rankers integer,
  active_readers integer,
  matchups integer,
  importers integer,
  imported_books integer,
  d7_cohort integer,
  d7_back integer,
  d30_cohort integer,
  d30_back integer
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can see growth numbers' using errcode = '42501';
  end if;

  return query
  with weeks as (
    select w::date as ws
    from generate_series(date_trunc('week', now()) - make_interval(weeks => greatest(least(p_weeks, 104), 1) - 1),
                         date_trunc('week', now()), interval '1 week') w
  ),
  real_users as (
    select p.id, p.created_at, p.referred_by
    from public.profiles p
    where not public.is_internal(p.id)
  ),
  act as (
    select a.user_id, a.at, a.ranking
    from public.growth_activity() a
    join real_users u on u.id = a.user_id
  ),
  imports as (
    select s.user_id, min(s.created_at) as first_at, count(*)::integer as books
    from public.shelf_entries s
    join real_users u on u.id = s.user_id
    where s.source in ('goodreads', 'storygraph')
    group by s.user_id
  ),
  cohort as (
    select u.id, u.created_at, u.referred_by,
      exists (select 1 from public.follows f join public.admins ad on ad.user_id = f.followee_id
              where f.follower_id = u.id and f.created_at < u.created_at + interval '3 days') as follows_you,
      exists (select 1 from act a where a.user_id = u.id
              and a.at >= u.created_at + interval '7 days' and a.at < u.created_at + interval '14 days') as back7,
      exists (select 1 from act a where a.user_id = u.id
              and a.at >= u.created_at + interval '30 days' and a.at < u.created_at + interval '37 days') as back30
    from real_users u
  )
  select
    w.ws,
    (w.ws + 7 > (now() at time zone 'utc')::date),
    (select count(*)::integer from cohort c where c.created_at >= w.ws and c.created_at < w.ws + 7),
    (select count(*)::integer from cohort c where c.created_at >= w.ws and c.created_at < w.ws + 7 and c.referred_by is not null),
    (select count(*)::integer from cohort c where c.created_at >= w.ws and c.created_at < w.ws + 7 and c.referred_by is null and not c.follows_you),
    (select count(distinct a.user_id)::integer from act a where a.ranking and a.at >= w.ws and a.at < w.ws + 7),
    (select count(distinct a.user_id)::integer from act a where a.at >= w.ws and a.at < w.ws + 7),
    (select count(*)::integer from public.matchups m join real_users u on u.id = m.user_id where m.created_at >= w.ws and m.created_at < w.ws + 7),
    (select count(*)::integer from imports i where i.first_at >= w.ws and i.first_at < w.ws + 7),
    (select coalesce(sum(i.books), 0)::integer from imports i where i.first_at >= w.ws and i.first_at < w.ws + 7),
    (select count(*)::integer from cohort c where c.created_at >= w.ws and c.created_at < w.ws + 7 and c.created_at + interval '14 days' <= now()),
    (select count(*)::integer from cohort c where c.created_at >= w.ws and c.created_at < w.ws + 7 and c.created_at + interval '14 days' <= now() and c.back7),
    (select count(*)::integer from cohort c where c.created_at >= w.ws and c.created_at < w.ws + 7 and c.created_at + interval '37 days' <= now()),
    (select count(*)::integer from cohort c where c.created_at >= w.ws and c.created_at < w.ws + 7 and c.created_at + interval '37 days' <= now() and c.back30)
  from weeks w
  order by w.ws desc;
end;
$$;
revoke execute on function public.admin_growth(integer) from public, anon;
grant execute on function public.admin_growth(integer) to authenticated;

-- All-time totals, for the top of the page and the application form.
create or replace function public.admin_growth_totals()
returns table (
  readers integer,
  readers_outside integer,
  invited integer,
  importers integer,
  imported_books integer,
  imported_placed integer,
  ranked_books integer,
  matchups integer
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can see growth numbers' using errcode = '42501';
  end if;

  return query
  with real_users as (
    select p.id, p.created_at, p.referred_by from public.profiles p where not public.is_internal(p.id)
  )
  select
    (select count(*)::integer from real_users),
    (select count(*)::integer from real_users u
      where u.referred_by is null
        and not exists (select 1 from public.follows f join public.admins ad on ad.user_id = f.followee_id
                        where f.follower_id = u.id and f.created_at < u.created_at + interval '3 days')),
    (select count(*)::integer from real_users u where u.referred_by is not null),
    (select count(distinct s.user_id)::integer from public.shelf_entries s join real_users u on u.id = s.user_id
      where s.source in ('goodreads', 'storygraph')),
    (select count(*)::integer from public.shelf_entries s join real_users u on u.id = s.user_id
      where s.source in ('goodreads', 'storygraph')),
    -- Imported books the reader has placed themselves (no longer rough or unrated).
    (select count(*)::integer from public.shelf_entries s join real_users u on u.id = s.user_id
      where s.source in ('goodreads', 'storygraph') and s.status = 'ranked' and not s.needs_sort),
    (select count(*)::integer from public.shelf_entries s join real_users u on u.id = s.user_id where s.status = 'ranked'),
    (select count(*)::integer from public.matchups m join real_users u on u.id = m.user_id);
end;
$$;
revoke execute on function public.admin_growth_totals() from public, anon;
grant execute on function public.admin_growth_totals() to authenticated;
