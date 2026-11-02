/** Quick tags for a finished book (keys match the database check). */
export const REVIEW_TAGS: Array<{ key: string; label: string }> = [
  { key: "unputdownable", label: "Couldn’t put it down" },
  { key: "gorgeous_writing", label: "Gorgeous writing" },
  { key: "loved_characters", label: "Loved the characters" },
  { key: "great_twist", label: "Great twist" },
  { key: "stuck_ending", label: "Stuck the ending" },
  { key: "made_me_cry", label: "Made me cry" },
  { key: "funny", label: "Funny" },
  { key: "reread", label: "Would re-read" },
  { key: "slow_start", label: "Slow start" },
  { key: "overhyped", label: "Overhyped" },
];

export const TAG_LABEL: Record<string, string> = Object.fromEntries(REVIEW_TAGS.map((t) => [t.key, t.label]));

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
