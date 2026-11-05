-- A short "about this book" for each book, looked up once from Open Library
-- (or Apple Books) by whoever opens the book first. Kept out of the books
-- table so shelves and feeds stay light.

create table public.book_descriptions (
  book_id uuid primary key references public.books (id) on delete cascade,
  -- null = we looked and found nothing (checked_at says when)
  description text check (description is null or char_length(description) between 40 and 2500),
  source text check (source in ('openlibrary', 'apple')),
  set_by uuid references auth.users (id) on delete set null,
  checked_at timestamptz not null default now()
);
alter table public.book_descriptions enable row level security;
create policy "anyone reads book descriptions"
  on public.book_descriptions for select to anon, authenticated using (true);
grant select on public.book_descriptions to anon, authenticated;

-- Save what was found. Never overwrites a description that's already there;
-- a "found nothing" can be filled in later (after a week, or by a real find).
create or replace function public.set_book_description(p_book uuid, p_text text, p_source text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_text text := nullif(btrim(left(coalesce(p_text, ''), 2500)), '');
begin
  if auth.uid() is null then return; end if;
  if v_text is not null and (char_length(v_text) < 40 or p_source not in ('openlibrary', 'apple')) then
    v_text := null;
  end if;
  insert into book_descriptions (book_id, description, source, set_by, checked_at)
  values (p_book, v_text, case when v_text is not null then p_source end, auth.uid(), now())
  on conflict (book_id) do update
    set description = excluded.description, source = excluded.source,
        set_by = excluded.set_by, checked_at = now()
    where book_descriptions.description is null
      and (excluded.description is not null or book_descriptions.checked_at < now() - interval '7 days');
end;
$$;
revoke all on function public.set_book_description(uuid, text, text) from public, anon;
grant execute on function public.set_book_description(uuid, text, text) to authenticated;

-- Public book pages show it too (and search engines read it).
create or replace function public.public_book(p_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', b.id, 'title', b.title, 'author', b.author, 'cover_id', b.cover_id, 'cover_url', b.cover_url,
    'isbn13', b.isbn13, 'year', b.year, 'pages', b.pages, 'genres', b.genres,
    'description', (select d.description from public.book_descriptions d where d.book_id = b.id),
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
