-- Spine: a short status line on profiles that everyone can see.

alter table public.profiles
  add column bio text,
  add constraint bio_length check (bio is null or char_length(bio) <= 160);

grant insert (bio) on public.profiles to authenticated;
grant update (bio) on public.profiles to authenticated;
grant select (bio) on public.profiles to authenticated;
