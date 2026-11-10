-- readread: a profile-picture icon for each reader type ("rt_whfe" and so on).
-- You earn a type's icon by having that type, now or at any point before
-- (reader_type_history), and keep it even if your type moves on.

alter table public.profiles drop constraint if exists avatar_icon_valid;
alter table public.profiles add constraint avatar_icon_valid check (avatar_icon is null or avatar_icon in (
  'book','moon','sun','leaf','peaks','wave','star','mug','cat','specs',
  'owl','fox','flame','quill','lantern','whale','comet','telescope','lighthouse','crown',
  'rt_whfe','rt_whfc','rt_whge','rt_whgc','rt_wmfe','rt_wmfc','rt_wmge','rt_wmgc',
  'rt_dhfe','rt_dhfc','rt_dhge','rt_dhgc','rt_dmfe','rt_dmfc','rt_dmge','rt_dmgc'
));

-- Locked icons need their badge, or for type icons, that type (checked here,
-- so it can't be skipped).
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
  type_code text := case when new.avatar_icon like 'rt\_%' then upper(substr(new.avatar_icon, 4)) end;
begin
  if new.avatar_icon is not distinct from (case when tg_op = 'UPDATE' then old.avatar_icon end) then
    return new;
  end if;
  if needed is not null
     and not exists (select 1 from public.badge_awards a where a.user_id = new.id and a.badge = needed) then
    raise exception 'That picture unlocks with a badge you haven''t earned yet' using errcode = '42501';
  end if;
  if type_code is not null
     and not exists (select 1 from public.reader_types t where t.user_id = new.id and t.code = type_code)
     and not exists (select 1 from public.reader_type_history h where h.user_id = new.id and h.code = type_code) then
    raise exception 'That picture comes with a reader type you haven''t had yet' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke execute on function public.check_avatar_unlock() from public, anon, authenticated;
