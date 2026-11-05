import { GENRE_BY_KEY } from "./genres";

/**
 * A cheeky "dating profile" written from someone's shelf: one card of
 * basics, one of green flags, one of red flags. Pure rules, no AI, so the
 * same shelf always gets the same profile.
 */

export interface DateBook {
  title: string;
  score: number;
  genres: string[];
  pages: number | null;
  year: number | null;
  finished_on: string | null;
  /** Listened to as an audiobook (or both). */
  listened?: boolean;
}

export interface DateInput {
  name: string;
  /** Ranked books, best first. */
  ranked: DateBook[];
  wantCount: number;
  /** Books marked reading now, with when they started and how far along. */
  reading: { title: string; started_on: string | null; progress_pct: number | null }[];
  today: string; // YYYY-MM-DD
}

export interface DateProfile {
  name: string;
  topTitle: string | null;
  readsLike: number | null;
  basics: string[];
  idealDate: string;
  green: string[];
  red: string[];
}

const IDEAL: Record<string, string> = {
  literary: "A quiet bookshop, then crying in the car after.",
  scifi: "Stargazing, then explaining the physics slightly wrong.",
  fantasy: "Anywhere with a map in the front.",
  mystery: "A dinner party where someone gets murdered.",
  romance: "Enemies to lovers, but make it brunch.",
  horror: "A cabin with no cell service.",
  historical: "Arguing about which century had the best outfits.",
  classics: "A long walk and an even longer letter.",
  history: "A museum. Slowly. Very slowly.",
  memoir: "Sharing my whole life story by the second drink.",
  science: "Explaining the mitochondria. Again.",
  poetry: "Reading you something I wrote. Sorry in advance.",
};

const MONTH = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function days(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
}
const fmt = (n: number) => (n >= 10 ? "10" : n.toFixed(1));
const short = (t: string, n = 34) => (t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t);

export function genreShares(books: DateBook[]): [string, number][] {
  const counts = new Map<string, number>();
  for (const b of books) for (const g of b.genres.slice(0, 1)) counts.set(g, (counts.get(g) ?? 0) + 1);
  return [...counts.entries()].filter(([k]) => GENRE_BY_KEY[k]).sort((a, b) => b[1] - a[1]);
}

export function buildDatingProfile(d: DateInput): DateProfile {
  const ranked = d.ranked;
  const top = ranked[0];
  const scores = ranked.map((b) => b.score);
  const avg = scores.length ? scores.reduce((s, x) => s + x, 0) / scores.length : 0;
  const shares = genreShares(ranked);
  const topGenre = shares[0]?.[0];
  const withYear = ranked.filter((b) => b.year != null && b.year > 1000);
  const readsLike = withYear.length >= 3 ? Math.round(withYear.reduce((s, b) => s + (b.year as number), 0) / withYear.length) : null;
  // Each green flag names a different book, so the top pick isn't repeated.
  const longest = [...ranked].filter((b) => b.pages && b !== ranked[0]).sort((a, b) => (b.pages ?? 0) - (a.pages ?? 0))[0];
  const lowest = [...ranked].sort((a, b) => a.score - b.score)[0];
  const lastFinish = ranked.map((b) => b.finished_on).filter((x): x is string => Boolean(x)).sort().pop() ?? null;

  const basics = [
    topGenre ? `Mostly ${GENRE_BY_KEY[topGenre].label.toLowerCase()}` : null,
    `${ranked.length} book${ranked.length === 1 ? "" : "s"} ranked`,
    scores.length ? `Usually gives a ${fmt(avg)}` : null,
    longest?.pages ? `Longest: ${longest.pages.toLocaleString("en-US")} pages` : null,
  ].filter((x): x is string => Boolean(x));

  // Green flags, best evidence first.
  const green: string[] = [];
  if (top) green.push(`Will defend ${short(top.title)} with their life.`);
  if (longest?.pages && longest.pages >= 600) green.push(`Finished all ${longest.pages.toLocaleString("en-US")} pages of ${short(longest.title, 26)}. Commitment isn’t the problem.`);
  const loved = scores.filter((s) => s >= 9).length;
  if (loved >= 3) green.push(`Knows what they love: ${loved} books scored 9 or more.`);
  if (shares.length >= 5) green.push(`Reads across ${shares.length} genres. Open-minded, allegedly.`);
  const old = withYear.filter((b) => (b.year as number) < 1900 && b !== top && b !== longest).sort((a, b) => b.score - a.score)[0];
  if (old) green.push(`Has read ${short(old.title, 28)}. On purpose.`);
  if (lastFinish && days(lastFinish, d.today) <= 14) green.push("Actually finishes things.");
  const heard = d.ranked.filter((b) => b.listened).length;
  if (heard >= 3 && heard * 2 >= d.ranked.length) green.push("Reads with their ears. Great on road trips.");
  for (const fill of ["Will tell you when a book is worth it.", "Brings a book to the bar, but puts it away for you.", "Remembers every plot. Will not spoil them.", "Will lend you their favorite. Wants it back."]) {
    if (green.length >= 4) break;
    if (!green.includes(fill)) green.push(fill);
  }

  // Red flags: scathing, but only about things that are true.
  const red: string[] = [];
  if (d.wantCount >= 10) red.push(`${d.wantCount} books saved for “later”. Later never comes.`);
  const stale = d.reading
    .filter((r) => r.started_on && days(r.started_on, d.today) >= 60 && (r.progress_pct ?? 0) < 80)
    .sort((a, b) => (a.started_on as string).localeCompare(b.started_on as string))[0];
  if (stale?.started_on) red.push(`Has been “reading” ${short(stale.title, 26)} since ${MONTH[Number(stale.started_on.slice(5, 7)) - 1]}.`);
  if (d.reading.length >= 3) red.push(`Reading ${d.reading.length} books at once. Can’t pick just one.`);
  if (lowest && ranked.length >= 3 && lowest.score < 5) red.push(`Gave ${short(lowest.title, 28)} a ${fmt(lowest.score)}. Cold.`);
  if (topGenre && ranked.length >= 6 && shares[0][1] / ranked.length >= 0.6) {
    red.push(`${Math.round((shares[0][1] / ranked.length) * 100)}% ${GENRE_BY_KEY[topGenre].label.toLowerCase()}. Has never met a different genre.`);
  }
  if (scores.length >= 5 && avg >= 8.5) red.push(`Rates almost everything a ${fmt(avg)}. No standards.`);
  if (scores.length >= 5 && avg <= 5.5) red.push(`Average score: ${fmt(avg)}. Hard to impress. Harder to date.`);
  if (lastFinish && days(lastFinish, d.today) >= 60) red.push(`Hasn’t finished a book in ${days(lastFinish, d.today)} days.`);
  for (const fill of ["Says “one more chapter” and means four.", "Will ask what you’re reading. Will judge the answer.", "Dog-ears pages. Yes, really.", "Already planning your shared bookshelf. Alphabetical."]) {
    if (red.length >= 4) break;
    if (!red.includes(fill)) red.push(fill);
  }

  return {
    name: d.name,
    topTitle: top?.title ?? null,
    readsLike,
    basics: basics.slice(0, 4),
    idealDate: (topGenre && IDEAL[topGenre]) || "Two chairs, two books, no talking.",
    green: green.slice(0, 4),
    red: red.slice(0, 4),
  };
}
