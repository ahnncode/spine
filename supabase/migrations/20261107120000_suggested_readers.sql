-- readread: readers to follow from day one. "Readers like you" needs three
-- books in common before it shows anyone, so a new reader saw an empty list.
-- This suggests public readers who have ranked at least three books, putting
-- those who share any of your books first, then the most recently active.
create or replace function public.suggested_readers(p_limit integer default 12)
returns table (user_id uuid, shared integer, ranked integer)
language sql stable security definer set search_path = public as $$
  with mine as (
    select book_id from public.shelf_entries where user_id = auth.uid() and status = 'ranked'
  ), theirs as (
    select e.user_id,
           count(*) as ranked,
           count(*) filter (where e.book_id in (select book_id from mine)) as shared,
           max(e.ranked_at) as last_ranked
    from public.shelf_entries e
    join public.profiles p on p.id = e.user_id
    where e.status = 'ranked'
      and e.user_id <> auth.uid()
      and not p.is_private
      and p.username is not null
      and not public.is_blocked(e.user_id, auth.uid())
      and not exists (select 1 from public.follows f where f.follower_id = auth.uid() and f.followee_id = e.user_id)
    group by e.user_id
    having count(*) >= 3
  )
  select user_id, shared::int, ranked::int
  from theirs
  order by shared desc, last_ranked desc nulls last
  limit least(greatest(p_limit, 1), 50);
$$;
revoke all on function public.suggested_readers(integer) from public, anon;
grant execute on function public.suggested_readers(integer) to authenticated;
