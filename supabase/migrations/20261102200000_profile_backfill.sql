-- Accounts created before the profile trigger existed have no profile row.
-- Give every account one, and let readers create their own if it's missing.

insert into public.profiles (id, display_name)
select u.id, split_part(u.email, '@', 1)
from auth.users u
on conflict (id) do nothing;

create policy "readers create their own profile"
  on public.profiles for insert to authenticated
  with check (auth.uid() = id);
