import { describe, expect, it } from "vitest";
import { badgeReceipt, type ReceiptInput } from "./badgeReceipts";
import type { Entry, RankedEntry } from "./data";

let id = 0;
function entry(over: Partial<Entry> & { title?: string; pages?: number; genres?: string[]; year?: number }): RankedEntry {
  id++;
  const { title = `Book ${id}`, pages = 300, genres = [], year = 2000, ...rest } = over;
  return {
    id: `e${id}`, user_id: "u", book_id: `b${id}`, status: "ranked", source: "manual", note: null, tags: [], format: "read",
    created_at: "2026-01-01T00:00:00Z", ranked_at: null, finished_on: null, started_on: null,
    book: { id: `b${id}`, title, author: `Author ${id}`, pages, genres, year, dedupe_key: `k${id}`, enriched: true },
    rank: id, score: 7, bucket: "liked", sort_key: id,
    ...rest,
  } as unknown as RankedEntry;
}
const status = { key: "", progress: 0, goal: 1, earned: "2026-11-09T00:00:00Z", fresh: false };
const input = (ranked: RankedEntry[], extra: Partial<ReceiptInput> = {}): ReceiptInput => ({ entries: ranked, ranked, checkinDays: [], goal: null, status, ...extra });

describe("badgeReceipt", () => {
  it("names the 10th book ranked for Shelf Starter", () => {
    const ranked = Array.from({ length: 12 }, (_, i) => entry({ title: `T${i + 1}`, ranked_at: `2026-03-${String(i + 1).padStart(2, "0")}T10:00:00Z` }));
    const r = badgeReceipt("shelf_starter", input(ranked))!;
    expect(r.summary).toBe("Your 10th ranked book was T10.");
    expect(r.books[0].entry.book.title).toBe("T10");
  });

  it("finds the longest weekly streak, counting in-app rankings and check-ins", () => {
    const ranked = [entry({ title: "Finished here", ranked_at: "2026-11-10T04:40:00Z", created_at: "2026-10-01T00:00:00Z", source: "goodreads" })];
    // Weeks of Oct 19, Oct 26, Nov 2 from check-ins, then Nov 9 from the ranking.
    const r = badgeReceipt("steady", input(ranked, { checkinDays: ["2026-10-20", "2026-10-28", "2026-11-04"] }))!;
    expect(r.facts[0]).toEqual({ label: "Longest run", value: "4 weeks" });
    expect(r.books.map((b) => b.entry.book.title)).toContain("Finished here");
  });

  it("ignores rankings that came in with an import for streaks", () => {
    const ranked = [entry({ ranked_at: "2026-11-10T00:00:00Z", created_at: "2026-11-12T00:00:00Z", source: "goodreads" })];
    const r = badgeReceipt("steady", input(ranked, { checkinDays: ["2026-10-20"] }))!;
    expect(r.facts[0].value).toBe("1 week");
  });

  it("lists one book per letter for Alphabet Soup, skipping The/A/An", () => {
    const ranked = [entry({ title: "The Hobbit" }), entry({ title: "A Little Life" }), entry({ title: "Hamnet" }), entry({ title: "9 Lives" })];
    const r = badgeReceipt("alphabet_soup", input(ranked))!;
    expect(r.summary).toBe("2 of 26 letters.");
    expect(r.books.map((b) => b.caption)).toEqual(["H", "L"]);
  });

  it("shows the first book in each genre for Explorer", () => {
    const ranked = [entry({ genres: ["fantasy"], ranked_at: "2026-01-01T00:00:00Z" }), entry({ genres: ["fantasy", "horror"], ranked_at: "2026-02-01T00:00:00Z" })];
    const r = badgeReceipt("explorer", input(ranked))!;
    expect(r.books).toHaveLength(2);
    expect(r.summary).toMatch(/^2 genres/);
  });

  it("names the book that crossed 10,000 pages", () => {
    const ranked = Array.from({ length: 30 }, (_, i) => entry({ title: `P${i + 1}`, pages: 400, ranked_at: `2026-0${1 + Math.floor(i / 10)}-${String((i % 10) + 1).padStart(2, "0")}T00:00:00Z` }));
    const r = badgeReceipt("page_turner", input(ranked))!;
    expect(r.summary).toBe("P25 took you past 10,000 pages.");
  });
});
