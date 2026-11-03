-- Spine: pick a profile picture (an icon on a color). Ten icons unlock with badges.

alter table public.profiles
  add column avatar_icon text,
  add column avatar_color text,
  add constraint avatar_icon_valid check (avatar_icon is null or avatar_icon in (
    'book','moon','sun','leaf','peaks','wave','star','mug','cat','specs',
    'owl','fox','flame','quill','lantern','whale','comet','telescope','lighthouse','crown'
  )),
  add constraint avatar_color_valid check (avatar_color is null or avatar_color in (
    'ink','ember','cobalt','forest','lagoon','plum','rust','honey','navy','blush'
  ));

grant insert (avatar_icon, avatar_color) on public.profiles to authenticated;
grant update (avatar_icon, avatar_color) on public.profiles to authenticated;
grant select (avatar_icon, avatar_color) on public.profiles to authenticated;

-- Locked icons need their badge (checked here, so it can't be skipped).
create or replace function public.check_avatar_unlock()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  needed text := case new.avatar_icon
    when 'owl' then 'shelf_starter'
    when 'fox' then 'explorer'
    when 'flame' then 'steady'
    when 'quill' then 'critic'
    when 'lantern' then 'daily_pages'
    when 'whale' then 'bookworm'
    when 'comet' then 'decisive'
    when 'telescope' then 'time_traveler'
    when 'lighthouse' then 'connector'
    when 'crown' then 'century'
  end;
begin
  if needed is not null
     and new.avatar_icon is distinct from (case when tg_op = 'UPDATE' then old.avatar_icon end)
     and not exists (select 1 from public.badge_awards a where a.user_id = new.id and a.badge = needed) then
    raise exception 'That picture unlocks with a badge you haven''t earned yet' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke execute on function public.check_avatar_unlock() from public, anon, authenticated;

create trigger profiles_avatar_unlock
  before insert or update of avatar_icon on public.profiles
  for each row execute function public.check_avatar_unlock();

-- Invite pages show the inviter's picture too.
drop function if exists public.invite_info(text);
create function public.invite_info(p_username text)
returns table (display_name text, username text, avatar_icon text, avatar_color text)
language sql stable security definer set search_path = public as $$
  select p.display_name, p.username, p.avatar_icon, p.avatar_color from public.profiles p
  where p.username = lower(p_username) and p.username is not null;
$$;
grant execute on function public.invite_info(text) to anon, authenticated;
