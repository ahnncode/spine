import { NOT_A_KEY_CHAR, fold } from "./scripts";

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
  /** Chapter count a reader shared (not in catalogue data). */
  chapters?: number | null;
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
/** Korean store edition labels: hardcover, revised, recover, special, large print, … */
const KOREAN_EDITION = /\s*[(\[][^()[\]]*(?:양장|무선|개정|증보|리커버|특별|한정|기념|큰\s?글|에디션|합본|세트|전자책|ebook|e북|hard\s?cover|paperback|페이퍼백|special edition)[^()[\]]*[)\]]/gi;

/**
 * Korean titles from Apple's Korean store carry edition labels and a
 * marketing tail: "아몬드 (양장) - 제10회 창비 청소년문학상 수상작" → "아몬드".
 */
function cleanKoreanTitle(title: string): string {
  if (!/\p{Script=Hangul}/u.test(title)) return title;
  return title
    .replace(KOREAN_EDITION, "")
    // Series labels at the end, often repeated: "아몬드(창비청소년문학 78)(창비청소년문학 78)".
    .replace(/(?:\s*[(\[][^()[\]]*(?:\d|문학|문고|총서|시리즈|전집|선집|클래식)[^()[\]]*[)\]])+\s*$/u, "")
    // " - prize winner / tagline" after the title (a spaced dash, so 1984-style titles survive).
    .replace(/\s+[-–—]\s+.*$/, "")
    .trim();
}

export function cleanTitle(title: string): string {
  return cleanKoreanTitle(title)
    .replace(/\s*\([^()]*#\s*[\d.]+[^()]*\)\s*$/, "")
    // "(Harry Potter, Book 3)", "(Wings of Fire Series Vol. 2)" — but not a bare "(Book II)" that is the title.
    .replace(/\s*\([^()]*[A-Za-z][^()]*,?\s+(book|vol\.?|volume)\s*[\d.]+\)\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function norm(s: string): string {
  // Korean, Japanese and other scripts stay in the key: dropping them gave
  // every Korean book the same empty key, so they all became one book.
  return fold(s)
    .replace(/&/g, " and ")
    .replace(NOT_A_KEY_CHAR, " ")
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

/**
 * Two dedupe keys that are probably the same book: same surname, and titles
 * that match word for word where one word may be cut short ("a confed of
 * dunces" and "a confederacy of dunces"). Numbers must match exactly, so
 * volume 1 and volume 10 stay apart.
 */
export function sameBookKey(a: string, b: string): boolean {
  if (a === b) return true;
  const [ta, sa = ""] = a.split("|");
  const [tb, sb = ""] = b.split("|");
  if (sa !== sb || !ta || !tb) return false;
  const wa = ta.split(" ");
  const wb = tb.split(" ");
  if (wa.length !== wb.length) return false;
  return wa.every((x, i) => {
    const y = wb[i];
    if (x === y) return true;
    if (/\d/.test(x) || /\d/.test(y)) return false;
    const [short, long] = x.length < y.length ? [x, y] : [y, x];
    return short.length >= 3 && long.startsWith(short);
  });
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
  if (book.cover_id) out.push(`https://covers.openlibrary.org/b/id/${book.cover_id}-${size}.jpg?default=false`);
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
