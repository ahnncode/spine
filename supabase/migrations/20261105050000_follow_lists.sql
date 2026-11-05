-- Followers / following lists. Yours are always open to you; someone else's
-- only when you follow each other.
create or replace function public.follow_list(p_user uuid, p_kind text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  me uuid := auth.uid();
begin
  if me is null or p_kind not in ('followers', 'following') then
    return jsonb_build_object('allowed', false, 'people', '[]'::jsonb);
  end if;
  if p_user <> me and not (
    exists (select 1 from follows where follower_id = me and followee_id = p_user)
    and exists (select 1 from follows where follower_id = p_user and followee_id = me)
  ) then
    return jsonb_build_object('allowed', false, 'people', '[]'::jsonb);
  end if;
  return jsonb_build_object('allowed', true, 'people', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', p.id, 'username', p.username, 'display_name', p.display_name,
      'avatar_icon', p.avatar_icon, 'avatar_color', p.avatar_color, 'created_at', p.created_at,
      'i_follow', exists (select 1 from follows x where x.follower_id = me and x.followee_id = p.id),
      'follows_me', exists (select 1 from follows x where x.follower_id = p.id and x.followee_id = me)
    ) order by f.created_at desc)
    from follows f
    join profiles p on p.id = case when p_kind = 'followers' then f.follower_id else f.followee_id end
    where (case when p_kind = 'followers' then f.followee_id else f.follower_id end) = p_user
      and p.username is not null
      and not public.is_blocked(me, p.id)
  ), '[]'::jsonb));
end;
$$;
revoke all on function public.follow_list(uuid, text) from public, anon;
grant execute on function public.follow_list(uuid, text) to authenticated;
