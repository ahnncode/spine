/** The badge case. Keys match refresh_badges() in the database. */

export type BadgeCategory = "start" | "depth" | "consistency" | "breadth" | "taste" | "social" | "secret";
export type Rarity = "common" | "uncommon" | "rare" | "legendary";
export type Glyph =
  | "book" | "box" | "bookmark" | "shelf" | "seal" | "worm" | "hundred" | "card" | "brick" | "pages" | "mountain"
  | "flame" | "leaf" | "infinity" | "sun" | "target" | "calendar" | "compass" | "globe" | "hourglass" | "quill"
  | "press" | "voices" | "swords" | "pen" | "bolt" | "twin" | "people" | "chat" | "link" | "club" | "candle" | "headphones" | "both"
  | "leap" | "pumpkin" | "anchor" | "abc" | "coffee" | "crystal" | "glasses" | "knock" | "spark";

export interface BadgeDef {
  key: string;
  name: string;
  /** What earns it, as a short instruction. */
  how: string;
  category: BadgeCategory;
  rarity: Rarity;
  glyph: Glyph;
  /** Unit for progress ("12 of 50 books"). Omitted for yes/no badges. */
  unit?: string;
  /** Hidden until earned: no name, no hint, no progress. */
  secret?: boolean;
}

export const BADGES: BadgeDef[] = [
  { key: "first_chapter", name: "First Chapter", how: "Rank your first book", category: "start", rarity: "common", glyph: "book", unit: "book" },
  { key: "moving_in", name: "Moving In", how: "Import your Goodreads or StoryGraph library", category: "start", rarity: "common", glyph: "box" },
  { key: "wishlist", name: "Wishlist", how: "Save 5 books to want to read", category: "start", rarity: "common", glyph: "bookmark", unit: "book" },
  { key: "shelf_starter", name: "Shelf Starter", how: "Rank 10 books", category: "start", rarity: "common", glyph: "shelf", unit: "book" },
  { key: "early_adopter", name: "Early Adopter", how: "Joined readread in its first year", category: "start", rarity: "legendary", glyph: "seal" },

  { key: "bookworm", name: "Bookworm", how: "Rank 50 books", category: "depth", rarity: "uncommon", glyph: "worm", unit: "book" },
  { key: "century", name: "Century", how: "Rank 100 books", category: "depth", rarity: "rare", glyph: "hundred", unit: "book" },
  { key: "library_card", name: "Library Card", how: "Rank 250 books", category: "depth", rarity: "legendary", glyph: "card", unit: "book" },
  { key: "doorstopper", name: "Doorstopper", how: "Rank a book over 700 pages", category: "depth", rarity: "uncommon", glyph: "brick" },
  { key: "page_turner", name: "Page Turner", how: "Rank 10,000 pages in total", category: "depth", rarity: "uncommon", glyph: "pages", unit: "page" },
  { key: "long_haul", name: "The Long Haul", how: "Rank 50,000 pages in total", category: "depth", rarity: "rare", glyph: "mountain", unit: "page" },

  { key: "steady", name: "Steady", how: "Keep a 4-week reading streak", category: "consistency", rarity: "common", glyph: "flame", unit: "week" },
  { key: "season_reader", name: "Season Reader", how: "Keep a 12-week reading streak", category: "consistency", rarity: "uncommon", glyph: "leaf", unit: "week" },
  { key: "unbroken", name: "Unbroken", how: "Keep a 52-week reading streak", category: "consistency", rarity: "legendary", glyph: "infinity", unit: "week" },
  { key: "daily_pages", name: "Daily Pages", how: "Check in 7 days in a row", category: "consistency", rarity: "uncommon", glyph: "sun", unit: "day" },
  { key: "goal_getter", name: "Goal Getter", how: "Hit your yearly reading goal", category: "consistency", rarity: "rare", glyph: "target" },
  { key: "every_month", name: "Every Month", how: "Finish a book in all 12 months of a year", category: "consistency", rarity: "rare", glyph: "calendar" },
  { key: "scrooge", name: "Scrooge", how: "Log reading on Christmas Day. Bah, humbug.", category: "consistency", rarity: "rare", glyph: "candle" },

  { key: "explorer", name: "Explorer", how: "Rank books from 5 genres", category: "breadth", rarity: "common", glyph: "compass", unit: "genre" },
  { key: "full_passport", name: "Full Passport", how: "Rank books from 12 different genres", category: "breadth", rarity: "rare", glyph: "globe", unit: "genre" },
  { key: "time_traveler", name: "Time Traveler", how: "Rank books from 4 different centuries", category: "breadth", rarity: "rare", glyph: "hourglass", unit: "century" },
  { key: "old_soul", name: "Old Soul", how: "Rank a book published before 1900", category: "breadth", rarity: "uncommon", glyph: "quill" },
  { key: "hot_off_the_press", name: "Hot Off the Press", how: "Finish a book the year it came out", category: "breadth", rarity: "uncommon", glyph: "press" },
  { key: "all_ears", name: "All Ears", how: "Rank 10 books you listened to", category: "breadth", rarity: "uncommon", glyph: "headphones", unit: "audiobook" },
  { key: "both_ways", name: "Both Ways", how: "Finish a book you read and one you listened to in the same month", category: "breadth", rarity: "uncommon", glyph: "both" },
  { key: "many_voices", name: "Many Voices", how: "Rank books by 50 different authors", category: "breadth", rarity: "rare", glyph: "voices", unit: "author" },

  { key: "decisive", name: "Decisive", how: "Answer 100 head-to-heads", category: "taste", rarity: "uncommon", glyph: "swords", unit: "head-to-head" },
  { key: "critic", name: "Critic", how: "Add thoughts to 10 books", category: "taste", rarity: "uncommon", glyph: "pen", unit: "book" },
  { key: "hot_take", name: "Hot Take", how: "Score a book 3+ points off the community, with 10+ readers", category: "taste", rarity: "rare", glyph: "bolt" },
  { key: "reading_twin", name: "Reading Twin", how: "Find a reader with a 90%+ taste match", category: "taste", rarity: "rare", glyph: "twin" },

  { key: "good_company", name: "Good Company", how: "Follow 10 readers", category: "social", rarity: "common", glyph: "people", unit: "reader" },
  { key: "conversation_starter", name: "Conversation Starter", how: "Get 10 comments on your rankings", category: "social", rarity: "uncommon", glyph: "chat", unit: "comment" },
  { key: "connector", name: "Connector", how: "Invite 3 friends who each rank 3 books", category: "social", rarity: "rare", glyph: "link", unit: "friend" },
  { key: "book_club", name: "Book Club", how: "Finish a read-along with friends", category: "social", rarity: "uncommon", glyph: "club" },

  // Secret: shown as "?" until earned.
  { key: "leap_reader", name: "Leap Reader", how: "Logged reading on February 29", category: "secret", rarity: "legendary", glyph: "leap", secret: true },
  { key: "trick_or_read", name: "Trick or Read", how: "Finished a horror book on Halloween", category: "secret", rarity: "rare", glyph: "pumpkin", secret: true },
  { key: "sunk_cost", name: "Sunk Cost", how: "Read 500+ pages of a book, then ranked it “not for me”", category: "secret", rarity: "rare", glyph: "anchor", secret: true },
  { key: "alphabet_soup", name: "Alphabet Soup", how: "Ranked books whose titles start with every letter, A to Z", category: "secret", rarity: "legendary", glyph: "abc", secret: true },
  { key: "one_sitting", name: "One Sitting", how: "Started and finished a 400+ page book on the same day", category: "secret", rarity: "legendary", glyph: "coffee", secret: true },
  { key: "long_goodbye", name: "The Long Goodbye", how: "Finished a book a year or more after starting it", category: "secret", rarity: "rare", glyph: "hourglass", secret: true },
  { key: "called_it", name: "Called It", how: "Loved your weekly mystery pick", category: "secret", rarity: "rare", glyph: "crystal", secret: true },
  { key: "very_meta", name: "Very Meta", how: "Ranked a book about books", category: "secret", rarity: "rare", glyph: "glasses", secret: true },
  { key: "persistent", name: "Persistent", how: "Poked the same friend 7 days in a row", category: "secret", rarity: "rare", glyph: "knock", secret: true },
  { key: "mind_meld", name: "Mind Meld", how: "Had the exact same top 3 as someone you follow", category: "secret", rarity: "legendary", glyph: "spark", secret: true },
];

export const BADGE: Record<string, BadgeDef> = Object.fromEntries(BADGES.map((b) => [b.key, b]));

export const CATEGORY_LABEL: Record<BadgeCategory, string> = {
  start: "Getting started",
  depth: "Depth",
  consistency: "Consistency",
  breadth: "Breadth",
  taste: "Taste",
  social: "Social",
  secret: "Secret",
};

/** Medallion face colors per category: [background, glyph]. */
export const CATEGORY_COLOR: Record<BadgeCategory, [string, string]> = {
  start: ["#FF5A1F", "#111111"],
  depth: ["#111111", "#F7F7F5"],
  consistency: ["#2D3FE0", "#FFFFFF"],
  breadth: ["#0F5257", "#E6F2EF"],
  taste: ["#7A2E4D", "#FCE9F0"],
  social: ["#F2C14E", "#111111"],
  secret: ["#2A1F4F", "#F2C14E"],
};

export const RARITY_LABEL: Record<Rarity, string> = {
  common: "Common",
  uncommon: "Uncommon",
  rare: "Rare",
  legendary: "Legendary",
};

/** Rarest first: legendary badges lead every list. */
export const RARITY_RANK: Record<Rarity, number> = { legendary: 0, rare: 1, uncommon: 2, common: 3 };

/** Earned badges, rarest first, newest first within a rarity. */
export function byRarity<T extends { key: string; earned_at?: string | null; earned?: string | null }>(list: T[]): T[] {
  const at = (x: T) => x.earned_at ?? x.earned ?? "";
  return list
    .filter((x) => BADGE[x.key])
    .slice()
    .sort((a, b) => RARITY_RANK[BADGE[a.key].rarity] - RARITY_RANK[BADGE[b.key].rarity] || at(b).localeCompare(at(a)));
}

export interface BadgeStatus {
  key: string;
  progress: number;
  goal: number;
  earned: string | null;
  fresh: boolean;
}

/** "12 of 50 books", or null for yes/no badges. */
export function progressLabel(def: BadgeDef, s: Pick<BadgeStatus, "progress" | "goal">): string | null {
  if (!def.unit) return null;
  const n = Math.min(s.progress, s.goal);
  const plural = (u: string) => (u === "century" ? "centuries" : `${u}s`);
  return `${n.toLocaleString()} of ${s.goal.toLocaleString()} ${s.goal === 1 ? def.unit : plural(def.unit)}`;
}

export function fraction(s: Pick<BadgeStatus, "progress" | "goal">): number {
  return s.goal > 0 ? Math.max(0, Math.min(1, s.progress / s.goal)) : 0;
}

/**
 * Order for the badge case: earned first (rarest, then newest), then the ones
 * you're closest to, then the rest in definition order.
 */
export function sortForCase(statuses: BadgeStatus[]): BadgeStatus[] {
  const order = new Map(BADGES.map((b, i) => [b.key, i]));
  return statuses
    .filter((s) => BADGE[s.key])
    .slice()
    .sort((a, b) => {
      if (a.earned && b.earned)
        return RARITY_RANK[BADGE[a.key].rarity] - RARITY_RANK[BADGE[b.key].rarity] || b.earned.localeCompare(a.earned);
      if (a.earned) return -1;
      if (b.earned) return 1;
      // Locked secrets go last, and give nothing away.
      const sa = Boolean(BADGE[a.key].secret), sb = Boolean(BADGE[b.key].secret);
      if (sa !== sb) return sa ? 1 : -1;
      if (sa) return 0;
      const fa = fraction(a), fb = fraction(b);
      if (fa !== fb) return fb - fa;
      return (order.get(a.key) ?? 0) - (order.get(b.key) ?? 0);
    });
}

/** readread's first year: anyone who joined before this is an early adopter. */
export const EARLY_ADOPTER_BEFORE = "2027-01-01T05:00:00Z";

export function isEarlyAdopter(createdAt: string | null | undefined): boolean {
  return Boolean(createdAt) && new Date(createdAt!).getTime() < new Date(EARLY_ADOPTER_BEFORE).getTime();
}
