-- Moderation: a place to see reports and act on them (REA-44), and limits so
-- reports can't be spammed.

-- Who can moderate. No policies: only the security-definer functions below read it.
create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  added_at timestamptz not null default now()
);
alter table public.admins enable row level security;
revoke all on public.admins from anon, authenticated;

create or replace function public.is_admin(p_user uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins a where a.user_id = p_user)
$$;
revoke execute on function public.is_admin(uuid) from public, anon;
grant execute on function public.is_admin(uuid) to authenticated;

-- What happened to a report.
alter table public.reports
  add column if not exists resolved_at timestamptz,
  add column if not exists resolved_by uuid references auth.users (id) on delete set null;

create index if not exists reports_open on public.reports (created_at) where status = 'open';

-- One open report per reader per thing. Duplicates are dropped quietly.
create unique index if not exists reports_one_open_per_reader
  on public.reports (reporter_id, target_type, target_id) where status = 'open';

-- At most 20 reports a day per reader.
create or replace function public.reports_daily_cap()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.reports r
      where r.reporter_id = new.reporter_id and r.created_at > now() - interval '1 day') >= 20 then
    raise exception 'Too many reports today' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke execute on function public.reports_daily_cap() from public, anon, authenticated;
drop trigger if exists reports_cap on public.reports;
create trigger reports_cap before insert on public.reports for each row execute function public.reports_daily_cap();

-- Open reports, one row per reported thing, with what was said and who said it.
create or replace function public.admin_reports()
returns table (
  target_type text,
  target_id uuid,
  reports integer,
  reasons text[],
  first_at timestamptz,
  last_at timestamptz,
  author_id uuid,
  author_name text,
  author_username text,
  body text,
  link text,
  author_reports integer
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  return query
  with open as (
    select r.target_type as t, r.target_id as id, count(*)::int as n,
           array_remove(array_agg(r.reason order by r.created_at), null) as why,
           min(r.created_at) as first_at, max(r.created_at) as last_at
    from public.reports r
    where r.status = 'open'
    group by r.target_type, r.target_id
  ),
  detail as (
    select o.*,
      case o.t
        when 'comment' then (select c.user_id from public.comments c where c.id = o.id)
        when 'chapter_comment' then (select c.user_id from public.chapter_comments c where c.id = o.id)
        when 'club_comment' then (select c.user_id from public.club_comments c where c.id = o.id)
        when 'entry' then (select e.user_id from public.shelf_entries e where e.id = o.id)
        when 'checkin' then (select k.user_id from public.reading_checkins k where k.id = o.id)
        when 'profile' then o.id
      end as who,
      case o.t
        when 'comment' then (select c.body from public.comments c where c.id = o.id)
        when 'chapter_comment' then (select c.body from public.chapter_comments c where c.id = o.id)
        when 'club_comment' then (select c.body from public.club_comments c where c.id = o.id)
        when 'entry' then (select e.note from public.shelf_entries e where e.id = o.id)
        when 'checkin' then (select k.note from public.reading_checkins k where k.id = o.id)
        when 'profile' then (select p.bio from public.profiles p where p.id = o.id)
      end as said,
      case o.t
        when 'comment' then (select '/book/' || e.book_id from public.comments c join public.shelf_entries e on e.id = c.target_id where c.id = o.id)
        when 'chapter_comment' then (select '/book/' || c.book_id || '/room/' || c.chapter from public.chapter_comments c where c.id = o.id)
        when 'club_comment' then (select '/clubs/' || cr.club_id || '/week/' || c.week from public.club_comments c join public.club_reads cr on cr.id = c.read_id where c.id = o.id)
        when 'entry' then (select '/book/' || e.book_id from public.shelf_entries e where e.id = o.id)
        when 'checkin' then (select '/book/' || k.book_id from public.reading_checkins k where k.id = o.id)
        when 'profile' then null
      end as href
    from open o
  )
  select d.t, d.id, d.n, d.why, d.first_at, d.last_at,
         d.who, p.display_name, p.username, d.said,
         coalesce(d.href, case when p.username is not null then '/u/' || p.username end),
         (count(*) over (partition by d.who))::int
  from detail d
  left join public.profiles p on p.id = d.who
  order by d.n desc, d.last_at desc;
end;
$$;
revoke execute on function public.admin_reports() from public, anon;
grant execute on function public.admin_reports() to authenticated;

-- How many things are waiting, for the badge. Zero for everyone but admins.
create or replace function public.admin_open_report_count()
returns integer language sql stable security definer set search_path = public as $$
  select case when public.is_admin()
    then (select count(distinct (r.target_type, r.target_id))::int from public.reports r where r.status = 'open')
    else 0 end
$$;
revoke execute on function public.admin_open_report_count() from public, anon;
grant execute on function public.admin_open_report_count() to authenticated;

-- Act on a reported thing. 'dismiss' keeps it; 'remove' deletes a comment, or
-- clears the note on a ranking or check-in, or clears a profile's bio.
create or replace function public.admin_resolve_report(p_type text, p_target uuid, p_action text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if p_action not in ('dismiss', 'remove') then
    raise exception 'Unknown action %', p_action;
  end if;

  if p_action = 'remove' then
    case p_type
      when 'comment' then delete from public.comments where id = p_target;
      when 'chapter_comment' then delete from public.chapter_comments where id = p_target;
      when 'club_comment' then delete from public.club_comments where id = p_target;
      when 'entry' then update public.shelf_entries set note = null where id = p_target;
      when 'checkin' then update public.reading_checkins set note = null where id = p_target;
      when 'profile' then update public.profiles set bio = null where id = p_target;
      else raise exception 'Unknown target %', p_type;
    end case;
  end if;

  update public.reports
     set status = case when p_action = 'dismiss' then 'dismissed' else 'resolved' end,
         resolved_at = now(),
         resolved_by = auth.uid()
   where target_type = p_type and target_id = p_target and status = 'open';
end;
$$;
revoke execute on function public.admin_resolve_report(text, uuid, text) from public, anon;
grant execute on function public.admin_resolve_report(text, uuid, text) to authenticated;
