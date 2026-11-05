-- readread: five more genres (business & self-help, true crime, graphic
-- novels, young adult, essays/nature/travel) and their quick tags. Keep the
-- lists in sync with GENRES in src/lib/genres.ts and ALL_TAG_KEYS in
-- src/lib/thoughts.ts.

alter table public.books drop constraint if exists genres_valid;
alter table public.books add constraint genres_valid check (
  cardinality(genres) <= 5 and genres <@ array['literary', 'scifi', 'fantasy', 'mystery', 'romance', 'horror', 'historical', 'classics', 'history', 'memoir', 'science', 'poetry', 'business', 'truecrime', 'graphic', 'ya', 'essays']::text[]
);

create or replace function public.set_book_genre(p_book uuid, p_genre text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or p_genre not in ('literary', 'scifi', 'fantasy', 'mystery', 'romance', 'horror', 'historical', 'classics', 'history', 'memoir', 'science', 'poetry', 'business', 'truecrime', 'graphic', 'ya', 'essays') then
    return false;
  end if;
  update public.books b set genres = array[p_genre], enriched = true, genre_set_by = auth.uid()
    where b.id = p_book
      and exists (select 1 from public.shelf_entries e where e.book_id = p_book and e.user_id = auth.uid())
      and (
        b.genres = '{}'
        or b.genre_set_by = auth.uid()
        or not exists (select 1 from public.shelf_entries e where e.book_id = p_book and e.user_id <> auth.uid())
      );
  return found;
end;
$$;

alter table public.shelf_entries drop constraint if exists tags_valid;
alter table public.shelf_entries add constraint tags_valid check (
  cardinality(tags) <= 6 and tags <@ array[
    'unputdownable', 'gorgeous_writing', 'made_me_cry', 'funny', 'reread', 'slow_start', 'overhyped', 'loved_characters',
    'quietly_devastating', 'stuck_ending', 'book_club_pick', 'worldbuilding', 'magic_system', 'needed_map', 'need_sequel', 'found_family',
    'big_ideas', 'science_checks_out', 'mind_bending', 'felt_too_real', 'best_alien', 'great_twist', 'guessed_early', 'edge_of_seat',
    'one_night', 'red_herrings', 'slow_burn', 'the_banter', 'swoon', 'spicy', 'third_act_breakup', 'lights_on',
    'actually_scary', 'gross_good', 'not_scary', 'transported', 'learned_so_much', 'epic_scope', 'want_more_history', 'worth_hype',
    'surprisingly_modern', 'hard_going', 'finally_read', 'so_brave', 'wild_life', 'want_to_meet', 'self_indulgent', 'learned_a_ton',
    'changed_my_mind', 'explained_well', 'could_be_article', 'read_aloud', 'lines_ill_keep', 'didnt_click', 'actually_useful', 'changed_how_i_work',
    'already_using_it', 'too_many_anecdotes', 'could_be_blog_post', 'deeply_researched', 'chilling', 'respectful', 'wanted_answers', 'bit_sensational',
    'stunning_art', 'art_tells_it', 'one_sitting', 'want_whole_series', 'hard_to_follow', 'wish_read_at_15', 'adults_too', 'so_angsty',
    'love_triangle', 'underlined_everything', 'want_to_go', 'made_me_slow_down', 'so_quotable', 'hit_and_miss'
  ]::text[]
);

-- Books we couldn't place before get looked up again (as people browse their
-- shelves), so e.g. Radical Candor lands in Business & self-help.
update public.books set enriched = false where genres = '{}' and genre_set_by is null;
