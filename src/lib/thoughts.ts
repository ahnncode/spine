/**
 * Quick tags for a finished book. Keys are stored on the entry (and checked
 * by the database), so they can be counted, sorted and filtered later.
 * Never rename a key: change its label instead.
 */
export type Tag = { key: string; label: string };

/** Fit any book; always shown. */
export const CORE_TAGS: Tag[] = [
  { key: "unputdownable", label: "Couldn’t put it down" },
  { key: "gorgeous_writing", label: "Gorgeous writing" },
  { key: "made_me_cry", label: "Made me cry" },
  { key: "funny", label: "Funny" },
  { key: "reread", label: "Would re-read" },
  { key: "slow_start", label: "Slow start" },
  { key: "overhyped", label: "Overhyped" },
];

/** Made for the book's main genre (genre keys from genres.ts). */
export const GENRE_TAGS: Record<string, Tag[]> = {
  literary: [
    { key: "loved_characters", label: "Loved the characters" },
    { key: "quietly_devastating", label: "Quiet but devastating" },
    { key: "stuck_ending", label: "Stuck the ending" },
    { key: "book_club_pick", label: "Book club pick" },
  ],
  fantasy: [
    { key: "worldbuilding", label: "Worldbuilding 10/10" },
    { key: "magic_system", label: "The magic system" },
    { key: "needed_map", label: "Needed the map" },
    { key: "need_sequel", label: "Need the sequel now" },
    { key: "found_family", label: "Found family" },
  ],
  scifi: [
    { key: "big_ideas", label: "Big ideas" },
    { key: "science_checks_out", label: "Science checks out" },
    { key: "mind_bending", label: "Mind-bending" },
    { key: "felt_too_real", label: "Felt too real" },
    { key: "best_alien", label: "Best alien ever" },
  ],
  mystery: [
    { key: "great_twist", label: "Didn’t see it coming" },
    { key: "guessed_early", label: "Guessed it early" },
    { key: "edge_of_seat", label: "Edge of my seat" },
    { key: "one_night", label: "Read it in one night" },
    { key: "red_herrings", label: "Red herrings galore" },
  ],
  romance: [
    { key: "slow_burn", label: "Slow burn" },
    { key: "the_banter", label: "The banter" },
    { key: "swoon", label: "Swoon-worthy" },
    { key: "spicy", label: "Spicy" },
    { key: "third_act_breakup", label: "Third-act breakup (ugh)" },
  ],
  horror: [
    { key: "lights_on", label: "Slept with the lights on" },
    { key: "actually_scary", label: "Actually scary" },
    { key: "gross_good", label: "Gross (good)" },
    { key: "not_scary", label: "Not scary enough" },
  ],
  historical: [
    { key: "transported", label: "Transported me" },
    { key: "learned_so_much", label: "Learned so much" },
    { key: "epic_scope", label: "Epic in scope" },
    { key: "want_more_history", label: "Want to read more about it" },
  ],
  classics: [
    { key: "worth_hype", label: "Worth the hype" },
    { key: "surprisingly_modern", label: "Surprisingly modern" },
    { key: "hard_going", label: "Hard going" },
    { key: "finally_read", label: "Glad I finally read it" },
  ],
  memoir: [
    { key: "so_brave", label: "So brave" },
    { key: "wild_life", label: "Wild life" },
    { key: "want_to_meet", label: "Want to meet them" },
    { key: "learned_so_much", label: "Learned so much" },
    { key: "self_indulgent", label: "A bit self-indulgent" },
  ],
  history: [
    { key: "learned_a_ton", label: "Learned a ton" },
    { key: "changed_my_mind", label: "Changed my mind" },
    { key: "explained_well", label: "Explained it well" },
    { key: "could_be_article", label: "Could’ve been an article" },
  ],
  science: [
    { key: "learned_a_ton", label: "Learned a ton" },
    { key: "changed_my_mind", label: "Changed my mind" },
    { key: "explained_well", label: "Explained it well" },
    { key: "could_be_article", label: "Could’ve been an article" },
  ],
  poetry: [
    { key: "read_aloud", label: "Read it out loud" },
    { key: "lines_ill_keep", label: "Lines I’ll keep" },
    { key: "didnt_click", label: "Didn’t click" },
  ],
  business: [
    { key: "actually_useful", label: "Actually useful" },
    { key: "changed_how_i_work", label: "Changed how I work" },
    { key: "already_using_it", label: "Already using it" },
    { key: "too_many_anecdotes", label: "Too many anecdotes" },
    { key: "could_be_blog_post", label: "Could’ve been a blog post" },
  ],
  truecrime: [
    { key: "deeply_researched", label: "Deeply researched" },
    { key: "chilling", label: "Chilling" },
    { key: "respectful", label: "Respectful to the victims" },
    { key: "wanted_answers", label: "Still want answers" },
    { key: "bit_sensational", label: "A bit sensational" },
  ],
  graphic: [
    { key: "stunning_art", label: "Stunning art" },
    { key: "art_tells_it", label: "The art tells the story" },
    { key: "one_sitting", label: "Read it in one sitting" },
    { key: "want_whole_series", label: "Want the whole series" },
    { key: "hard_to_follow", label: "Hard to follow" },
  ],
  ya: [
    { key: "wish_read_at_15", label: "Wish I’d read it at 15" },
    { key: "adults_too", label: "Adults will love it too" },
    { key: "found_family", label: "Found family" },
    { key: "so_angsty", label: "So angsty" },
    { key: "love_triangle", label: "Love triangle (ugh)" },
  ],
  essays: [
    { key: "underlined_everything", label: "Underlined everything" },
    { key: "want_to_go", label: "Want to go there now" },
    { key: "made_me_slow_down", label: "Made me slow down" },
    { key: "so_quotable", label: "So quotable" },
    { key: "hit_and_miss", label: "Some hit, some missed" },
  ],
};

/** Tags for a book: its main genre's set (if any), then the ones for any book. */
export function tagsFor(genres: string[] | null | undefined): { genre: string | null; genreTags: Tag[]; core: Tag[] } {
  const genre = (genres ?? []).find((g) => GENRE_TAGS[g]) ?? null;
  return { genre, genreTags: genre ? GENRE_TAGS[genre] : [], core: CORE_TAGS };
}

/** Every key the database accepts (keep in sync with the tags_valid check). */
export const ALL_TAG_KEYS = [...new Set([...CORE_TAGS, ...Object.values(GENRE_TAGS).flat()].map((t) => t.key))];

export const TAG_LABEL: Record<string, string> = Object.fromEntries(
  [...CORE_TAGS, ...Object.values(GENRE_TAGS).flat()].map((t) => [t.key, t.label]),
);

/** How a check-in is going (keys match the database check). */
export const VIBES: Array<{ key: string; label: string }> = [
  { key: "hooked", label: "Hooked" },
  { key: "loving", label: "Loving it" },
  { key: "cant_stop", label: "Can’t stop" },
  { key: "slogging", label: "Slogging" },
  { key: "confused", label: "Confused" },
  { key: "need_break", label: "Need a break" },
];

export const VIBE_LABEL: Record<string, string> = Object.fromEntries(VIBES.map((v) => [v.key, v.label]));

export const NOTE_MAX = 2000;
export const CHECKIN_NOTE_MAX = 280;
export const COMMENT_MAX = 1000;
