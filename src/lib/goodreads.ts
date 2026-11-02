import { cleanTitle, dedupeKey, type BookInput } from "./books";
import type { Bucket } from "./ranking";

export type ImportStatus = "ranked" | "want" | "unsorted" | "reading";

export interface ImportedBook {
  book: BookInput;
  key: string;
  status: ImportStatus;
  bucket: Bucket | null;
  stars: number | null;
  /** Goodreads community average, used to break ties between equal stars. */
  avgRating: number;
  finishedOn: string | null;
  /** Your written Goodreads review, as plain text. */
  review: string | null;
}

export interface ImportSummary {
  books: ImportedBook[];
  total: number;
  rated: number;
  unrated: number;
  want: number;
  reading: number;
  loved: number;
  fiveStars: number;
}

type Row = Record<string, string | undefined>;

const REQUIRED = ["Title", "Author", "My Rating", "Exclusive Shelf"];

export function looksLikeGoodreads(fields: string[]): boolean {
  return REQUIRED.every((f) => fields.includes(f));
}

/** Goodreads wraps ISBNs as ="9780...". */
function cleanIsbn(raw: string | undefined): string | null {
  const digits = (raw || "").replace(/[^0-9X]/gi, "");
  return digits.length === 13 ? digits : null;
}

function toInt(raw: string | undefined): number | null {
  const n = parseInt((raw || "").trim(), 10);
  return Number.isFinite(n) ? n : null;
}

/** "2023/10/28" → "2023-10-28". */
function toDate(raw: string | undefined): string | null {
  const m = (raw || "").trim().match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (!m) return null;
  return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
}

/** Goodreads reviews come with <br/> and a little HTML; keep the words. */
function cleanReview(raw: string | undefined): string | null {
  const text = (raw || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text ? text.slice(0, 2000) : null;
}

export function bucketForStars(stars: number): Bucket {
  if (stars >= 4) return "loved";
  if (stars === 3) return "fine";
  return "disliked";
}

export function parseGoodreads(rows: Row[]): ImportSummary {
  const seen = new Set<string>();
  const books: ImportedBook[] = [];

  for (const row of rows) {
    const rawTitle = (row["Title"] || "").trim();
    if (!rawTitle) continue;
    const title = cleanTitle(rawTitle);
    const author = (row["Author"] || "").trim() || null;
    const key = dedupeKey(title, author);
    if (seen.has(key)) continue;
    seen.add(key);

    const shelf = (row["Exclusive Shelf"] || "").trim();
    const stars = toInt(row["My Rating"]) || 0;
    let status: ImportStatus;
    if (shelf === "read") status = stars > 0 ? "ranked" : "unsorted";
    else if (shelf === "currently-reading") status = "reading";
    else status = "want"; // to-read and custom exclusive shelves

    books.push({
      key,
      book: {
        title,
        author,
        isbn13: cleanIsbn(row["ISBN13"]),
        year: toInt(row["Original Publication Year"]) ?? toInt(row["Year Published"]),
        pages: toInt(row["Number of Pages"]),
      },
      status,
      bucket: status === "ranked" ? bucketForStars(stars) : null,
      stars: stars > 0 ? stars : null,
      avgRating: parseFloat(row["Average Rating"] || "0") || 0,
      finishedOn: status === "ranked" || status === "unsorted" ? toDate(row["Date Read"]) : null,
      review: cleanReview(row["My Review"]),
    });
  }

  return {
    books,
    total: books.length,
    rated: books.filter((b) => b.status === "ranked").length,
    unrated: books.filter((b) => b.status === "unsorted").length,
    want: books.filter((b) => b.status === "want").length,
    reading: books.filter((b) => b.status === "reading").length,
    loved: books.filter((b) => b.bucket === "loved").length,
    fiveStars: books.filter((b) => b.stars === 5).length,
  };
}

/**
 * Starting order within each bucket: more stars first, then the Goodreads
 * community average as a tiebreaker. Returns the imported ranked books in
 * best-first order per bucket.
 */
export function startingOrder(books: ImportedBook[]): Record<Bucket, ImportedBook[]> {
  const out: Record<Bucket, ImportedBook[]> = { loved: [], fine: [], disliked: [] };
  for (const b of books) if (b.status === "ranked" && b.bucket) out[b.bucket].push(b);
  for (const k of Object.keys(out) as Bucket[]) {
    out[k].sort((a, b) => (b.stars ?? 0) - (a.stars ?? 0) || b.avgRating - a.avgRating);
  }
  return out;
}
