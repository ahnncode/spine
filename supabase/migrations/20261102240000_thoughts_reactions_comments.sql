-- Spine: thoughts on books, richer check-ins, hearts, comments,
-- notifications, and blocking/reporting.

-- Thoughts on a ranked book ----------------------------------------------
alter table public.shelf_entries
  add column tags text[] not null default '{}',
  add column note_spoiler boolean not null default false,
  add constraint tags_valid check (
    cardinality(tags) <= 6 and tags <@ array[
      'unputdownable', 'slow_start', 'gorgeous_writing', 'made_me_cry', 'reread', 'overhyped',
      'great_twist', 'loved_characters', 'funny', 'stuck_ending'
    ]::text[]
  );

-- Check-ins get an optional line and a vibe -----------------------------
alter table public.reading_checkins
  add column note text,
  add column vibe text,
  add constraint checkin_note_length check (note is null or char_length(note) <= 280),
  add constraint checkin_vibe_valid check (vibe is null or vibe in ('hooked', 'loving', 'cant_stop', 'slogging', 'confused', 'need_break'));

-- Blocking ----------------------------------------------------------------
create table public.blocks (
  blocker_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  blocked_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint no_self_block check (blocker_id <> blocked_id)
);

alter table public.blocks enable row level security;
create policy "readers see their own blocks" on public.blocks for select to authenticated using (blocker_id = auth.uid());
create policy "readers block as themselves" on public.blocks for insert to authenticated with check (blocker_id = auth.uid());
create policy "readers unblock as themselves" on public.blocks for delete to authenticated using (blocker_id = auth.uid());

-- Either person blocked the other.
create or replace function public.is_blocked(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a)
  );
$$;
revoke execute on function public.is_blocked(uuid, uuid) from anon;

-- Blocking someone also ends follows in both directions.
create or replace function public.on_block()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from public.follows
  where (follower_id = new.blocker_id and followee_id = new.blocked_id)
     or (follower_id = new.blocked_id and followee_id = new.blocker_id);
  return new;
end;
$$;
revoke execute on function public.on_block() from public, anon, authenticated;
create trigger blocks_end_follows after insert on public.blocks for each row execute function public.on_block();

-- Visibility now also respects blocks (applies to shelves, check-ins and follows).
create or replace function public.is_visible(owner uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select owner = auth.uid()
      or (
        coalesce((select not p.is_private from public.profiles p where p.id = owner), true)
        and not public.is_blocked(owner, auth.uid())
      );
$$;

-- Can't follow someone in a block.
create policy "no follows across a block"
  on public.follows as restrictive for insert to authenticated
  with check (not public.is_blocked(follower_id, followee_id));

-- Hearts and comments: which post they're on, and whose it is ---------------
-- target_type: 'entry' (a ranked book with its thoughts) or 'checkin'.
create or replace function public.set_target_owner()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.target_type = 'entry' then
    select user_id into new.target_owner from public.shelf_entries where id = new.target_id;
  elsif new.target_type = 'checkin' then
    select user_id into new.target_owner from public.reading_checkins where id = new.target_id;
  end if;
  if new.target_owner is null then
    raise exception 'that post no longer exists';
  end if;
  return new;
end;
$$;
revoke execute on function public.set_target_owner() from public, anon, authenticated;

create table public.reactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  target_type text not null check (target_type in ('entry', 'checkin')),
  target_id uuid not null,
  target_owner uuid references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, target_type, target_id)
);
create index reactions_target on public.reactions (target_type, target_id);
create trigger reactions_1_owner before insert on public.reactions for each row execute function public.set_target_owner();

alter table public.reactions enable row level security;
create policy "hearts are visible where the post is"
  on public.reactions for select to authenticated
  using (public.is_visible(target_owner) and not public.is_blocked(user_id, auth.uid()));
create policy "readers heart as themselves"
  on public.reactions for insert to authenticated
  with check (user_id = auth.uid());
create policy "readers remove their own hearts"
  on public.reactions for delete to authenticated using (user_id = auth.uid());

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  target_type text not null check (target_type in ('entry')),
  target_id uuid not null,
  target_owner uuid references auth.users (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index comments_target on public.comments (target_type, target_id, created_at);
create trigger comments_1_owner before insert on public.comments for each row execute function public.set_target_owner();

alter table public.comments enable row level security;
create policy "comments are visible where the post is"
  on public.comments for select to authenticated
  using (public.is_visible(target_owner) and not public.is_blocked(user_id, auth.uid()));
create policy "readers comment as themselves"
  on public.comments for insert to authenticated
  with check (user_id = auth.uid());
-- You can delete your own comments, and any comment on your own post.
create policy "readers remove comments"
  on public.comments for delete to authenticated
  using (user_id = auth.uid() or target_owner = auth.uid());

-- After the owner is filled in: only on posts you can see, and not across a block.
create or replace function public.check_can_engage()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.target_owner <> new.user_id then
    if coalesce((select p.is_private from public.profiles p where p.id = new.target_owner), false)
       or public.is_blocked(new.target_owner, new.user_id) then
      raise exception 'you can''t react to that post';
    end if;
  end if;
  return new;
end;
$$;
revoke execute on function public.check_can_engage() from public, anon, authenticated;
create trigger reactions_2_can_engage before insert on public.reactions for each row execute function public.check_can_engage();
create trigger comments_2_can_engage before insert on public.comments for each row execute function public.check_can_engage();
-- (Triggers on the same event run in name order, so *_1_owner fills the owner before *_2_can_engage checks it.)

-- Reports (reviewed by you in the Supabase table editor) ----------------
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  target_type text not null check (target_type in ('comment', 'entry', 'checkin', 'profile')),
  target_id uuid not null,
  reason text check (reason is null or char_length(reason) <= 500),
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  created_at timestamptz not null default now()
);
alter table public.reports enable row level security;
create policy "readers file reports as themselves"
  on public.reports for insert to authenticated with check (reporter_id = auth.uid() and status = 'open');

-- Notifications ------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  actor_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('reaction', 'comment', 'follow')),
  target_type text,
  target_id uuid,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index notifications_user on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;
create policy "readers see their notifications"
  on public.notifications for select to authenticated
  using (user_id = auth.uid() and not public.is_blocked(actor_id, auth.uid()));
create policy "readers mark their notifications read"
  on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "readers clear their notifications"
  on public.notifications for delete to authenticated using (user_id = auth.uid());

create or replace function public.notify()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'follows' then
    insert into public.notifications (user_id, actor_id, kind)
    values (new.followee_id, new.follower_id, 'follow');
  elsif new.target_owner is not null and new.target_owner <> new.user_id then
    insert into public.notifications (user_id, actor_id, kind, target_type, target_id)
    values (new.target_owner, new.user_id,
            case when tg_table_name = 'reactions' then 'reaction' else 'comment' end,
            new.target_type, new.target_id);
  end if;
  return new;
end;
$$;
revoke execute on function public.notify() from public, anon, authenticated;
create trigger reactions_notify after insert on public.reactions for each row execute function public.notify();
create trigger comments_notify after insert on public.comments for each row execute function public.notify();
create trigger follows_notify after insert on public.follows for each row execute function public.notify();

-- The ranked view also carries the new thoughts columns.
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
    end, 1) as score
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

grant select on public.ranked_entries to authenticated;
revoke all on public.ranked_entries from anon;
