-- Tell admins in the app when a tagged signup lands: the first reader from
-- each source (reddit, tiktok…), then milestones (10, 25, 50, 100, 250, 500,
-- 1000). The new reader is the notification's actor; detail is
-- "<source>:<count>".

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('reaction', 'comment', 'follow', 'badge', 'mention', 'poke', 'read_along', 'picks', 'ask', 'room', 'club', 'growth'));

create or replace function public.set_signup_source(p_source text, p_campaign text default null)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  src text := left(lower(regexp_replace(coalesce(p_source, ''), '[^A-Za-z0-9_.-]', '', 'g')), 40);
  camp text := nullif(left(lower(regexp_replace(coalesce(p_campaign, ''), '[^A-Za-z0-9_.-]', '', 'g')), 60), '');
  n integer;
begin
  if auth.uid() is null or src = '' then
    return false;
  end if;
  update public.profiles
    set signup_source = src, signup_campaign = camp
    where id = auth.uid() and signup_source is null and created_at > now() - interval '1 day';
  if not found then
    return false;
  end if;

  if not public.is_internal(auth.uid()) then
    select count(*) into n from public.profiles p
    where p.signup_source = src and not public.is_internal(p.id);
    if n in (1, 10, 25, 50, 100, 250, 500, 1000) then
      insert into public.notifications (user_id, actor_id, kind, detail)
      select a.user_id, auth.uid(), 'growth', src || ':' || n from public.admins a;
    end if;
  end if;
  return true;
end;
$$;
revoke execute on function public.set_signup_source(text, text) from public, anon;
grant execute on function public.set_signup_source(text, text) to authenticated;
