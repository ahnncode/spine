-- Weekly picks: every Monday each reader gets two books chosen from their
-- rankings. A "mystery pick" (hidden behind hints until they reveal it) that
-- readers who rank like them loved, and a "wildcard" from a genre they rarely
-- read, ideally vouched for by someone who shares one of their favorites.

create table public.weekly_picks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  week_start date not null,
  kind text not null check (kind in ('mystery', 'wildcard')),
  book_id uuid not null references public.books (id) on delete cascade,
  predicted numeric,
  basis integer not null default 0,
  reason text,
  revealed_at timestamptz,
  response text check (response in ('want', 'reading', 'skip')),
  created_at timestamptz not null default now(),
  unique (user_id, week_start, kind)
);
create index weekly_picks_user on public.weekly_picks (user_id, week_start desc);
-- Only reachable through the functions below, so a mystery stays a mystery.
alter table public.weekly_picks enable row level security;

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('reaction', 'comment', 'follow', 'badge', 'mention', 'poke', 'read_along', 'picks'));

-- Picks roll over on Monday (US Eastern, so they're there by Monday morning everywhere in the US).
create or replace function public._pick_week() returns date
language sql stable set search_path = public as $$
  select date_trunc('week', now() at time zone 'America/New_York')::date;
$$;

-- Choose this week's two books for one reader. Returns how many were added.
create or replace function public._make_picks(p_user uuid) returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_week date := public._pick_week();
  v_added integer := 0;
  v_book uuid;
  v_pred numeric;
  v_basis integer;
  v_reason text;
  v_genre text;
begin
  -- Mystery: what readers who rank like you loved.
  if not exists (select 1 from weekly_picks where user_id = p_user and week_start = v_week and kind = 'mystery') then
    with mine as (
      select book_id, score from ranked_entries where user_id = p_user
    ), sim as (
      select r.user_id, 100 - 15 * avg(abs(r.score - m.score)) as match
      from ranked_entries r
      join mine m on m.book_id = r.book_id
      join profiles p on p.id = r.user_id and not p.is_private
      where r.user_id <> p_user
        and not public.is_blocked(r.user_id, p_user)
      group by r.user_id
      having count(*) >= 3
    ), votes as (
      select r.book_id, r.score, power(sim.match - 40, 2) as w
      from ranked_entries r
      join sim on sim.user_id = r.user_id and sim.match > 40
      where r.score >= 6.7
    ), ranked as (
      select v.book_id, sum(v.score * v.w) / sum(v.w) as pred, count(*)::int as basis
      from votes v
      where not exists (select 1 from shelf_entries e where e.user_id = p_user and e.book_id = v.book_id)
        and not exists (select 1 from weekly_picks w where w.user_id = p_user and w.book_id = v.book_id)
      group by v.book_id
    )
    select book_id, round(pred, 1), basis into v_book, v_pred, v_basis
    from ranked
    -- A little chance, so it isn't always the single top prediction.
    order by pred + random() * 0.6 desc, basis desc
    limit 1;

    if v_book is not null then
      v_reason := case when v_basis = 1 then 'A reader who ranks like you loved it'
                       else v_basis || ' readers who rank like you loved it' end;
    else
      -- Not enough overlap with anyone yet: the best-loved book in your favorite genres.
      with fav as (
        select g, count(*) as n
        from ranked_entries r join books b on b.id = r.book_id, unnest(b.genres) g
        where r.user_id = p_user and r.bucket = 'loved'
        group by g
      ), scored as (
        select r.book_id, avg(r.score) as avg_score, count(*)::int as readers
        from ranked_entries r
        join profiles p on p.id = r.user_id and not p.is_private
        where r.user_id <> p_user
        group by r.book_id
        having avg(r.score) >= 7
      )
      select s.book_id, round(s.avg_score, 1), s.readers, f.g into v_book, v_pred, v_basis, v_genre
      from scored s
      join books b on b.id = s.book_id
      left join fav f on f.g = any (b.genres)
      where not exists (select 1 from shelf_entries e where e.user_id = p_user and e.book_id = s.book_id)
        and not exists (select 1 from weekly_picks w where w.user_id = p_user and w.book_id = s.book_id)
      order by coalesce(f.n, 0) desc, s.avg_score + random() * 0.6 desc
      limit 1;
      v_reason := case when v_genre is not null then 'A favorite in a genre you love'
                       else 'One of the best-loved books on readread' end;
      v_pred := null; -- a community average, not a prediction for you
    end if;

    if v_book is not null then
      insert into weekly_picks (user_id, week_start, kind, book_id, predicted, basis, reason)
      values (p_user, v_week, 'mystery', v_book, v_pred, coalesce(v_basis, 0), v_reason)
      on conflict do nothing;
      v_added := v_added + 1;
    end if;
  end if;

  -- Wildcard: a genre you rarely read, loved by readers (best of all, by
  -- someone who shares one of your favorites).
  v_book := null; v_pred := null; v_basis := null; v_reason := null; v_genre := null;
  if not exists (select 1 from weekly_picks where user_id = p_user and week_start = v_week and kind = 'wildcard') then
    declare
      v_bridge text;
      v_shared text;
      v_bridge_score numeric;
    begin
      with counts as (
        select g, count(*) as n
        from ranked_entries r join books b on b.id = r.book_id, unnest(b.genres) g
        where r.user_id = p_user
        group by g
      ), top_genres as (
        select g from counts order by n desc limit 2
      ), rare as (
        select a.genre as g from unnest(array[
          'literary', 'scifi', 'fantasy', 'mystery', 'romance', 'horror', 'historical',
          'classics', 'history', 'memoir', 'science', 'poetry'
        ]) as a(genre)
        where coalesce((select c.n from counts c where c.g = a.genre), 0) <= 1
      ), my_loved as (
        select book_id from ranked_entries where user_id = p_user and bucket = 'loved'
      ), candidates as (
        select r.book_id, r.user_id, r.score,
               (select rr.g from rare rr where rr.g = any (b.genres) limit 1) as genre,
               (select b2.title from ranked_entries r2
                  join my_loved ml on ml.book_id = r2.book_id
                  join books b2 on b2.id = r2.book_id
                where r2.user_id = r.user_id and r2.bucket = 'loved'
                order by r2.score desc limit 1) as shared_title
        from ranked_entries r
        join books b on b.id = r.book_id
        join profiles p on p.id = r.user_id and not p.is_private
        where r.user_id <> p_user
          and r.score >= 7.5
          and not public.is_blocked(r.user_id, p_user)
          and b.genres && (select array_agg(g) from rare)
          and not (b.genres && coalesce((select array_agg(g) from top_genres), '{}'))
          and not exists (select 1 from shelf_entries e where e.user_id = p_user and e.book_id = r.book_id)
          and not exists (select 1 from weekly_picks w where w.user_id = p_user and w.book_id = r.book_id)
      )
      select c.book_id, c.genre, coalesce(pr.display_name, '@' || pr.username), c.shared_title, round(c.score, 1),
             (select count(*) from ranked_entries x where x.book_id = c.book_id and x.score >= 6.7)::int
        into v_book, v_genre, v_bridge, v_shared, v_bridge_score, v_basis
      from candidates c
      join profiles pr on pr.id = c.user_id
      order by (c.shared_title is not null) desc, c.score + random() * 1.0 desc
      limit 1;

      if v_book is not null then
        v_reason := 'Outside your usual: you''ve barely read '
          || case v_genre
               when 'scifi' then 'sci-fi' when 'literary' then 'literary fiction'
               when 'historical' then 'historical fiction' when 'classics' then 'classics'
               else v_genre end
          || '. '
          || case when v_shared is not null
               then v_bridge || ', who also loved ' || v_shared || ', gave it ' || v_bridge_score || '.'
               else v_bridge || ' gave it ' || v_bridge_score || '.' end;
        insert into weekly_picks (user_id, week_start, kind, book_id, predicted, basis, reason, revealed_at)
        values (p_user, v_week, 'wildcard', v_book, null, coalesce(v_basis, 0), v_reason, now())
        on conflict do nothing;
        v_added := v_added + 1;
      end if;
    end;
  end if;

  return v_added;
end;
$$;
revoke all on function public._make_picks(uuid) from public, anon, authenticated;
revoke all on function public._pick_week() from public, anon, authenticated;

-- The Monday job: picks for every reader with 3+ ranked books, plus one notification each.
create or replace function public.make_weekly_picks() returns integer
language plpgsql security definer set search_path = public as $$
declare
  r record;
  v_total integer := 0;
  v_added integer;
begin
  for r in
    select user_id from ranked_entries group by user_id having count(*) >= 3
  loop
    begin
      v_added := public._make_picks(r.user_id);
      if v_added > 0 and not exists (
        select 1 from notifications n
        where n.user_id = r.user_id and n.kind = 'picks' and n.created_at >= public._pick_week()
      ) then
        insert into notifications (user_id, actor_id, kind) values (r.user_id, r.user_id, 'picks');
      end if;
      v_total := v_total + v_added;
    exception when others then
      -- One reader's odd data shouldn't stop everyone else's picks.
      raise warning 'weekly picks failed for %: %', r.user_id, sqlerrm;
    end;
  end loop;
  return v_total;
end;
$$;
revoke all on function public.make_weekly_picks() from public, anon, authenticated;

-- This week's picks for the signed-in reader (made on the spot if the Monday
-- job hasn't reached them yet). A mystery's book stays hidden until revealed.
create or replace function public.my_weekly_picks() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_ranked integer;
begin
  if v_uid is null then return '[]'::jsonb; end if;
  select count(*) into v_ranked from ranked_entries where user_id = v_uid;
  if v_ranked < 3 then
    return jsonb_build_array(jsonb_build_object('locked', true, 'ranked', v_ranked));
  end if;
  perform public._make_picks(v_uid);
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', w.id,
      'kind', w.kind,
      'reason', w.reason,
      'predicted', w.predicted,
      'basis', w.basis,
      'revealed', w.revealed_at is not null,
      'response', w.response,
      'hints', jsonb_build_object(
        'genres', b.genres,
        'decade', case when b.year is not null then (b.year / 10) * 10 end,
        'pages', case when b.pages is not null then round(b.pages / 50.0) * 50 end,
        'initial', upper(left(regexp_replace(b.title, '^(the|a|an)\s+', '', 'i'), 1))
      ),
      'book', case when w.revealed_at is not null then jsonb_build_object(
        'id', b.id, 'title', b.title, 'author', b.author, 'cover_id', b.cover_id, 'cover_url', b.cover_url,
        'isbn13', b.isbn13, 'year', b.year, 'pages', b.pages, 'genres', b.genres
      ) end
    ) order by w.kind)
    from weekly_picks w
    join books b on b.id = w.book_id
    where w.user_id = v_uid and w.week_start = public._pick_week()
  ), '[]'::jsonb);
end;
$$;

create or replace function public.reveal_pick(p_id uuid) returns void
language sql security definer set search_path = public as $$
  update public.weekly_picks set revealed_at = coalesce(revealed_at, now())
  where id = p_id and user_id = auth.uid();
$$;

create or replace function public.respond_pick(p_id uuid, p_response text) returns void
language sql security definer set search_path = public as $$
  update public.weekly_picks
  set response = case when p_response in ('want', 'reading', 'skip') then p_response end,
      revealed_at = coalesce(revealed_at, now())
  where id = p_id and user_id = auth.uid();
$$;

revoke all on function public.my_weekly_picks(), public.reveal_pick(uuid), public.respond_pick(uuid, text) from public, anon;
grant execute on function public.my_weekly_picks(), public.reveal_pick(uuid), public.respond_pick(uuid, text) to authenticated;

-- Every Monday at 15:00 UTC (8am Mountain, 10am Eastern).
create extension if not exists pg_cron;
select cron.unschedule(jobid) from cron.job where jobname = 'weekly-picks';
select cron.schedule('weekly-picks', '0 15 * * 1', 'select public.make_weekly_picks()');
