/**
 * "How you earned it": the books, days and numbers behind a badge, worked
 * out from your own shelf with the same rules refresh_badges() uses in the
 * database. Badges that depend on other people (comments, invites, taste
 * matches) or on things the app doesn't keep per book (head-to-heads) return
 * a count only.
 */
import type { BadgeStatus } from "./badges";
import type { Entry, RankedEntry } from "./data";
import { GENRES } from "./genres";
import { rankedInApp } from "./stats";

export interface ReceiptBook {
  entry: Entry;
  /** One short line under the cover: "Oct 31", "812 pages", "Horror". */
  caption?: string;
}

export interface Receipt {
  /** The headline: "Your 10th ranked book was Piranesi." */
  summary: string;
  books: ReceiptBook[];
  /** Extra facts as label/value pairs ("Longest run" / "6 weeks"). */
  facts: Array<{ label: string; value: string }>;
}

export interface ReceiptInput {
  entries: Entry[];
  ranked: RankedEntry[];
  /** Days you checked in, as YYYY-MM-DD. */
  checkinDays: string[];
  goal: number | null;
  status: BadgeStatus;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const GENRE_LABEL = new Map(GENRES.map((g) => [g.key, g.label]));

function day(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", ...(sameYear ? {} : { year: "numeric" }) });
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

function n(x: number): string {
  return x.toLocaleString("en-US");
}

/** When a ranked book went on the shelf as ranked: its ranking time, else its finish date. */
function rankedWhen(e: Entry): string {
  return e.ranked_at ?? (e.finished_on ? `${e.finished_on}T12:00:00Z` : e.created_at);
}

function byRankedTime(ranked: RankedEntry[]): RankedEntry[] {
  return [...ranked].sort((a, b) => rankedWhen(a).localeCompare(rankedWhen(b)));
}

function pages(e: Entry): number {
  return e.book.pages ?? 0;
}

function isListen(e: Entry): boolean {
  return e.format === "listen" || e.format === "both";
}

function isRead(e: Entry): boolean {
  return !e.format || e.format === "read" || e.format === "both";
}

/** The Nth book ranked, plus the run-up to it. */
function milestone(ranked: RankedEntry[], target: number, what: string): Receipt {
  const ordered = byRankedTime(ranked);
  const hit = ordered[target - 1];
  if (!hit) return { summary: `${n(ranked.length)} of ${n(target)} books ranked so far.`, books: ordered.slice(-6).reverse().map((entry) => ({ entry, caption: day(rankedWhen(entry)) })), facts: [] };
  const books = target === 1 ? [hit] : [hit, ...ordered.slice(Math.max(0, target - 6), target - 1).reverse()];
  return {
    summary: `Your ${target === 1 ? "first" : ordinal(target)} ${what} was ${hit.book.title}.`,
    books: books.map((entry, i) => ({ entry, caption: i === 0 ? `#${target} · ${day(rankedWhen(entry))}` : day(rankedWhen(entry)) })),
    facts: [{ label: "Ranked now", value: n(ranked.length) }],
  };
}

/** Pages ranked in total, and the book that crossed the line. */
function pageTotal(ranked: RankedEntry[], target: number): Receipt {
  const ordered = byRankedTime(ranked);
  let total = 0;
  let crossed: RankedEntry | null = null;
  for (const e of ordered) {
    total += pages(e);
    if (!crossed && total >= target) crossed = e;
  }
  const longest = [...ranked].filter((e) => pages(e) > 0).sort((a, b) => pages(b) - pages(a)).slice(0, 5);
  return {
    summary: crossed ? `${crossed.book.title} took you past ${n(target)} pages.` : `${n(total)} of ${n(target)} pages so far.`,
    books: [...(crossed ? [{ entry: crossed, caption: "Crossed the line" }] : []), ...longest.filter((e) => e !== crossed).map((entry) => ({ entry, caption: `${n(pages(entry))} pages` }))],
    facts: [{ label: "Pages ranked", value: n(total) }, { label: "Books with page counts", value: n(ranked.filter((e) => pages(e) > 0).length) }],
  };
}

/** Days with reading activity (check-ins, starts, in-app rankings), as YYYY-MM-DD. */
function activityDays(entries: Entry[], checkinDays: string[]): Map<string, Entry[]> {
  const out = new Map<string, Entry[]>();
  const add = (d: string, e?: Entry) => {
    const list = out.get(d) ?? [];
    if (e && !list.includes(e)) list.push(e);
    out.set(d, list);
  };
  for (const d of checkinDays) add(d);
  for (const e of entries) {
    if (e.started_on) add(e.started_on, e);
    if (e.status === "ranked" && e.ranked_at && rankedInApp(e)) add(e.ranked_at.slice(0, 10), e);
  }
  return out;
}

/** Same week numbering as the database: weeks starting Monday 2000-01-03. */
function weekOf(d: string): number {
  return Math.floor((Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) - Date.UTC(2000, 0, 3)) / (7 * 864e5));
}

function weekStart(w: number): string {
  return new Date(Date.UTC(2000, 0, 3) + w * 7 * 864e5).toISOString().slice(0, 10);
}

function streakReceipt(input: ReceiptInput, target: number): Receipt {
  const days = activityDays(input.entries, input.checkinDays);
  const weeks = [...new Set([...days.keys()].map(weekOf))].sort((a, b) => a - b);
  let best: number[] = [];
  let run: number[] = [];
  for (const w of weeks) {
    run = run.length && w === run[run.length - 1] + 1 ? [...run, w] : [w];
    if (run.length > best.length) best = run;
  }
  const inRun = new Set(best);
  const books = new Set<Entry>();
  for (const [d, list] of days) if (inRun.has(weekOf(d))) list.forEach((e) => books.add(e));
  const from = best.length ? weekStart(best[0]) : null;
  const to = best.length ? new Date(Date.parse(weekStart(best[best.length - 1])) + 6 * 864e5).toISOString().slice(0, 10) : null;
  return {
    summary: best.length >= target
      ? `${best.length} weeks in a row with reading, ${day(from)} to ${day(to)}.`
      : `Your longest run so far is ${best.length} week${best.length === 1 ? "" : "s"}.`,
    books: [...books].slice(0, 12).map((entry) => ({ entry, caption: entry.status === "ranked" ? "Finished" : "Started" })),
    facts: [
      { label: "Longest run", value: `${best.length} week${best.length === 1 ? "" : "s"}` },
      { label: "Check-in days in it", value: n(input.checkinDays.filter((d) => inRun.has(weekOf(d))).length) },
    ],
  };
}

function dailyReceipt(input: ReceiptInput): Receipt {
  const daysSorted = [...new Set(input.checkinDays)].sort();
  let best: string[] = [];
  let run: string[] = [];
  for (const d of daysSorted) {
    const prev = run[run.length - 1];
    run = prev && Date.parse(d) - Date.parse(prev) === 864e5 ? [...run, d] : [d];
    if (run.length > best.length) best = run;
  }
  return {
    summary: best.length ? `${best.length} days of check-ins in a row, ${day(best[0])} to ${day(best[best.length - 1])}.` : "No check-ins yet.",
    books: input.entries.filter((e) => e.started_on && best.length && e.started_on <= best[best.length - 1] && (e.status !== "ranked" || (e.finished_on ?? "9999") >= best[0])).slice(0, 8).map((entry) => ({ entry })),
    facts: [{ label: "Longest run", value: `${best.length} day${best.length === 1 ? "" : "s"}` }],
  };
}

function finishedByYear(ranked: RankedEntry[]): Map<number, RankedEntry[]> {
  const out = new Map<number, RankedEntry[]>();
  for (const e of ranked) {
    if (!e.finished_on) continue;
    const y = +e.finished_on.slice(0, 4);
    out.set(y, [...(out.get(y) ?? []), e]);
  }
  return out;
}

function titleLetter(title: string): string {
  return title.replace(/^(the|a|an)\s+/i, "").charAt(0).toUpperCase();
}

/** The receipt for one badge, or null when there's nothing to show beyond the date. */
export function badgeReceipt(key: string, input: ReceiptInput): Receipt | null {
  const { entries, ranked, status } = input;
  const finished = (list: RankedEntry[]) => list.map((entry) => ({ entry, caption: day(entry.finished_on) }));

  switch (key) {
    case "first_chapter": return milestone(ranked, 1, "ranked book");
    case "shelf_starter": return milestone(ranked, 10, "ranked book");
    case "bookworm": return milestone(ranked, 50, "ranked book");
    case "century": return milestone(ranked, 100, "ranked book");
    case "library_card": return milestone(ranked, 250, "ranked book");

    case "moving_in": {
      const imported = entries.filter((e) => e.source === "goodreads" || e.source === "storygraph");
      const from = imported.some((e) => e.source === "storygraph") ? (imported.some((e) => e.source === "goodreads") ? "Goodreads and StoryGraph" : "StoryGraph") : "Goodreads";
      return {
        summary: `You brought ${n(imported.length)} books over from ${from}.`,
        books: imported.filter((e) => e.status === "ranked").slice(0, 6).map((entry) => ({ entry })),
        facts: [
          { label: "Ranked", value: n(imported.filter((e) => e.status === "ranked").length) },
          { label: "Want to read", value: n(imported.filter((e) => e.status === "want").length) },
        ],
      };
    }
    case "wishlist": {
      const want = entries.filter((e) => e.status === "want").sort((a, b) => a.created_at.localeCompare(b.created_at));
      return { summary: `${n(want.length)} books saved to want to read.`, books: want.slice(0, 8).map((entry) => ({ entry, caption: day(entry.created_at) })), facts: [] };
    }

    case "doorstopper": {
      const big = ranked.filter((e) => pages(e) > 700).sort((a, b) => pages(b) - pages(a));
      return { summary: big.length ? `${big[0].book.title}, at ${n(pages(big[0]))} pages.` : "No book over 700 pages yet.", books: big.slice(0, 8).map((entry) => ({ entry, caption: `${n(pages(entry))} pages` })), facts: big.length > 1 ? [{ label: "Books over 700 pages", value: n(big.length) }] : [] };
    }
    case "page_turner": return pageTotal(ranked, 10000);
    case "long_haul": return pageTotal(ranked, 50000);

    case "steady": return streakReceipt(input, 4);
    case "season_reader": return streakReceipt(input, 12);
    case "unbroken": return streakReceipt(input, 52);
    case "daily_pages": return dailyReceipt(input);

    case "goal_getter": {
      if (!input.goal) return null;
      const years = [...finishedByYear(ranked).entries()].filter(([, list]) => list.length >= input.goal!).sort((a, b) => b[0] - a[0]);
      if (!years.length) return null;
      const [y, list] = years[0];
      const sorted = [...list].sort((a, b) => (a.finished_on ?? "").localeCompare(b.finished_on ?? ""));
      const hit = sorted[input.goal - 1];
      return {
        summary: `${hit.book.title} was book ${input.goal} of ${input.goal} in ${y}.`,
        books: [{ entry: hit, caption: `Goal hit · ${day(hit.finished_on)}` }, ...sorted.slice(0, input.goal - 1).reverse().slice(0, 7).map((entry) => ({ entry, caption: day(entry.finished_on) }))],
        facts: [{ label: `Finished in ${y}`, value: n(list.length) }, { label: "Goal", value: n(input.goal) }],
      };
    }
    case "every_month": {
      const year = [...finishedByYear(ranked).entries()].find(([, list]) => new Set(list.map((e) => e.finished_on!.slice(5, 7))).size === 12);
      if (!year) return null;
      const firstEach = MONTHS.map((_, i) => year[1].filter((e) => +e.finished_on!.slice(5, 7) === i + 1).sort((a, b) => a.finished_on!.localeCompare(b.finished_on!))[0]);
      return { summary: `At least one book finished in every month of ${year[0]}.`, books: firstEach.map((entry, i) => ({ entry, caption: MONTHS[i] })), facts: [{ label: `Finished in ${year[0]}`, value: n(year[1].length) }] };
    }
    case "scrooge": {
      const xmas = (d: string | null | undefined) => Boolean(d && d.slice(5, 10) === "12-25");
      const books = entries.filter((e) => rankedInApp(e) && (xmas(e.started_on) || (e.status === "ranked" && xmas(e.finished_on))));
      const days = input.checkinDays.filter(xmas);
      return { summary: days.length || books.length ? `You read on Christmas Day${days.length ? ` (${days.map((d) => d.slice(0, 4)).join(", ")})` : ""}.` : "Reading on Christmas Day.", books: books.map((entry) => ({ entry, caption: xmas(entry.finished_on) ? "Finished Dec 25" : "Started Dec 25" })), facts: [] };
    }

    case "explorer":
    case "full_passport": {
      const firstPer = new Map<string, RankedEntry>();
      for (const e of byRankedTime(ranked)) for (const g of e.book.genres ?? []) if (!firstPer.has(g)) firstPer.set(g, e);
      return {
        summary: `${firstPer.size} genres on your ranked shelf. Here's the first book in each.`,
        books: [...firstPer.entries()].map(([g, entry]) => ({ entry, caption: GENRE_LABEL.get(g) ?? g })),
        facts: [],
      };
    }
    case "time_traveler": {
      const per = new Map<number, RankedEntry>();
      for (const e of [...ranked].sort((a, b) => (a.book.year ?? 0) - (b.book.year ?? 0))) {
        if (e.book.year == null) continue;
        const c = Math.floor(e.book.year / 100);
        if (!per.has(c)) per.set(c, e);
      }
      const label = (c: number) => (c < 0 ? `${ordinal(-c)} century BC` : `${ordinal(c + 1)} century`);
      return { summary: `Books from ${per.size} different centuries.`, books: [...per.entries()].map(([c, entry]) => ({ entry, caption: `${label(c)} · ${entry.book.year}` })), facts: [] };
    }
    case "old_soul": {
      const old = ranked.filter((e) => e.book.year != null && e.book.year < 1900).sort((a, b) => a.book.year! - b.book.year!);
      return { summary: old.length ? `${old[0].book.title}, from ${old[0].book.year}.` : "A book from before 1900.", books: old.slice(0, 8).map((entry) => ({ entry, caption: String(entry.book.year) })), facts: [] };
    }
    case "hot_off_the_press": {
      const hot = ranked.filter((e) => e.book.year != null && e.finished_on && +e.finished_on.slice(0, 4) === e.book.year);
      return { summary: hot.length ? `${hot[0].book.title}, finished the year it came out.` : "A book finished the year it came out.", books: hot.slice(0, 8).map((entry) => ({ entry, caption: `Out ${entry.book.year} · read ${day(entry.finished_on)}` })), facts: [] };
    }
    case "all_ears": {
      const ears = byRankedTime(ranked.filter(isListen));
      return { summary: `${n(ears.length)} audiobooks ranked.`, books: ears.slice(-8).reverse().map((entry) => ({ entry, caption: day(entry.finished_on ?? entry.ranked_at) })), facts: [] };
    }
    case "both_ways": {
      const months = new Map<string, RankedEntry[]>();
      for (const e of ranked) if (e.finished_on) months.set(e.finished_on.slice(0, 7), [...(months.get(e.finished_on.slice(0, 7)) ?? []), e]);
      const hit = [...months.entries()].sort((a, b) => a[0].localeCompare(b[0])).find(([, l]) => l.length >= 2 && l.some(isListen) && l.some(isRead));
      if (!hit) return null;
      const [ym, list] = hit;
      const pair = [list.find(isRead)!, list.find((e) => isListen(e) && e !== list.find(isRead))!].filter(Boolean);
      return { summary: `In ${MONTHS[+ym.slice(5) - 1]} ${ym.slice(0, 4)} you finished one with your eyes and one with your ears.`, books: pair.map((entry) => ({ entry, caption: isListen(entry) && !isRead(entry) ? "Listened" : entry.format === "both" ? "Read and listened" : "Read" })), facts: [] };
    }
    case "lifes_too_short": {
      const dropped = entries.filter((e) => e.status === "dropped" || e.did_not_finish).sort((a, b) => (a.stopped_at ?? "").localeCompare(b.stopped_at ?? ""));
      return { summary: `${n(dropped.length)} books you didn't finish. No regrets.`, books: dropped.slice(0, 8).map((entry) => ({ entry, caption: day(entry.stopped_at) })), facts: [] };
    }
    case "many_voices": {
      const authors = new Map<string, RankedEntry>();
      for (const e of byRankedTime(ranked)) if (e.book.author && !authors.has(e.book.author.toLowerCase())) authors.set(e.book.author.toLowerCase(), e);
      const list = [...authors.values()];
      return { summary: `${n(list.length)} different authors on your ranked shelf.`, books: list.slice(-8).reverse().map((entry) => ({ entry, caption: entry.book.author ?? undefined })), facts: [{ label: `Your ${ordinal(Math.min(50, list.length))} author`, value: list[Math.min(50, list.length) - 1]?.book.author ?? "" }] };
    }
    case "critic": {
      const noted = ranked.filter((e) => e.note || (e.tags?.length ?? 0) > 0);
      return { summary: `${n(noted.length)} books with your thoughts on them.`, books: noted.slice(0, 8).map((entry) => ({ entry, caption: entry.note ? "Review" : "Tags" })), facts: [] };
    }

    case "trick_or_read": {
      const books = ranked.filter((e) => rankedInApp(e) && e.book.genres?.includes("horror") && e.finished_on?.slice(5, 10) === "10-31");
      return { summary: books.length ? `${books[0].book.title}, finished on Halloween.` : "A horror book finished on Halloween.", books: finished(books), facts: [] };
    }
    case "sunk_cost": {
      const books = ranked.filter((e) => e.bucket === "disliked" && pages(e) >= 500);
      return { summary: books.length ? `${n(pages(books[0]))} pages of ${books[0].book.title}, and it wasn't for you.` : "500+ pages, then not for you.", books: books.map((entry) => ({ entry, caption: `${n(pages(entry))} pages` })), facts: [] };
    }
    case "alphabet_soup": {
      const per = new Map<string, RankedEntry>();
      for (const e of byRankedTime(ranked)) {
        const l = titleLetter(e.book.title);
        if (l >= "A" && l <= "Z" && !per.has(l)) per.set(l, e);
      }
      return { summary: `${per.size} of 26 letters.`, books: [...per.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([l, entry]) => ({ entry, caption: l })), facts: [] };
    }
    case "one_sitting": {
      const books = ranked.filter((e) => rankedInApp(e) && pages(e) >= 400 && e.started_on && e.started_on === e.finished_on);
      return { summary: books.length ? `${books[0].book.title}, ${n(pages(books[0]))} pages, started and finished on ${day(books[0].finished_on)}.` : "A 400+ page book in a day.", books: books.map((entry) => ({ entry, caption: `${n(pages(entry))} pages in a day` })), facts: [] };
    }
    case "long_goodbye": {
      const books = ranked.filter((e) => rankedInApp(e) && e.started_on && e.finished_on && Date.parse(e.finished_on) - Date.parse(e.started_on) >= 365 * 864e5);
      return { summary: books.length ? `${books[0].book.title}: started ${day(books[0].started_on)}, finished ${day(books[0].finished_on)}.` : "A book finished a year after starting.", books: books.map((entry) => ({ entry, caption: `${Math.round((Date.parse(entry.finished_on!) - Date.parse(entry.started_on!)) / (30.4 * 864e5))} months` })), facts: [] };
    }
    case "very_meta": {
      const re = /\b(book|books|bookshop|bookstore|bookseller|library|librarian|reader|readers|reading)\b/i;
      const books = ranked.filter((e) => re.test(e.book.title));
      return { summary: books.length ? `${books[0].book.title}: a book about books.` : "A book about books.", books: books.map((entry) => ({ entry })), facts: [] };
    }
    case "leap_reader": {
      const leap = (d: string | null | undefined) => Boolean(d && d.slice(5, 10) === "02-29");
      const books = entries.filter((e) => rankedInApp(e) && (leap(e.started_on) || (e.status === "ranked" && leap(e.finished_on))));
      return { summary: "You read on February 29.", books: books.map((entry) => ({ entry })), facts: [] };
    }

    // Counted elsewhere: show the number we have.
    case "decisive": return { summary: `${n(status.progress)} head-to-heads answered.`, books: [], facts: [] };
    case "good_company": return { summary: `You follow ${n(status.progress)} readers.`, books: [], facts: [] };
    case "conversation_starter": return { summary: `${n(status.progress)} comments from other readers on your rankings.`, books: [], facts: [] };
    case "connector": return { summary: `${n(status.progress)} friends joined with your link and ranked 3 books.`, books: [], facts: [] };
    default: return null;
  }
}
