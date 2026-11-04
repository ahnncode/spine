-- The app is now ReadRead: keep its names from being taken as usernames.
-- NOT VALID: checks new and changed usernames without failing on existing ones.
alter table public.profiles drop constraint if exists username_not_reserved;
alter table public.profiles add constraint username_not_reserved check (
  username is null or username not in (
    'admin', 'administrator', 'root', 'support', 'help', 'spine', 'readspine', 'readread', 'readreadapp',
    'staff', 'team', 'mod', 'moderator', 'official', 'security', 'system', 'api', 'www', 'mail', 'about',
    'settings', 'login', 'signup', 'feed', 'search', 'shelf', 'you', 'people', 'welcome', 'import', 'scan', 'wrap'
  )
) not valid;
