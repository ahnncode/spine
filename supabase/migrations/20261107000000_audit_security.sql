-- Security fixes from the November 2026 audit.

-- S1. Book descriptions: only readers who have the book on their shelf can
-- save one (same rule as the other set_book_* functions). Before this, any
-- signed-in account could write the first, locked-in description of any book.
create or replace function public.set_book_description(p_book uuid, p_text text, p_source text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_text text := nullif(btrim(left(coalesce(p_text, ''), 2500)), '');
begin
  if auth.uid() is null
     or not exists (select 1 from public.shelf_entries e where e.book_id = p_book and e.user_id = auth.uid()) then
    return;
  end if;
  if v_text is not null and (char_length(v_text) < 40 or p_source not in ('openlibrary', 'apple')) then
    v_text := null;
  end if;
  insert into book_descriptions (book_id, description, source, set_by, checked_at)
  values (p_book, v_text, case when v_text is not null then p_source end, auth.uid(), now())
  on conflict (book_id) do update
    set description = excluded.description, source = excluded.source,
        set_by = excluded.set_by, checked_at = now()
    where book_descriptions.description is null
      and (excluded.description is not null or book_descriptions.checked_at < now() - interval '7 days');
end;
$$;

-- S2. The head-to-head counter (Decisive badge) can't run ahead of the
-- matchups actually logged. It never goes down, so older counts from before
-- matchups were logged are kept.
create or replace function public.add_head_to_heads(n integer)
returns void language sql security definer set search_path = public as $$
  update public.profiles p
    set head_to_heads = greatest(
      p.head_to_heads,
      least(
        p.head_to_heads + least(greatest(coalesce(n, 0), 0), 20),
        (select count(*) from public.matchups m where m.user_id = p.id)::int
      )
    )
    where p.id = auth.uid();
$$;

-- S3. Who blocked whom is private. Signed-in readers only get an answer about
-- blocks they're part of; logged-out visitors can't call it at all. Calls from
-- inside the database (scheduled jobs, internal functions) still see every block.
create or replace function public.is_blocked(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select (
      coalesce(nullif(current_setting('role', true), 'none'), '') not in ('anon', 'authenticated')
      or auth.uid() in (a, b)
    )
    and exists (
      select 1 from public.blocks
      where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a)
    );
$$;
revoke execute on function public.is_blocked(uuid, uuid) from public, anon;
grant execute on function public.is_blocked(uuid, uuid) to authenticated;

-- S4. Taste match, similar readers and recommendations leave out anyone on
-- either side of a block with the viewer.
create or replace function public._public_scores()
returns table (user_id uuid, book_id uuid, score numeric)
language sql stable security definer set search_path = public as $$
  select r.user_id, r.book_id, r.score
  from public.ranked_entries r
  join public.profiles p on p.id = r.user_id
  where (not p.is_private or r.user_id = auth.uid())
    and not exists (
      select 1 from public.blocks bl
      where (bl.blocker_id = r.user_id and bl.blocked_id = auth.uid())
         or (bl.blocker_id = auth.uid() and bl.blocked_id = r.user_id)
    );
$$;
revoke all on function public._public_scores() from public, anon, authenticated;
