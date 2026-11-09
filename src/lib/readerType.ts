import type { Entry, RankedEntry } from "./data";
import { GENRE_BY_KEY } from "./genres";
import type { Bucket } from "./ranking";
import { TAG_LABEL } from "./thoughts";
import {
  BLIND_SPOTS, DRIVES, FAMILIES, STRETCH, TYPE_COLOR, TYPES,
  type DriveCopy, type DriveKey, type Family, type FamilyKey, type TypeCopy,
} from "./readerTypeCopy";

/**
 * Reader type: a four-letter reading personality worked out from what someone
 * actually logs, not from a quiz.
 *
 * Why it's built this way (full reasoning in the "readread reader types" doc):
 * - Behaviour, not self-report. Models of personality from digital footprints
 *   get more accurate the more data they have, so the type sharpens as you rank.
 * - Spectrums, not boxes. Real traits are bell-shaped, not two humps, so every
 *   axis is a percentage, near-even axes are called out as "balanced", and a
 *   small shelf is pulled toward the middle until there's enough evidence.
 * - Receipts, not horoscopes. Every claim comes with the numbers and books
 *   behind it, so it can be checked (and can be wrong), which is the opposite
 *   of a Barnum statement.
 *
 * Pure rules, no AI: the same shelf always gets the same type.
 */

export const MIN_BOOKS = 5;
const SETTLING_AT = 15;
const SETTLED_AT = 40;

export interface RTBook {
  title: string;
  author: string | null;
  genres: string[];
  pages: number | null;
  year: number | null;
  score: number;
  bucket: Bucket;
  tags: string[];
  listened: boolean;
  started_on: string | null;
  finished_on: string | null;
}

export interface RTReading {
  title: string;
  started_on: string | null;
  last_checkin_on: string | null;
}

export interface RTInput {
  /** Ranked books, best first. */
  ranked: RTBook[];
  /** Books marked reading now. */
  reading: RTReading[];
  wantCount: number;
  /** Books put aside for now (paused). */
  paused?: number;
  /** Books not finished: dropped, ranked anyway after dropping, or (older history) put back or removed mid-read. Null when unknown. */
  abandoned: number | null;
  today: string; // YYYY-MM-DD
}

export type AxisKey = "range" | "lens" | "rhythm" | "bar";

export interface Pole { letter: string; name: string; blurb: string }

export interface AxisDef { key: AxisKey; label: string; question: string; poles: [Pole, Pole] }

/** pct on each axis runs toward the first pole: 100 = all the way W / H / F / E. */
export const AXES: AxisDef[] = [
  {
    key: "range", label: "Range", question: "How far do you roam?",
    poles: [
      { letter: "W", name: "Wide", blurb: "You roam across genres and subjects." },
      { letter: "D", name: "Deep", blurb: "You go deep in the kinds of books you love." },
    ],
  },
  {
    key: "lens", label: "Lens", question: "What grabs you?",
    poles: [
      { letter: "H", name: "Heart", blurb: "You read for people and feeling." },
      { letter: "M", name: "Mind", blurb: "You read for ideas, puzzles and how things work." },
    ],
  },
  {
    key: "rhythm", label: "Rhythm", question: "How do you move through books?",
    poles: [
      { letter: "F", name: "Finisher", blurb: "One book at a time, all the way to the end." },
      { letter: "G", name: "Grazer", blurb: "A few books going at once, following your mood." },
    ],
  },
  {
    key: "bar", label: "Bar", question: "How easy are you to win over?",
    poles: [
      { letter: "E", name: "Enthusiast", blurb: "You go in hoping to love it, and often do." },
      { letter: "C", name: "Critic", blurb: "A book has to earn it. Your 9s mean something." },
    ],
  },
];

export interface AxisResult {
  key: AxisKey;
  label: string;
  pct: number;
  /** The pole this reader leans toward. */
  pole: Pole;
  other: Pole;
  strength: "clear" | "leaning" | "balanced";
  /** 0–1: how much evidence sits behind this axis. */
  confidence: number;
  /** Specific, checkable reasons, most telling first. */
  receipts: string[];
}

export interface DriveResult extends DriveCopy { share: number }

export interface Stat { label: string; value: string }

export interface ReaderType {
  code: string;
  copy: TypeCopy;
  family: Family;
  /** This type's own colour (the family's hue, toned by rhythm and bar). */
  color: { bg: string; fg: string };
  axes: AxisResult[];
  drive: DriveResult;
  wing: DriveResult | null;
  stability: "provisional" | "settling" | "settled";
  /** Ranked books still to go before the type moves up a stability level (0 once settled). */
  toNextStability: number;
  stats: Stat[];
  blindSpot: { pole: Pole; text: string };
  stretch: { genre: string; label: string; why: string } | null;
  partner: { code: string; name: string; why: string };
  bookCount: number;
}

/* ------------------------------ helpers --------------------------------- */

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
/** 0–100 lean around a midpoint: mid scores 50, one spread above scores ~73. */
const lean = (x: number, mid: number, spread: number) => 100 / (1 + Math.exp(-(x - mid) / spread));
const pctOf = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);
const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;
const short = (t: string, n = 32) => (t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t);
const days = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
const label = (g: string) => GENRE_BY_KEY[g]?.label.toLowerCase() ?? g;
const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
/** "a thrill wing", "an understanding wing". */
export const withArticle = (word: string) => `${/^[aeiou]/i.test(word) ? "an" : "a"} ${word}`;
/** How much a book says about your taste: the ones you loved say the most. */
const pref = (score: number) => 0.35 + 0.65 * clamp01(score / 10);

type Signal = { value: number; weight: number };
/** Weighted average of whichever signals exist, plus how much of the total weight was available. */
function blend(signals: Array<Signal | null>, total: number): { raw: number; coverage: number } {
  const have = signals.filter((s): s is Signal => s !== null);
  const w = have.reduce((s, x) => s + x.weight, 0);
  if (!w) return { raw: 50, coverage: 0 };
  return { raw: have.reduce((s, x) => s + x.value * x.weight, 0) / w, coverage: w / total };
}

/** Pull a small or thin shelf toward the middle, so a few books can't make a strong claim. */
function shrink(raw: number, evidence: number, k: number): number {
  const c = evidence / (evidence + k);
  return 50 + (raw - 50) * c;
}

function axis(def: AxisDef, pct: number, confidence: number, receipts: { first: string[]; second: string[] }): AxisResult {
  const p = Math.round(Math.max(1, Math.min(99, pct)));
  const firstWins = p >= 50;
  const gap = Math.abs(p - 50);
  return {
    key: def.key,
    label: def.label,
    pct: p,
    pole: firstWins ? def.poles[0] : def.poles[1],
    other: firstWins ? def.poles[1] : def.poles[0],
    strength: gap < 7 ? "balanced" : gap < 20 ? "leaning" : "clear",
    confidence: Math.round(confidence * 100) / 100,
    receipts: (firstWins ? receipts.first : receipts.second).filter(Boolean).slice(0, 3),
  };
}

const NONFICTION = new Set(["history", "memoir", "science", "business", "truecrime", "essays"]);

/* ------------------------------- Range ---------------------------------- */

function rangeAxis(books: RTBook[], reading: number): AxisResult {
  const n = books.length;
  const counts = new Map<string, number>();
  for (const b of books) {
    const g = b.genres[0];
    if (g && GENRE_BY_KEY[g]) counts.set(g, (counts.get(g) ?? 0) + 1);
  }
  const typed = [...counts.values()].reduce((s, x) => s + x, 0);
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  // Effective number of genres (exp of Shannon entropy): 1 = all one genre.
  const entropy = typed ? -[...counts.values()].reduce((s, c) => s + (c / typed) * Math.log(c / typed), 0) : 0;
  const effective = Math.exp(entropy);
  const topShare = typed ? sorted[0][1] / typed : 0;

  const authors = new Map<string, number>();
  for (const b of books) if (b.author) authors.set(b.author, (authors.get(b.author) ?? 0) + 1);
  const repeatBooks = [...authors.values()].filter((c) => c >= 2).reduce((s, c) => s + c, 0);
  const repeatShare = n ? repeatBooks / n : 0;
  const topAuthor = [...authors.entries()].sort((a, b) => b[1] - a[1])[0];

  const nf = books.filter((b) => b.genres[0] && NONFICTION.has(b.genres[0])).length;
  const nfShare = typed ? nf / typed : 0;
  const mix = 1 - Math.abs(nfShare * 2 - 1); // 1 = half and half

  const { raw, coverage } = blend(
    [
      typed >= 3 ? { value: lean(effective, 4.5, 1.1), weight: 0.5 } : null,
      typed >= 3 ? { value: lean(-topShare, -0.4, 0.1), weight: 0.15 } : null,
      n >= 3 ? { value: lean(-repeatShare, -0.3, 0.12), weight: 0.2 } : null,
      typed >= 3 ? { value: lean(mix, 0.3, 0.15), weight: 0.15 } : null,
    ],
    1,
  );
  const pct = shrink(raw, typed + reading * 0.5, 4);

  const top = sorted[0];
  return axis(AXES[0], pct, coverage * clamp01(typed / 30), {
    first: [
      counts.size >= 3 ? `${plural(counts.size, "genre")} across ${plural(n, "ranked book")}` : "",
      top && topShare < 0.4 ? `Biggest genre, ${label(top[0])}, is only ${pctOf(top[1], typed)}% of the shelf` : "",
      nf >= 2 && nfShare >= 0.2 && nfShare <= 0.8 ? `A real mix: ${pctOf(typed - nf, typed)}% fiction, ${pctOf(nf, typed)}% nonfiction` : "",
      repeatShare < 0.2 && n >= 8 ? "Rarely the same author twice" : "",
    ],
    second: [
      top ? `${pctOf(top[1], typed)}% of the shelf is ${label(top[0])}` : "",
      topAuthor && topAuthor[1] >= 3 ? `${plural(topAuthor[1], "book")} by ${topAuthor[0]}` : "",
      sorted.length >= 2 && (sorted[0][1] + sorted[1][1]) / typed >= 0.7
        ? `${cap(label(sorted[0][0]))} and ${label(sorted[1][0])} make up ${pctOf(sorted[0][1] + sorted[1][1], typed)}% of the shelf`
        : "",
      typed >= 5 && nf === 0 ? "Not a single nonfiction book ranked" : typed >= 5 && nf === typed ? "Not a single novel ranked" : "",
    ],
  });
}

/* -------------------------------- Lens ---------------------------------- */

/** +1 = reads for people and feeling, −1 = reads for ideas and mechanics. */
const HEART_GENRE: Record<string, number> = {
  literary: 0.9, romance: 1, memoir: 0.7, poetry: 0.8, ya: 0.5, historical: 0.3, classics: 0.2, essays: 0.1,
  graphic: 0, horror: 0, fantasy: -0.1, truecrime: -0.4, mystery: -0.6, business: -0.8, history: -0.7, science: -1, scifi: -0.8,
};
const HEART_TAGS = new Set([
  "made_me_cry", "loved_characters", "quietly_devastating", "swoon", "slow_burn", "the_banter", "found_family",
  "so_brave", "want_to_meet", "wish_read_at_15", "so_angsty", "lines_ill_keep", "read_aloud", "made_me_slow_down",
  "transported", "spicy", "love_triangle", "third_act_breakup",
]);
const MIND_TAGS = new Set([
  "big_ideas", "mind_bending", "science_checks_out", "best_alien", "great_twist", "guessed_early", "red_herrings",
  "worldbuilding", "magic_system", "needed_map", "learned_so_much", "learned_a_ton", "changed_my_mind",
  "explained_well", "actually_useful", "changed_how_i_work", "already_using_it", "deeply_researched", "epic_scope",
  "want_more_history", "felt_too_real",
]);

function topTags(books: RTBook[], set: Set<string>): Array<[string, number]> {
  const c = new Map<string, number>();
  for (const b of books) for (const t of b.tags) if (set.has(t)) c.set(t, (c.get(t) ?? 0) + 1);
  return [...c.entries()].sort((a, b) => b[1] - a[1]);
}

function lensAxis(books: RTBook[]): AxisResult {
  let sum = 0;
  let w = 0;
  for (const b of books) {
    const [g1, g2] = b.genres;
    const h1 = g1 != null ? HEART_GENRE[g1] : undefined;
    if (h1 === undefined) continue;
    const h2 = g2 != null ? HEART_GENRE[g2] : undefined;
    const h = h2 === undefined ? h1 : h1 * 0.7 + h2 * 0.3;
    sum += h * pref(b.score);
    w += pref(b.score);
  }
  const genreLean = w ? sum / w : 0;
  const heartTags = topTags(books, HEART_TAGS);
  const mindTags = topTags(books, MIND_TAGS);
  const h = heartTags.reduce((s, [, c]) => s + c, 0);
  const m = mindTags.reduce((s, [, c]) => s + c, 0);
  const tagLean = h + m ? (h - m) / (h + m) : 0;
  // Tags are a direct reaction, so they count for more as they pile up (up to half).
  const alpha = Math.min(0.5, (h + m) / 16);
  const combined = genreLean * (1 - alpha) + tagLean * alpha;
  const raw = 50 + 50 * Math.max(-1, Math.min(1, combined * 1.6));
  const typed = books.filter((b) => b.genres[0] && HEART_GENRE[b.genres[0]] !== undefined).length;
  const evidence = typed + Math.min(h + m, typed) * 0.3;
  const pct = shrink(raw, evidence, 5);

  const loved = books.filter((b) => b.bucket === "loved");
  const heartLoved = loved.filter((b) => (HEART_GENRE[b.genres[0]] ?? 0) >= 0.5);
  const mindLoved = loved.filter((b) => (HEART_GENRE[b.genres[0]] ?? 0) <= -0.4);
  const tagLine = (tags: Array<[string, number]>) =>
    tags.length && tags[0][1] >= 2
      ? `Tagged ${tags.slice(0, 2).filter(([, c]) => c >= 2).map(([t, c]) => `‘${TAG_LABEL[t] ?? t}’ ${c}×`).join(", ")}`
      : "";
  const lovedGenres = (bs: RTBook[]) => [...new Set(bs.map((b) => label(b.genres[0])))].slice(0, 3).join(", ");

  return axis(AXES[1], pct, clamp01(evidence / 25), {
    first: [
      loved.length >= 3 && heartLoved.length / loved.length >= 0.5
        ? `${pctOf(heartLoved.length, loved.length)}% of loved books are ${lovedGenres(heartLoved)}`
        : "",
      tagLine(heartTags),
      mindLoved.length === 0 && loved.length >= 4 ? "Not one idea-first book among the favourites" : "",
    ],
    second: [
      loved.length >= 3 && mindLoved.length / loved.length >= 0.4
        ? `${pctOf(mindLoved.length, loved.length)}% of loved books are ${lovedGenres(mindLoved)}`
        : "",
      tagLine(mindTags),
      heartLoved.length === 0 && loved.length >= 4 ? "No love stories or literary fiction among the favourites" : "",
    ],
  });
}

/* ------------------------------- Rhythm --------------------------------- */

function rhythmAxis(books: RTBook[], input: RTInput): AxisResult {
  const { reading, wantCount, abandoned, today } = input;
  const paused = input.paused ?? 0;
  const r = reading.length;
  const stalled = reading.filter((x) => {
    const last = x.last_checkin_on ?? x.started_on;
    return last != null && days(last, today) > 45;
  });

  // How many other books were on the go while each dated book was being read.
  const spans = books
    .filter((b) => b.started_on && b.finished_on && b.finished_on >= b.started_on && days(b.started_on, b.finished_on) <= 365)
    .map((b) => [Date.parse(b.started_on as string), Date.parse(b.finished_on as string)] as const);
  let overlap: number | null = null;
  if (spans.length >= 4) {
    let total = 0;
    for (let i = 0; i < spans.length; i++) {
      for (let j = 0; j < spans.length; j++) {
        if (i !== j && spans[j][0] < spans[i][1] && spans[i][0] < spans[j][1]) total++;
      }
    }
    overlap = total / spans.length;
  }
  // Every ranked book was finished, so give-ups are measured against those.
  const dnfRate = abandoned != null && books.length >= MIN_BOOKS ? abandoned / (abandoned + books.length) : null;
  const pile = books.length ? wantCount / books.length : 0;

  const { raw, coverage } = blend(
    [
      r > 0 ? { value: lean(-r, -2, 0.7), weight: 0.3 } : null,
      r + paused > 0 ? { value: lean(-(stalled.length + paused), -0.5, 0.5), weight: 0.15 } : null,
      overlap != null ? { value: lean(-overlap, -0.6, 0.4), weight: 0.3 } : null,
      dnfRate != null ? { value: lean(-dnfRate, -0.1, 0.06), weight: 0.15 } : null,
      books.length >= 5 ? { value: lean(-pile, -0.6, 0.35), weight: 0.1 } : null,
    ],
    1,
  );
  const evidence = (r > 0 ? 4 : 0) + Math.min(paused, 3) + (overlap != null ? spans.length : 0) + (dnfRate != null ? 3 : 0) + (books.length >= 5 ? 2 : 0);
  const pct = shrink(raw, evidence, 4);
  const oldest = stalled.sort((a, b) => (a.last_checkin_on ?? a.started_on ?? "").localeCompare(b.last_checkin_on ?? b.started_on ?? ""))[0];

  return axis(AXES[2], pct, coverage * clamp01(evidence / 16), {
    first: [
      overlap != null && overlap < 0.15 ? "Never two books at once: one finished, then the next" : overlap != null && overlap < 0.5 ? "Almost never two books at once" : "",
      r === 1 && paused === 0 ? "One book on the go right now. Just one." : "",
      abandoned === 0 && books.length >= 8 ? "Not a single book abandoned" : abandoned != null && dnfRate != null && dnfRate < 0.08 ? `Only ${plural(abandoned, "book")} ever abandoned` : "",
      r > 0 && stalled.length === 0 && paused === 0 ? "Nothing on the reading pile has stalled" : "",
    ],
    second: [
      r >= 3 ? `${plural(r, "book")} on the go right now` : "",
      paused >= 2 ? `${plural(paused, "book")} put aside for now` : "",
      oldest ? `${short(oldest.title, 28)} hasn’t moved in ${days(oldest.last_checkin_on ?? oldest.started_on ?? today, today)} days` : "",
      overlap != null && overlap >= 0.8 ? `Usually ${overlap.toFixed(1)} other books on the go alongside each one` : "",
      abandoned != null && abandoned >= 3 ? `${plural(abandoned, "book")} you didn’t finish, guilt-free` : "",
      wantCount >= 20 && pile >= 1 ? `${wantCount} books saved for later, more than have been ranked` : "",
    ],
  });
}

/* --------------------------------- Bar ---------------------------------- */

const CRITIC_TAGS = new Set([
  "overhyped", "slow_start", "guessed_early", "not_scary", "hard_going", "self_indulgent", "could_be_article",
  "could_be_blog_post", "too_many_anecdotes", "bit_sensational", "hard_to_follow", "didnt_click", "hit_and_miss",
]);
const FAN_TAGS = new Set([
  "reread", "unputdownable", "worth_hype", "need_sequel", "want_whole_series", "adults_too", "underlined_everything",
  "so_quotable", "lines_ill_keep", "one_night", "one_sitting", "stuck_ending", "want_to_meet",
]);

function barAxis(books: RTBook[]): AxisResult {
  const n = books.length;
  const loved = books.filter((b) => b.bucket === "loved").length;
  const disliked = books.filter((b) => b.bucket === "disliked").length;
  const crit = topTags(books, CRITIC_TAGS);
  const fan = topTags(books, FAN_TAGS);
  const c = crit.reduce((s, [, x]) => s + x, 0);
  const f = fan.reduce((s, [, x]) => s + x, 0);
  const buckets = lean(n ? (loved - disliked) / n : 0, 0.4, 0.15);
  const tags = c + f ? 50 + 50 * ((f - c) / (f + c)) : 50;
  const alpha = Math.min(0.35, (c + f) / 25);
  const raw = buckets * (1 - alpha) + tags * alpha;
  const pct = shrink(raw, n, 4);
  const top = books[0];

  return axis(AXES[3], pct, clamp01(n / 25), {
    first: [
      n ? `${pctOf(loved, n)}% of ranked books land in ‘loved’` : "",
      n >= 8 && disliked <= 1 ? (disliked === 0 ? "Nothing in ‘not for me’. Not one book." : "Just one book in ‘not for me’") : "",
      fan[0] && fan[0][1] >= 2 ? `Tagged ‘${TAG_LABEL[fan[0][0]] ?? fan[0][0]}’ ${fan[0][1]}×` : "",
    ],
    second: [
      n ? `Only ${pctOf(loved, n)}% of ranked books make ‘loved’` : "",
      disliked >= 2 ? `${plural(disliked, "book")} in ‘not for me’` : "",
      crit[0] && crit[0][1] >= 2 ? `Tagged ‘${TAG_LABEL[crit[0][0]] ?? crit[0][0]}’ ${crit[0][1]}×` : top && n >= 10 ? `The #1, ${short(top.title, 26)}, had to beat ${n - 1} others` : "",
    ],
  });
}

/* ------------------------------- Drives --------------------------------- */

const DRIVE_GENRE: Record<DriveKey, Record<string, number>> = {
  escape: { romance: 1, ya: 0.8, fantasy: 0.6, graphic: 0.6, historical: 0.5, horror: 0.2 },
  thrill: { mystery: 1, horror: 0.9, truecrime: 0.7, scifi: 0.2 },
  feeling: { literary: 0.8, memoir: 0.6, poetry: 0.6, romance: 0.5, ya: 0.3, historical: 0.3 },
  wonder: { scifi: 1, fantasy: 0.8, graphic: 0.3, science: 0.3 },
  understanding: { history: 1, science: 1, business: 1, essays: 0.6, memoir: 0.5, truecrime: 0.4 },
  craft: { classics: 1, poetry: 0.8, literary: 0.6, essays: 0.5 },
};
const DRIVE_TAGS: Record<DriveKey, string[]> = {
  escape: ["unputdownable", "swoon", "funny", "transported", "spicy", "one_sitting", "want_to_go"],
  thrill: ["edge_of_seat", "great_twist", "one_night", "lights_on", "actually_scary", "chilling", "red_herrings"],
  feeling: ["made_me_cry", "loved_characters", "quietly_devastating", "so_brave", "found_family", "want_to_meet"],
  wonder: ["big_ideas", "mind_bending", "worldbuilding", "magic_system", "best_alien", "epic_scope"],
  understanding: ["learned_a_ton", "learned_so_much", "changed_my_mind", "explained_well", "actually_useful", "changed_how_i_work", "deeply_researched"],
  craft: ["gorgeous_writing", "lines_ill_keep", "underlined_everything", "so_quotable", "stuck_ending", "read_aloud"],
};
const DRIVE_KEYS = Object.keys(DRIVES) as DriveKey[];

export function driveShares(books: RTBook[]): Array<[DriveKey, number]> {
  const totals = new Map<DriveKey, number>(DRIVE_KEYS.map((k) => [k, 0]));
  for (const b of books) {
    // Loved books say much more about why you read than ones you didn't like.
    const w = Math.pow(Math.max(0.15, clamp01(b.score / 10)), 1.5);
    b.genres.slice(0, 2).forEach((g, i) => {
      for (const k of DRIVE_KEYS) totals.set(k, totals.get(k)! + (DRIVE_GENRE[k][g] ?? 0) * w * (i === 0 ? 1 : 0.5));
    });
    for (const t of b.tags) for (const k of DRIVE_KEYS) if (DRIVE_TAGS[k].includes(t)) totals.set(k, totals.get(k)! + 0.6);
  }
  const sum = [...totals.values()].reduce((s, x) => s + x, 0) || 1;
  return [...totals.entries()].map(([k, v]) => [k, v / sum] as [DriveKey, number]).sort((a, b) => b[1] - a[1]);
}

/* -------------------------------- Type ---------------------------------- */

function familyOf(code: string): FamilyKey {
  const wide = code[0] === "W";
  const heart = code[1] === "H";
  return wide ? (heart ? "wayfarers" : "cartographers") : heart ? "keepers" : "scholars";
}

/** Type names by code, for anywhere that only has the letters. */
export function typeName(code: string): string {
  return TYPES[code]?.name ?? code;
}

function signatureStats(books: RTBook[], reading: number): Stat[] {
  const out: Stat[] = [];
  const withYear = books.filter((b) => b.year != null && b.year > 1000);
  if (withYear.length >= 3) {
    const avg = Math.round(withYear.reduce((s, b) => s + (b.year as number), 0) / withYear.length);
    out.push({ label: "reads like it’s", value: String(avg) });
  }
  const heard = books.filter((b) => b.listened).length;
  if (books.length && heard / books.length >= 0.25) out.push({ label: "listened, not read", value: `${pctOf(heard, books.length)}%` });
  const genres = new Set(books.map((b) => b.genres[0]).filter((g) => g && GENRE_BY_KEY[g])).size;
  if (genres >= 2) out.push({ label: genres === 1 ? "genre" : "genres", value: String(genres) });
  const longest = Math.max(0, ...books.map((b) => b.pages ?? 0));
  if (longest >= 300) out.push({ label: "pages, longest read", value: longest.toLocaleString("en-US") });
  if (reading >= 2) out.push({ label: "books on the go", value: String(reading) });
  out.push({ label: "books ranked", value: books.length.toLocaleString("en-US") });
  return out.slice(0, 3);
}

export function buildReaderType(input: RTInput): ReaderType | null {
  const books = input.ranked;
  if (books.length < MIN_BOOKS) return null;

  const axes = [rangeAxis(books, input.reading.length), lensAxis(books), rhythmAxis(books, input), barAxis(books)];
  const code = axes.map((a) => a.pole.letter).join("");
  const copy = TYPES[code];
  const family = FAMILIES[familyOf(code)];

  const shares = driveShares(books);
  const asDrive = ([k, share]: [DriveKey, number]): DriveResult => ({ ...DRIVES[k], share: Math.round(share * 100) / 100 });
  const drive = asDrive(shares[0]);
  const wing = shares[1] && shares[1][1] >= 0.15 && shares[1][1] >= shares[0][1] * 0.45 ? asDrive(shares[1]) : null;

  const n = books.length;
  const stability = n >= SETTLED_AT ? "settled" : n >= SETTLING_AT ? "settling" : "provisional";
  const toNextStability = n >= SETTLED_AT ? 0 : (n >= SETTLING_AT ? SETTLED_AT : SETTLING_AT) - n;

  // Blind spot: the cost of the reader's strongest lean.
  const strongest = [...axes].sort((a, b) => Math.abs(b.pct - 50) - Math.abs(a.pct - 50))[0];
  const blindSpot = { pole: strongest.pole, text: BLIND_SPOTS[strongest.pole.letter] };

  // Stretch read: a genre readers with this drive tend to love, that this reader has barely touched.
  const genreCount = (g: string) => books.filter((b) => b.genres.includes(g)).length;
  const pick = [...STRETCH[drive.key], ...(wing ? STRETCH[wing.key] : [])].find((s) => genreCount(s.genre) <= Math.max(1, n * 0.04));
  const stretch = pick ? { genre: pick.genre, label: GENRE_BY_KEY[pick.genre]?.label ?? pick.genre, why: pick.why } : null;

  // Best book-club partner: same lens and rhythm (you'll want to talk about the same
  // things at the same pace), opposite range and bar (they bring what you'd never find,
  // and the arguments are good).
  const flip: Record<string, string> = { W: "D", D: "W", E: "C", C: "E" };
  const partnerCode = `${flip[code[0]]}${code[1]}${code[2]}${flip[code[3]]}`;
  const partner = {
    code: partnerCode,
    name: typeName(partnerCode),
    why: `Same ${axes[1].pole.name.toLowerCase()} and rhythm as you, so you’ll want to talk about the same things at the same pace. Opposite range and bar, so they’ll bring books you’d never find, and the arguments will be good.`,
  };

  return {
    code, copy, family, color: TYPE_COLOR[code], axes, drive, wing, stability, toNextStability,
    stats: signatureStats(books, input.reading.length),
    blindSpot, stretch, partner, bookCount: n,
  };
}

/** Build the input from a reader's own shelf, as loaded in the app. */
/**
 * `earlierGiveUps` = books put back or removed mid-read before "didn't finish" existed
 * (from shelf history); dropped books are counted from the shelf itself.
 */
export function readerInputFromShelf(ranked: RankedEntry[], entries: Entry[], earlierGiveUps: number | null, today: string): RTInput {
  const dropped = entries.filter((e) => e.status === "dropped" || (e.status === "ranked" && e.did_not_finish)).length;
  return {
    ranked: ranked.map((e) => ({
      title: e.book.title,
      author: e.book.author,
      genres: e.book.genres ?? [],
      pages: e.book.pages ?? null,
      year: e.book.year ?? null,
      score: e.score,
      bucket: e.bucket,
      tags: e.tags ?? [],
      listened: e.format === "listen" || e.format === "both",
      started_on: e.started_on,
      finished_on: e.finished_on,
    })),
    reading: entries
      .filter((e) => e.status === "reading")
      .map((e) => ({ title: e.book.title, started_on: e.started_on, last_checkin_on: e.last_checkin_on })),
    wantCount: entries.filter((e) => e.status === "want").length,
    paused: entries.filter((e) => e.status === "paused").length,
    abandoned: earlierGiveUps == null ? (dropped ? dropped : null) : earlierGiveUps + dropped,
    today,
  };
}
