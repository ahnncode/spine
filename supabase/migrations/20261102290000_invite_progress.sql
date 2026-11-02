-- Spine: show invite progress as soon as a friend joins, and make referrals
-- survive opening the sign-in email on a different device.

-- 1. Who you've invited: joined, and how many have ranked the 3 books Connector needs.
create or replace function public.my_invites()
returns table (joined integer, qualified integer)
language sql stable security definer set search_path = public as $$
  select
    count(*)::int,
    count(*) filter (
      where (select count(*) from public.shelf_entries e where e.user_id = p.id and e.status = 'ranked') >= 3
    )::int
  from public.profiles p
  where p.referred_by = auth.uid();
$$;

revoke execute on function public.my_invites() from public, anon;
grant execute on function public.my_invites() to authenticated;

-- 2. The app now sends the inviter's username along with the sign-in request,
--    so the new account is credited even if the email opens somewhere else.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  ref uuid;
begin
  select id into ref from public.profiles
    where username = lower(new.raw_user_meta_data ->> 'ref') and id <> new.id;
  insert into public.profiles (id, referred_by) values (new.id, ref) on conflict (id) do nothing;
  return new;
end;
$$;
