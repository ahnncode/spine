-- Spine: public book pages, opt-in public profiles, and what link previews need.
-- Everything here is readable without an account, so it only returns what's
-- safe for anyone to see.

-- Readers choose whether their profile is visible on the web (off by default).
alter table public.profiles add column public_profile boolean not null default false;
grant insert (public_profile) on public.profiles to authenticated;
grant update (public_profile) on public.profiles to authenticated;
grant select (public_profile) on public.profiles to authenticated;

-- A book's public page: details, the community score, and readers who share their profile.
create or replace function public.public_book(p_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', b.id, 'title', b.title, 'author', b.author, 'cover_id', b.cover_id, 'cover_url', b.cover_url,
    'isbn13', b.isbn13, 'year', b.year, 'pages', b.pages, 'genres', b.genres,
    'avg_score', (select round(avg(r.score), 1) from public.ranked_entries r join public.profiles p on p.id = r.user_id
                  where r.book_id = b.id and not p.is_private),
    'readers', (select count(*) from public.ranked_entries r join public.profiles p on p.id = r.user_id
                where r.book_id = b.id and not p.is_private),
    'loved', (select count(*) from public.ranked_entries r join public.profiles p on p.id = r.user_id
              where r.book_id = b.id and not p.is_private and r.bucket = 'loved'),
    'public_readers', coalesce((
      select jsonb_agg(x order by x->>'score' desc) from (
        select jsonb_build_object('username', p.username, 'display_name', p.display_name,
                                  'avatar_icon', p.avatar_icon, 'avatar_color', p.avatar_color, 'score', r.score) as x
        from public.ranked_entries r join public.profiles p on p.id = r.user_id
        where r.book_id = b.id and p.public_profile and not p.is_private and p.username is not null
        order by r.score desc limit 8
      ) s), '[]'::jsonb)
  )
  from public.books b where b.id = p_id;
$$;

-- A reader's public profile, only if they've turned it on.
create or replace function public.public_profile(p_username text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'username', p.username, 'display_name', p.display_name, 'bio', p.bio,
    'avatar_icon', p.avatar_icon, 'avatar_color', p.avatar_color, 'joined', p.created_at::date,
    'ranked', (select count(*) from public.shelf_entries e where e.user_id = p.id and e.status = 'ranked'),
    'followers', (select count(*) from public.follows f where f.followee_id = p.id),
    'top', coalesce((
      select jsonb_agg(x order by (x->>'rank')::int) from (
        select jsonb_build_object('book_id', b.id, 'title', b.title, 'author', b.author, 'cover_id', b.cover_id,
                                  'cover_url', b.cover_url, 'isbn13', b.isbn13, 'score', r.score, 'rank', r.overall_rank) as x
        from public.ranked_entries r join public.books b on b.id = r.book_id
        where r.user_id = p.id order by r.overall_rank limit 10
      ) s), '[]'::jsonb),
    'reading', coalesce((
      select jsonb_agg(jsonb_build_object('book_id', b.id, 'title', b.title, 'author', b.author, 'cover_id', b.cover_id,
                                          'cover_url', b.cover_url, 'isbn13', b.isbn13))
      from public.shelf_entries e join public.books b on b.id = e.book_id
      where e.user_id = p.id and e.status = 'reading'), '[]'::jsonb),
    'badges', coalesce((select jsonb_agg(a.badge order by a.earned_at desc) from public.badge_awards a where a.user_id = p.id), '[]'::jsonb)
  )
  from public.profiles p
  where p.username = lower(p_username) and p.public_profile and not p.is_private;
$$;

-- Just enough about a read-along for its link preview (no names: those are private).
create or replace function public.read_along_card(p_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'title', b.title, 'author', b.author, 'cover_id', b.cover_id, 'cover_url', b.cover_url, 'isbn13', b.isbn13,
    'readers', (select count(*) from public.read_along_members m where m.read_along_id = r.id and m.state = 'joined'),
    'revealed', r.revealed_at is not null
  )
  from public.read_alongs r join public.books b on b.id = r.book_id
  where r.id = p_id;
$$;

-- For search engines: public profiles, and books someone has ranked.
create or replace function public.public_sitemap()
returns table (kind text, key text, updated timestamptz)
language sql stable security definer set search_path = public as $$
  (select 'profile', p.username, p.created_at from public.profiles p
   where p.public_profile and not p.is_private and p.username is not null limit 5000)
  union all
  (select 'book', b.id::text, max(e.updated_at) from public.shelf_entries e join public.books b on b.id = e.book_id
   join public.profiles p on p.id = e.user_id
   where e.status = 'ranked' and not p.is_private group by b.id limit 20000);
$$;

grant execute on function public.public_book(uuid) to anon, authenticated;
grant execute on function public.public_profile(text) to anon, authenticated;
grant execute on function public.read_along_card(uuid) to anon, authenticated;
grant execute on function public.public_sitemap() to anon, authenticated;
