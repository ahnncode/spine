import { cleanTitle, dedupeKey } from "./books";
import { cleanReview, summarize, toDate, type ImportStatus, type ImportSummary, type ImportedBook, formatFrom } from "./goodreads";
import type { Bucket } from "./ranking";

type Row = Record<string, string | undefined>;

const REQUIRED = ["Title", "Authors", "Read Status", "Star Rating"];

export function looksLikeStoryGraph(fields: string[]): boolean {
  return REQUIRED.every((f) => fields.includes(f));
}

/** ISBN-10 → ISBN-13; StoryGraph's "ISBN/UID" can be either, or its own ID. */
export function isbn13(raw: string | undefined): string | null {
  const v = (raw || "").replace(/[^0-9X]/gi, "").toUpperCase();
  if (/^97[89]\d{10}$/.test(v)) return v;
  if (!/^\d{9}[\dX]$/.test(v)) return null;
  const core = `978${v.slice(0, 9)}`;
  const sum = [...core].reduce((acc, d, i) => acc + Number(d) * (i % 2 ? 3 : 1), 0);
  return `${core}${(10 - (sum % 10)) % 10}`;
}

/** Quarter stars → tiers: 3.75+ loved, 2.75–3.5 fine, lower not for me. */
export function bucketForQuarterStars(stars: number): Bucket {
  if (stars >= 3.75) return "loved";
  if (stars >= 2.75) return "fine";
  return "disliked";
}

export function parseStoryGraph(rows: Row[]): ImportSummary {
  const seen = new Set<string>();
  const books: ImportedBook[] = [];

  for (const row of rows) {
    const rawTitle = (row["Title"] || "").trim();
    if (!rawTitle) continue;
    const title = cleanTitle(rawTitle);
    // "Rachael Lippincott, Alyson Derrick" → the first author.
    const author = (row["Authors"] || "").split(",")[0].trim() || null;
    const key = dedupeKey(title, author);
    if (seen.has(key)) continue;
    seen.add(key);

    const shelf = (row["Read Status"] || "").trim().toLowerCase();
    const rating = parseFloat(row["Star Rating"] || "");
    const stars = Number.isFinite(rating) && rating > 0 ? Math.min(5, rating) : null;

    let status: ImportStatus;
    let bucket: Bucket | null = null;
    if (shelf === "read") {
      status = stars ? "ranked" : "unsorted";
      if (stars) bucket = bucketForQuarterStars(stars);
    } else if (shelf === "did-not-finish") {
      // Didn't finish: kept off the ranked list, like dropping it here.
      status = "dropped";
    } else if (shelf === "paused") {
      status = "paused";
    } else if (shelf === "currently-reading") {
      status = "reading";
    } else {
      status = "want";
    }

    books.push({
      source: "storygraph",
      key,
      book: { title, author, isbn13: isbn13(row["ISBN/UID"]) },
      status,
      bucket,
      stars,
      avgRating: 0,
      finishedOn: status === "ranked" || status === "unsorted" ? toDate((row["Last Date Read"] || "").split("-")[0]) : null,
      review: cleanReview(row["Review"]),
      format: formatFrom(row["Format"]),
    });
  }

  return summarize(books);
}
