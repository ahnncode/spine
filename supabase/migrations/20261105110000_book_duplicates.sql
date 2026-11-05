-- readread: one book, one row. Some sources cut a word short or spell a
-- title slightly differently ("A Confed of Dunces"), which made a second
-- copy of the book with its own rankings. This finds such copies, merges
-- them, and remembers the old spelling so it can't come back.

-- Old spellings of merged books point at the book that stayed.
create table if not exists public.book_aliases (
  dedupe_key text primary key,
  book_id uuid not null references public.books (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.book_aliases enable row level security;
drop policy if exists "readers see book aliases" on public.book_aliases;
create policy "readers see book aliases" on public.book_aliases for select to authenticated using (true);
grant select on public.book_aliases to authenticated;

create index if not exists books_surname on public.books (split_part(dedupe_key, '|', 2));
create index if not exists books_work on public.books (ol_work_key) where ol_work_key is not null;

-- Same surname, and titles that match word for word where one word may be
-- cut short (3+ letters). Numbers must match exactly. Mirrors sameBookKey in
-- src/lib/books.ts.
create or replace function public._same_book_key(a text, b text)
returns boolean language plpgsql immutable as $$
declare
  wa text[]; wb text[]; x text; y text; i int;
begin
  if a = b then return true; end if;
  if split_part(a, '|', 2) <> split_part(b, '|', 2) then return false; end if;
  wa := string_to_array(split_part(a, '|', 1), ' ');
  wb := string_to_array(split_part(b, '|', 1), ' ');
  if coalesce(array_length(wa, 1), 0) = 0 or coalesce(array_length(wa, 1), 0) <> coalesce(array_length(wb, 1), 0) then
    return false;
  end if;
  for i in 1 .. array_length(wa, 1) loop
    x := wa[i]; y := wb[i];
    continue when x = y;
    if x ~ '\d' or y ~ '\d' then return false; end if;
    if length(x) > length(y) then
      if length(y) < 3 or left(x, length(y)) <> y then return false; end if;
    else
      if length(x) < 3 or left(y, length(x)) <> x then return false; end if;
    end if;
  end loop;
  return true;
end;
$$;

-- For new books: the book we already have under that key, an old spelling,
-- the same Open Library work, or a near-identical title by the same author.
create or replace function public.resolve_books(p_keys text[], p_works text[] default null)
returns table (dedupe_key text, book_id uuid)
language sql stable security definer set search_path = public as $$
  select k.key,
    coalesce(
      (select b.id from books b where b.dedupe_key = k.key),
      (select a.book_id from book_aliases a where a.dedupe_key = k.key),
      (select b.id from books b where k.work is not null and b.ol_work_key = k.work order by b.created_at limit 1),
      (select b.id from books b
        where split_part(b.dedupe_key, '|', 2) = split_part(k.key, '|', 2)
          and public._same_book_key(b.dedupe_key, k.key)
        order by length(b.dedupe_key) desc, b.created_at limit 1)
    )
  from unnest(p_keys, coalesce(p_works, array_fill(null::text, array[cardinality(p_keys)]))) as k(key, work)
  where cardinality(p_keys) <= 200;
$$;
revoke all on function public.resolve_books(text[], text[]) from public, anon;
grant execute on function public.resolve_books(text[], text[]) to authenticated;

-- Likely duplicates, for review. keep_id is the copy that stays: the fuller
-- title when one is cut short, otherwise the one more readers have.
create or replace function public.book_duplicates()
returns table (keep_id uuid, keep_title text, drop_id uuid, drop_title text, author text, reason text, keep_shelves bigint, drop_shelves bigint)
language sql stable security definer set search_path = public as $$
  with shelves as (
    select b.id, b.title, b.author, b.dedupe_key, b.ol_work_key, b.created_at,
           (select count(*) from shelf_entries e where e.book_id = b.id) as n
    from books b
  ), pairs as (
    select x.*, y.id as y_id, y.title as y_title, y.dedupe_key as y_key, y.n as y_n, y.created_at as y_created,
           case when x.ol_work_key is not null and x.ol_work_key = y.ol_work_key then 'same Open Library work' else 'near-identical title' end as why
    from shelves x
    join shelves y on x.id < y.id
     and ((x.ol_work_key is not null and x.ol_work_key = y.ol_work_key)
       or (split_part(x.dedupe_key, '|', 2) = split_part(y.dedupe_key, '|', 2) and public._same_book_key(x.dedupe_key, y.dedupe_key)))
  )
  select
    case when x_first then id else y_id end as keep_id, case when x_first then title else y_title end as keep_title,
    case when x_first then y_id else id end as drop_id, case when x_first then y_title else title end as drop_title,
    author, why as reason,
    case when x_first then n else y_n end as keep_shelves, case when x_first then y_n else n end as drop_shelves
  from (
    select p.*,
      case when length(p.dedupe_key) <> length(p.y_key) and p.why = 'near-identical title' then length(p.dedupe_key) > length(p.y_key)
           when p.n <> p.y_n then p.n > p.y_n
           else p.created_at <= p.y_created end as x_first
    from pairs p
  ) z
  order by author, keep_title;
$$;
revoke all on function public.book_duplicates() from public, anon, authenticated;

-- Fold one copy into another: shelves, check-ins, picks, read-alongs,
-- head-to-heads and history move over; anything only the dropped copy knew
-- (cover, year, pages, genres) fills gaps. Someone with both copies keeps
-- whichever entry is further along (ranked > to rank > reading > want).
create or replace function public.merge_books(p_keep uuid, p_drop uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  r record;
  rank_of constant jsonb := '{"ranked": 4, "unsorted": 3, "reading": 2, "want": 1}';
  winner uuid; loser uuid;
begin
  if p_keep = p_drop or not exists (select 1 from books where id = p_keep) or not exists (select 1 from books where id = p_drop) then
    raise exception 'merge_books: need two different existing books';
  end if;

  -- Readers with both copies: keep one entry, move its comments and reactions.
  for r in
    select k.id as keep_entry, d.id as drop_entry, k.status as ks, d.status as ds
    from shelf_entries k join shelf_entries d on d.user_id = k.user_id
    where k.book_id = p_keep and d.book_id = p_drop
  loop
    if (rank_of ->> r.ds)::int > (rank_of ->> r.ks)::int then
      winner := r.drop_entry; loser := r.keep_entry;
    else
      winner := r.keep_entry; loser := r.drop_entry;
    end if;
    update comments set target_id = winner where target_type = 'entry' and target_id = loser;
    delete from reactions x where x.target_type = 'entry' and x.target_id = loser
      and exists (select 1 from reactions y where y.user_id = x.user_id and y.target_type = 'entry' and y.target_id = winner);
    update reactions set target_id = winner where target_type = 'entry' and target_id = loser;
    delete from shelf_entries where id = loser;
  end loop;
  update shelf_entries set book_id = p_keep where book_id = p_drop;

  delete from reading_checkins d where d.book_id = p_drop
    and exists (select 1 from reading_checkins k where k.book_id = p_keep and k.user_id = d.user_id and k.checked_on = d.checked_on);
  update reading_checkins set book_id = p_keep where book_id = p_drop;
  update weekly_picks set book_id = p_keep where book_id = p_drop;
  update read_alongs set book_id = p_keep where book_id = p_drop;
  update shelf_events set book_id = p_keep where book_id = p_drop;
  delete from matchups where (winner_book = p_drop and loser_book = p_keep) or (winner_book = p_keep and loser_book = p_drop);
  update matchups set winner_book = p_keep where winner_book = p_drop;
  update matchups set loser_book = p_keep where loser_book = p_drop;
  if exists (select 1 from book_descriptions where book_id = p_keep and description is not null) then
    delete from book_descriptions where book_id = p_drop;
  else
    delete from book_descriptions where book_id = p_keep;
    update book_descriptions set book_id = p_keep where book_id = p_drop;
  end if;

  update books k set
    isbn13 = coalesce(k.isbn13, d.isbn13),
    ol_work_key = coalesce(k.ol_work_key, d.ol_work_key),
    cover_id = coalesce(k.cover_id, d.cover_id),
    cover_url = coalesce(k.cover_url, d.cover_url),
    year = case when k.year is null then d.year when d.year is null then k.year else least(k.year, d.year) end,
    pages = coalesce(k.pages, d.pages),
    genres = case when cardinality(k.genres) = 0 then d.genres else k.genres end,
    genre_set_by = case when cardinality(k.genres) = 0 then d.genre_set_by else k.genre_set_by end
  from books d where k.id = p_keep and d.id = p_drop;

  -- Remember the old spelling (and any it already stood in for).
  update book_aliases set book_id = p_keep where book_id = p_drop;
  insert into book_aliases (dedupe_key, book_id)
    select dedupe_key, p_keep from books where id = p_drop
    on conflict (dedupe_key) do update set book_id = excluded.book_id;
  delete from books where id = p_drop;
end;
$$;
revoke all on function public.merge_books(uuid, uuid) from public, anon, authenticated;

-- Merge everything book_duplicates() lists, one pair at a time (a merge can
-- change what's left). Returns how many copies were folded in.
create or replace function public.merge_book_duplicates()
returns int language plpgsql security definer set search_path = public as $$
declare
  r record; n int := 0;
begin
  loop
    select keep_id, drop_id into r from public.book_duplicates() limit 1;
    exit when not found or n >= 500;
    perform public.merge_books(r.keep_id, r.drop_id);
    n := n + 1;
  end loop;
  return n;
end;
$$;
revoke all on function public.merge_book_duplicates() from public, anon, authenticated;
