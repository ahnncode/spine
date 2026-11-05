-- readread: genre-specific quick tags. Keys never change (labels can), so
-- they can be counted and filtered later. Keep in sync with ALL_TAG_KEYS in
-- src/lib/thoughts.ts.

alter table public.shelf_entries drop constraint if exists tags_valid;
alter table public.shelf_entries add constraint tags_valid check (
  cardinality(tags) <= 6 and tags <@ array[
    -- any book
    'unputdownable', 'gorgeous_writing', 'made_me_cry', 'funny', 'reread', 'slow_start', 'overhyped',
    -- literary
    'loved_characters', 'quietly_devastating', 'stuck_ending', 'book_club_pick',
    -- fantasy
    'worldbuilding', 'magic_system', 'needed_map', 'need_sequel', 'found_family',
    -- sci-fi
    'big_ideas', 'science_checks_out', 'mind_bending', 'felt_too_real', 'best_alien',
    -- mystery
    'great_twist', 'guessed_early', 'edge_of_seat', 'one_night', 'red_herrings',
    -- romance
    'slow_burn', 'the_banter', 'swoon', 'spicy', 'third_act_breakup',
    -- horror
    'lights_on', 'actually_scary', 'gross_good', 'not_scary',
    -- historical
    'transported', 'learned_so_much', 'epic_scope', 'want_more_history',
    -- classics
    'worth_hype', 'surprisingly_modern', 'hard_going', 'finally_read',
    -- memoir
    'so_brave', 'wild_life', 'want_to_meet', 'self_indulgent',
    -- history and science
    'learned_a_ton', 'changed_my_mind', 'explained_well', 'could_be_article',
    -- poetry
    'read_aloud', 'lines_ill_keep', 'didnt_click'
  ]::text[]
);

-- For later: "books my friends called spicy", tag counts per book, filters.
create index if not exists shelf_entries_tags_idx on public.shelf_entries using gin (tags);
