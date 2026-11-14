-- Volume numbers match however they're written (REA-102).
--
-- "On the Calculation of Volume 1" and "On the Calculation of Volume I" were
-- two books, because the near-identical-title check made numbers match
-- exactly and didn't know that I is 1. Now a volume number at the end of a
-- title counts the same as a Roman numeral, an Arabic one, or after "Book",
-- "Vol.", "Volume" or "Part": "volume i", "volume 1" and "volume (book i)"
-- all match. Volume I and Volume II still stay apart.
--
-- resolve_books() uses this check, so new imports and searches now find the
-- copy that already exists, and book_duplicates() lists the old pairs for
-- review. Mirrors sameBookKey in src/lib/books.ts.
--
-- Run this whole file once in the Supabase SQL Editor.

-- Word-for-word match, where one word may be cut short (3+ letters) and
-- numbers must be equal. Same rule as before, split out.
create or replace function public._same_words(wa text[], wb text[])
returns boolean language plpgsql immutable as $$
declare
  x text; y text; i int;
begin
  if coalesce(array_length(wa, 1), 0) = 0 or coalesce(array_length(wa, 1), 0) <> coalesce(array_length(wb, 1), 0) then
    return false;
  end if;
  for i in 1 .. array_length(wa, 1) loop
    x := wa[i]; y := wb[i];
    continue when x = y;
    if x ~ '\d' or y ~ '\d' then return false; end if;
    if length(x) > length(y) then
      if length(y) < 3 or left(x, length(y)) <> y then return false; end if;
    else
      if length(x) < 3 or left(y, length(x)) <> x then return false; end if;
    end if;
  end loop;
  return true;
end;
$$;

-- A title's spellings with its last-word volume number written one way:
-- "volume i" -> "volume 1"; "volume book i" -> also "volume 1" (the label
-- word dropped). Both are offered, since "volume" can be part of the title.
create or replace function public._volume_forms(w text[])
returns setof text[] language plpgsql immutable as $$
declare
  n int := coalesce(array_length(w, 1), 0);
  num text;
begin
  if n < 2 then
    return next w;
    return;
  end if;
  num := case w[n]
    when 'i' then '1' when 'ii' then '2' when 'iii' then '3' when 'iv' then '4' when 'v' then '5'
    when 'vi' then '6' when 'vii' then '7' when 'viii' then '8' when 'ix' then '9' when 'x' then '10'
    when 'xi' then '11' when 'xii' then '12' when 'xiii' then '13' when 'xiv' then '14' when 'xv' then '15'
    when 'xvi' then '16' when 'xvii' then '17' when 'xviii' then '18' when 'xix' then '19' when 'xx' then '20'
    else w[n] end;
  return next w[1:n-1] || num;
  if num ~ '^\d+$' and w[n-1] in ('book', 'vol', 'volume', 'part') then
    return next w[1:n-2] || num;
  end if;
end;
$$;

create or replace function public._same_book_key(a text, b text)
returns boolean language plpgsql immutable as $$
begin
  if a = b then return true; end if;
  if split_part(a, '|', 2) <> split_part(b, '|', 2) then return false; end if;
  return exists (
    select 1
    from public._volume_forms(string_to_array(split_part(a, '|', 1), ' ')) fa,
         public._volume_forms(string_to_array(split_part(b, '|', 1), ' ')) fb
    where public._same_words(fa, fb)
  );
end;
$$;

revoke all on function public._same_words(text[], text[]) from public, anon, authenticated;
revoke all on function public._volume_forms(text[]) from public, anon, authenticated;
