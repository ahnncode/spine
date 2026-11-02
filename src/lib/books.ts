/** A book as we know it before it has a row in the catalog. */
export interface BookInput {
  title: string;
  author: string | null;
  isbn13?: string | null;
  ol_work_key?: string | null;
  cover_id?: number | null;
  year?: number | null;
  pages?: number | null;
}

export interface Book extends BookInput {
  id: string;
  dedupe_key: string;
}

/** Drop a trailing series marker like "(The Expanse, #1)". */
export function cleanTitle(title: string): string {
  return title.replace(/\s*\([^()]*#\s*[\d.]+[^()]*\)\s*$/, "").replace(/\s+/g, " ").trim();
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
  return `${main}|${surname}`;
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

export function coverUrl(book: Pick<BookInput, "cover_id" | "isbn13">, size: "S" | "M" | "L" = "M"): string | null {
  if (book.cover_id) return `https://covers.openlibrary.org/b/id/${book.cover_id}-${size}.jpg`;
  if (book.isbn13) return `https://covers.openlibrary.org/b/isbn/${book.isbn13}-${size}.jpg?default=false`;
  return null;
}
