-- Re-key the catalogue under the new matching rules (REA-103).
--
-- Book keys now use the author's first initial ("dune|f herbert"), the first
-- listed author only (translators and co-authors left out), and keep a short
-- franchise subtitle ("dune house atreides|b herbert"). Keys are worked out in
-- the app (src/lib/books.ts), so the switch happens in two steps:
--
--   1. The admin page /you/book-keys works out every book's new key and
--      stages the ones that change (admin_stage_rekey).
--   2. In the SQL Editor: select * from public.apply_book_rekey();
--      It runs there, not from the app, because a big catalogue can take
--      longer than the app's 8-second limit on a request.
--
-- Books that end up with the same key are one book under the new rules and
-- are merged with merge_books (the copy more readers have stays). Every old
-- key is kept as an alias, so links and imports that still use it find the
-- right book.
--
-- Run this file before the deploy that ships the new keys.

create table if not exists public.book_rekey (
  book_id uuid primary key references public.books (id) on delete cascade,
  new_key text not null check (new_key ~ '\|'),
  old_key text,
  staged_at timestamptz not null default now()
);
alter table public.book_rekey enable row level security;
revoke all on public.book_rekey from public, anon, authenticated;

-- Step 1, from the admin page: up to 500 books per call.
create or replace function public.admin_stage_rekey(p_ids uuid[], p_keys text[])
returns integer
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  if cardinality(p_ids) is distinct from cardinality(p_keys) or cardinality(p_ids) > 500 then
    raise exception 'Send up to 500 ids with one key each' using errcode = '22023';
  end if;
  insert into public.book_rekey (book_id, new_key)
  select i, k from unnest(p_ids, p_keys) as t(i, k)
  join public.books b on b.id = t.i
  where k ~ '\|' and k <> b.dedupe_key
  on conflict (book_id) do update set new_key = excluded.new_key, staged_at = now();
  return (select count(*)::int from public.book_rekey);
end;
$$;
revoke all on function public.admin_stage_rekey(uuid[], text[]) from public, anon;
grant execute on function public.admin_stage_rekey(uuid[], text[]) to authenticated;

-- Start over (the admin page calls this before staging).
create or replace function public.admin_clear_rekey()
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  delete from public.book_rekey;
end;
$$;
revoke all on function public.admin_clear_rekey() from public, anon;
grant execute on function public.admin_clear_rekey() to authenticated;

-- Step 2, in the SQL Editor only.
create or replace function public.apply_book_rekey()
returns table (changed integer, merged integer)
language plpgsql security definer set search_path = public as $$
declare
  r record;
  other uuid;
  keep uuid;
  gone uuid;
  n_changed integer := 0;
  n_merged integer := 0;
begin
  -- Drop anything stale: books gone, or keys that no longer change.
  delete from public.book_rekey k using public.books b where b.id = k.book_id and b.dedupe_key = k.new_key;
  update public.book_rekey k set old_key = b.dedupe_key from public.books b where b.id = k.book_id;

  -- Park every changing book on a temporary key first, so a chain (A takes
  -- B's old key while B moves on) can't be mistaken for a duplicate.
  update public.books b set dedupe_key = 'rekey:' || b.id::text
  from public.book_rekey k where k.book_id = b.id;

  -- Most-shelved first, so the copy more readers have claims the key.
  for r in
    select k.book_id, k.new_key, k.old_key
    from public.book_rekey k
    order by (select count(*) from public.shelf_entries e where e.book_id = k.book_id) desc, k.book_id
  loop
    continue when not exists (select 1 from public.books where id = r.book_id); -- merged away already
    select id into other from public.books where dedupe_key = r.new_key;
    if other is null then
      update public.books set dedupe_key = r.new_key where id = r.book_id;
      keep := r.book_id;
      n_changed := n_changed + 1;
    else
      if (select count(*) from public.shelf_entries where book_id = other)
         >= (select count(*) from public.shelf_entries where book_id = r.book_id) then
        keep := other; gone := r.book_id;
      else
        keep := r.book_id; gone := other;
      end if;
      perform public.merge_books(keep, gone);
      if keep = r.book_id then
        update public.books set dedupe_key = r.new_key where id = keep;
      end if;
      n_merged := n_merged + 1;
    end if;
    -- The old key keeps finding this book (unless another book now owns it).
    insert into public.book_aliases (dedupe_key, book_id)
    select r.old_key, keep
    where r.old_key is not null and not exists (select 1 from public.books where dedupe_key = r.old_key)
    on conflict (dedupe_key) do update set book_id = excluded.book_id;
  end loop;

  -- Temporary keys and live keys never need aliases.
  delete from public.book_aliases a where a.dedupe_key like 'rekey:%'
     or exists (select 1 from public.books b where b.dedupe_key = a.dedupe_key);
  delete from public.book_rekey;
  return query select n_changed, n_merged;
end;
$$;
revoke all on function public.apply_book_rekey() from public, anon, authenticated;
