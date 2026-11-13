-- Fill a demo account for YC partners (REA-76). Not a migration: run it by
-- hand in the Supabase SQL Editor, as often as you like (it starts fresh each time).
--
-- 1. Sign up a normal account in the app for the demo (for example with a
--    "+demo" Gmail alias), and give it a username.
-- 2. Put that username below, then run this whole file.
--
-- It gives the account about 150 ranked books (the most-shelved books on
-- readread, so covers and details are filled in), a few on the want-to-read
-- list, one in progress, and follows the admins. The account is added to
-- internal_accounts, so it never counts in the growth numbers.
do $$
declare
  demo_username text := 'demo';   -- change to the demo account's username
  demo uuid;
  n integer;
begin
  select p.id into demo from public.profiles p where p.username = demo_username;
  if demo is null then
    raise exception 'No account with username %. Sign it up in the app first.', demo_username;
  end if;
  if public.is_admin(demo) then
    raise exception 'That is an admin account. Use a separate demo account.';
  end if;

  insert into public.internal_accounts (user_id, note) values (demo, 'YC demo account')
  on conflict (user_id) do nothing;

  -- Start fresh.
  delete from public.shelf_entries s where s.user_id = demo;

  -- The best-known books with covers: most-shelved first, then the rest at random.
  create temporary table demo_books on commit drop as
  select b.id, row_number() over (order by pop desc, random()) as rn
  from (
    select b.id, (select count(*) from public.shelf_entries s where s.book_id = b.id) as pop
    from public.books b
    where (b.cover_url is not null or b.cover_id is not null) and b.author is not null
  ) b
  order by pop desc, random()
  limit 162;

  select count(*) into n from demo_books;
  if n < 30 then
    raise exception 'Only % books with covers in the catalog; add more before seeding.', n;
  end if;

  -- Ranked: the first ~150. Top 45% loved, next 40% fine, last 15% disliked.
  -- Higher sort_key ranks higher within a tier. Finished dates spread over 3 years.
  insert into public.shelf_entries (user_id, book_id, status, bucket, sort_key, needs_sort, compare_count,
                                    finished_on, ranked_at, source, created_at, updated_at)
  select demo, d.id, 'ranked',
    (case when d.rn <= ceil(r.total * 0.45) then 'loved'
          when d.rn <= ceil(r.total * 0.85) then 'fine'
          else 'disliked' end)::public.shelf_bucket,
    (r.total - d.rn + 1)::double precision,
    false, 2,
    (current_date - (random() * 1095)::integer),
    now() - (random() * interval '90 days'),
    'app', now(), now()
  from demo_books d
  cross join (select least(count(*), 150) as total from demo_books) r
  where d.rn <= r.total;

  -- A few saved for later, and one in progress.
  insert into public.shelf_entries (user_id, book_id, status, source)
  select demo, d.id, (case when d.rn = 151 then 'reading' else 'want' end), 'app'
  from demo_books d where d.rn > 150;

  -- Follow the admins, so the feed has someone in it.
  insert into public.follows (follower_id, followee_id)
  select demo, a.user_id from public.admins a
  on conflict do nothing;

  raise notice 'Demo account % filled with % books.', demo_username, n;
end;
$$;
