-- Spine, security hardening.

-- 1. Don't publish part of anyone's email address. New profiles start blank
--    until the reader picks a name; early profiles that copied the email
--    prefix and never finished setup are cleared.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;

update public.profiles set display_name = null where username is null;

-- 2. Sensible limits on what readers can store, enforced by the database
--    rather than only by the app. First tidy any existing rows that wouldn't fit.
update public.profiles set display_name = left(display_name, 40) where char_length(display_name) > 40;
update public.profiles set display_name = null where display_name = '';
update public.books set isbn13 = null where isbn13 !~ '^97[89][0-9]{10}$';
update public.books set pages = null where pages < 1 or pages > 50000;
update public.books set year = null where year < -3000 or year > 2100;
update public.books set cover_id = null where cover_id <= 0;
update public.books set author = left(author, 300) where char_length(author) > 300;
update public.books set title = left(title, 500) where char_length(title) > 500;
update public.shelf_entries set stars = null where stars < 1 or stars > 5;

alter table public.profiles
  add constraint display_name_length check (display_name is null or char_length(display_name) between 1 and 40),
  add constraint username_not_reserved check (
    username is null or username not in (
      'admin', 'administrator', 'root', 'support', 'help', 'spine', 'readspine', 'staff', 'team',
      'mod', 'moderator', 'official', 'security', 'system', 'api', 'www', 'mail', 'about', 'settings',
      'login', 'signup', 'feed', 'search', 'shelf', 'you', 'people', 'welcome', 'import', 'scan', 'wrap'
    )
  );

alter table public.books
  add constraint title_length check (char_length(title) between 1 and 500),
  add constraint author_length check (author is null or char_length(author) <= 300),
  add constraint dedupe_key_length check (char_length(dedupe_key) <= 800),
  add constraint isbn13_format check (isbn13 is null or isbn13 ~ '^97[89][0-9]{10}$'),
  add constraint year_range check (year is null or year between -3000 and 2100),
  add constraint pages_range check (pages is null or pages between 1 and 50000),
  add constraint cover_id_range check (cover_id is null or cover_id > 0),
  add constraint genres_valid check (
    cardinality(genres) <= 5 and genres <@ array[
      'literary', 'scifi', 'fantasy', 'mystery', 'romance', 'horror', 'historical',
      'classics', 'history', 'memoir', 'science', 'poetry'
    ]::text[]
  );

alter table public.shelf_entries
  add constraint note_length check (note is null or char_length(note) <= 2000),
  add constraint stars_range check (stars is null or stars between 1 and 5);

-- 3. Timestamps can't be set in the future (which would pin a post to the
--    top of friends' feeds).
create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  if new.ranked_at is not null and new.ranked_at > now() then
    new.ranked_at = now();
  end if;
  return new;
end;
$$;

drop trigger shelf_entries_touch on public.shelf_entries;
create trigger shelf_entries_touch
  before insert or update on public.shelf_entries
  for each row execute function public.touch_updated_at();

-- 4. Private readers' follow lists stay private too.
drop policy "follows are visible to signed-in readers" on public.follows;
create policy "follows are visible unless private"
  on public.follows for select to authenticated using (
    follower_id = auth.uid()
    or followee_id = auth.uid()
    or (public.is_visible(follower_id) and public.is_visible(followee_id))
  );

-- 5. Enrichment only accepts valid values (the table checks above also apply).
create or replace function public.enrich_book(
  p_book uuid, p_cover integer, p_genres text[], p_year integer, p_pages integer, p_work text
) returns void language sql security definer set search_path = public as $$
  update public.books set
    cover_id = coalesce(cover_id, case when p_cover > 0 then p_cover end),
    genres = case when genres = '{}' then coalesce(p_genres[1:3], '{}') else genres end,
    year = coalesce(year, case when p_year between -3000 and 2100 then p_year end),
    pages = coalesce(pages, case when p_pages between 1 and 50000 then p_pages end),
    ol_work_key = coalesce(ol_work_key, case when p_work ~ '^/works/OL[0-9]+W$' then p_work end),
    enriched = true
  where id = p_book and auth.uid() is not null;
$$;

-- 6. Readers can delete their account and everything in it.
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- 7. Helper functions nobody should call directly.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.touch_updated_at() from public, anon, authenticated;
revoke execute on function public.is_visible(uuid) from anon;
