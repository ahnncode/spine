-- Where new readers came from (ad campaigns, posts), from the utm_ tags on the
-- link they first landed on. Set once, right after sign-up; private.

alter table public.profiles
  add column if not exists signup_source text,
  add column if not exists signup_campaign text;
-- Not granted to readers: profiles uses column grants, so these stay
-- unreadable and unwritable except through the functions below.

create or replace function public.set_signup_source(p_source text, p_campaign text default null)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  src text := left(lower(regexp_replace(coalesce(p_source, ''), '[^A-Za-z0-9_.-]', '', 'g')), 40);
  camp text := nullif(left(lower(regexp_replace(coalesce(p_campaign, ''), '[^A-Za-z0-9_.-]', '', 'g')), 60), '');
begin
  if auth.uid() is null or src = '' then
    return false;
  end if;
  update public.profiles
    set signup_source = src, signup_campaign = camp
    where id = auth.uid() and signup_source is null and created_at > now() - interval '1 day';
  return found;
end;
$$;
revoke execute on function public.set_signup_source(text, text) from public, anon;
grant execute on function public.set_signup_source(text, text) to authenticated;

-- One row per source: how many signed up, how many ranked a book themselves,
-- and how many came back 7-13 days after joining. Admins only.
create or replace function public.admin_growth_sources(p_days integer default 90)
returns table (
  source text,
  campaign text,
  signups integer,
  rankers integer,
  d7_cohort integer,
  d7_back integer
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can see growth numbers' using errcode = '42501';
  end if;

  return query
  with u as (
    select p.id, p.created_at,
      coalesce(p.signup_source, case when p.referred_by is not null then 'invite' else 'direct' end) as src,
      p.signup_campaign as camp
    from public.profiles p
    where not public.is_internal(p.id)
      and p.created_at > now() - make_interval(days => greatest(least(p_days, 730), 1))
  ),
  act as (
    select a.user_id, a.at, a.ranking from public.growth_activity() a join u on u.id = a.user_id
  )
  select u.src, u.camp,
    count(*)::integer,
    count(*) filter (where exists (select 1 from act a where a.user_id = u.id and a.ranking))::integer,
    count(*) filter (where u.created_at + interval '14 days' <= now())::integer,
    count(*) filter (where u.created_at + interval '14 days' <= now()
      and exists (select 1 from act a where a.user_id = u.id
                  and a.at >= u.created_at + interval '7 days' and a.at < u.created_at + interval '14 days'))::integer
  from u
  group by u.src, u.camp
  order by count(*) desc;
end;
$$;
revoke execute on function public.admin_growth_sources(integer) from public, anon;
grant execute on function public.admin_growth_sources(integer) to authenticated;
