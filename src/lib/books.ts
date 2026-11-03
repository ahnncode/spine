/** A book as we know it before it has a row in the catalog. */
export interface BookInput {
  title: string;
  author: string | null;
  isbn13?: string | null;
  ol_work_key?: string | null;
  cover_id?: number | null;
  /** Backup cover art (Apple Books) when Open Library has none. */
  cover_url?: string | null;
  year?: number | null;
  pages?: number | null;
  /** Genre keys from src/lib/genres.ts. */
  genres?: string[];
}

export interface Book extends BookInput {
  id: string;
  dedupe_key: string;
  genres: string[];
  enriched: boolean;
  /** We've looked for backup cover art already. */
  cover_checked?: boolean;
  /** Who picked this genre by hand, if anyone (they can change it). */
  genre_set_by?: string | null;
}

/** Drop a trailing series marker like "(The Expanse, #1)". */
export function cleanTitle(title: string): string {
  return title
    .replace(/\s*\([^()]*#\s*[\d.]+[^()]*\)\s*$/, "")
    // "(Harry Potter, Book 3)", "(Wings of Fire Series Vol. 2)" — but not a bare "(Book II)" that is the title.
    .replace(/\s*\([^()]*[A-Za-z][^()]*,?\s+(book|vol\.?|volume)\s*[\d.]+\)\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function norm(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\b(the|a|an)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Same book from different sources → same key. Uses the main title (before any
 * subtitle) and the author's surname, which survive most edition differences.
 */
export function dedupeKey(title: string, author: string | null): string {
  const main = norm(cleanTitle(title).split(/[:;]/)[0] || title);
  const authorParts = norm(author || "").split(" ").filter(Boolean);
  const surname = authorParts[authorParts.length - 1] || "";
  return `${main.slice(0, 400)}|${surname.slice(0, 100)}`;
}

const PALETTE: Array<[string, string]> = [
  ["#1F3A5F", "#F2EBDD"],
  ["#3E6B48", "#F4F0E6"],
  ["#B5452B", "#FBEFE3"],
  ["#7A2E4D", "#F7E7EE"],
  ["#0F5257", "#E8F3F1"],
  ["#F2C14E", "#111111"],
  ["#E9E4DA", "#2A2A2A"],
  ["#151515", "#FF6A33"],
  ["#2F4A2B", "#E9EFD9"],
  ["#2D3FE0", "#FFFFFF"],
];

/** Stable cover colours for books without cover art. */
export function coverColors(key: string): { bg: string; fg: string } {
  // FNV-1a with a final mix so similar titles still spread across the palette.
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 15;
  h = Math.imul(h, 2246822507);
  h ^= h >>> 13;
  const [bg, fg] = PALETTE[(h >>> 0) % PALETTE.length];
  return { bg, fg };
}

export function coverUrl(book: Pick<BookInput, "cover_id" | "isbn13" | "cover_url">, size: "S" | "M" | "L" = "M"): string | null {
  return coverCandidates(book, size)[0] ?? null;
}

/** Every image worth trying for a cover, best first; the next is used if one fails. */
export function coverCandidates(book: Pick<BookInput, "cover_id" | "isbn13" | "cover_url">, size: "S" | "M" | "L" = "M"): string[] {
  const out: string[] = [];
  if (book.cover_id) out.push(`https://covers.openlibrary.org/b/id/${book.cover_id}-${size}.jpg`);
  if (book.cover_url) out.push(book.cover_url);
  if (book.isbn13) out.push(`https://covers.openlibrary.org/b/isbn/${book.isbn13}-${size}.jpg?default=false`);
  return out;
}

/** Keep catalog fields within the limits the database enforces. */
export function sanitizeBook<T extends BookInput>(b: T): T {
  const isbn = b.isbn13 && /^97[89]\d{10}$/.test(b.isbn13) ? b.isbn13 : null;
  const pages = b.pages && b.pages > 0 && b.pages <= 50000 ? Math.round(b.pages) : null;
  const year = b.year != null && b.year >= -3000 && b.year <= 2100 ? b.year : null;
  return {
    ...b,
    title: (b.title || "Untitled").slice(0, 500),
    author: b.author ? b.author.slice(0, 300) : null,
    isbn13: isbn,
    pages,
    year,
    cover_id: b.cover_id && b.cover_id > 0 ? b.cover_id : null,
    genres: b.genres?.slice(0, 3),
  };
}
