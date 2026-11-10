import type { Entry, RankedEntry } from "./data";
import { GENRES } from "./genres";
import { isImported } from "./goodreads";

/* ------------------------------ Weekly streak ---------------------------- */

/** Monday-based week index (days since epoch / 7), in local time. */
export function weekIndex(d: Date): number {
  const local = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  const day = (d.getDay() + 6) % 7; // Monday = 0
  return Math.floor((local / 86400000 - day + 3) / 7);
}

function parseDay(iso: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(iso);
}

/**
 * Whether a ranking happened in the app rather than coming in with an import.
 * A book imported as want-to-read or currently-reading and ranked here later
 * counts; imported rankings carry the finish date, never after the import.
 */
export function rankedInApp(e: Pick<Entry, "source" | "ranked_at" | "created_at">): boolean {
  if (!isImported(e.source)) return true;
  if (!e.ranked_at || !e.created_at) return false;
  return new Date(e.ranked_at).getTime() > new Date(e.created_at).getTime() + 10 * 60 * 1000;
}

/**
 * Days a reader did something worth counting: checked in on a book they're
 * reading, started one, or ranked one.
 */
export function activityDates(entries: Entry[], checkinDays: string[] = []): Date[] {
  const out: Date[] = checkinDays.map(parseDay);
  for (const e of entries) {
    if (e.ranked_at && e.status === "ranked" && rankedInApp(e)) out.push(new Date(e.ranked_at));
    if (e.started_on) out.push(parseDay(e.started_on));
  }
  return out;
}

export interface Streak {
  weeks: number;
  /** Whether this week already counts; if not, the streak ends unless they log something. */
  activeThisWeek: boolean;
  /** Last 12 weeks, oldest first, for the little grid. */
  recent: boolean[];
}

/**
 * Consecutive weeks with activity. Weekly rather than daily, because books take
 * weeks; a streak survives until a whole week passes with nothing logged.
 */
export function weeklyStreak(dates: Date[], now = new Date()): Streak {
  const weeks = new Set(dates.map(weekIndex));
  const current = weekIndex(now);
  const activeThisWeek = weeks.has(current);
  let w = activeThisWeek ? current : current - 1;
  let count = 0;
  while (weeks.has(w)) {
    count++;
    w--;
  }
  const recent = Array.from({ length: 12 }, (_, i) => weeks.has(current - 11 + i));
  return { weeks: count, activeThisWeek, recent };
}

/* ------------------------------ Year counts ------------------------------ */

export function readInYear(ranked: RankedEntry[], year: number): RankedEntry[] {
  const y = String(year);
  return ranked.filter((e) => e.finished_on?.startsWith(y));
}

/* ------------------------------ Passport --------------------------------- */

export interface Stamp {
  key: string;
  label: string;
  short: string;
  bg: string;
  fg: string;
  count: number;
}

export function passport(ranked: RankedEntry[]): Stamp[] {
  return GENRES.map((g) => ({
    key: g.key,
    label: g.label,
    short: g.short ?? g.label,
    bg: g.bg,
    fg: g.fg,
    count: ranked.filter((e) => e.book.genres?.includes(g.key)).length,
  }));
}

/* ------------------------------ Milestones ------------------------------- */

export interface Milestone {
  id: string;
  label: string;
  detail: string;
  earned: boolean;
  /** 0–1 progress toward it. */
  progress: number;
}

const RANKED_STEPS = [1, 10, 25, 50, 100, 250, 500, 1000];
const STAMP_STEPS = [3, 6, 12];
const STREAK_STEPS = [4, 12, 26, 52];

function ladder(id: string, value: number, steps: number[], label: (n: number) => string, detail: (n: number) => string): Milestone[] {
  // Every rung earned so far, plus the next one to chase.
  const out: Milestone[] = [];
  for (const n of steps) {
    const earned = value >= n;
    out.push({ id: `${id}-${n}`, label: label(n), detail: detail(n), earned, progress: Math.min(1, value / n) });
    if (!earned) break;
  }
  return out;
}

export function milestones(opts: { ranked: number; stamps: number; streak: number }): Milestone[] {
  return [
    ...ladder("ranked", opts.ranked, RANKED_STEPS, (n) => (n === 1 ? "First rank" : `${n} ranked`), (n) => `Rank ${n} book${n === 1 ? "" : "s"}`),
    ...ladder("stamps", opts.stamps, STAMP_STEPS, (n) => (n === 12 ? "Full passport" : `${n} stamps`), (n) => `Read across ${n} genres`),
    ...ladder("streak", opts.streak, STREAK_STEPS, (n) => (n === 52 ? "A year straight" : `${n}-week streak`), (n) => `Read ${n} weeks in a row`),
  ];
}

/** Taste match unlocks once you've ranked this many books. */
export const TASTE_UNLOCK = 10;
