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
  /** Where the author is from (ISO alpha-2), for the world passport. */
  author_country?: string | null;
  /** Read in English translation, when we know. */
  translated?: boolean | null;
  /** When the author's country was last looked up. */
  country_checked_at?: string | null;
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

const SPELLED = "one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve";

/** Bracket labels that describe an edition, imprint, award or book club rather than the book. */
const LABEL = /\s*[(\[][^()[\]]*\b(?:edition|classics?|finalist|winner|prize|award|book club|anniversary|illustrated|deluxe|tie-?in|unabridged|abridged|reprint|paperback|hardcover|large print|a novel)\b[^()[\]]*[)\]]\s*$/i;

export function cleanTitle(title: string): string {
  let t = cleanKoreanTitle(title);
  // Labels can stack: "Dune (Deluxe Edition) (Penguin Galaxy)" — strip from the end.
  for (let i = 0; i < 3; i++) {
    const before = t;
    t = t
      .replace(/\s*\([^()]*#\s*[\d.]+[^()]*\)\s*$/, "")
      // "(Harry Potter, Book 3)", "(Wings of Fire Series Vol. 2)" — but not a bare "(Book II)" that is the title.
      .replace(/\s*\([^()]*[A-Za-z][^()]*,?\s+(book|vol\.?|volume)\s*[\d.]+\)\s*$/i, "")
      // "(Kingkiller Chronicle, Book One)"
      .replace(new RegExp(`\\s*\\([^()]*[A-Za-z][^()]*,?\\s+(book|volume|part)\\s+(${SPELLED})\\)\\s*$`, "i"), "")
      // Amazon-style "(The Empyrean, 1)"
      .replace(/\s*\([^()]*[A-Za-z][^()]*,\s*[\d.]+\)\s*$/, "")
      .replace(LABEL, "");
    if (t === before) break;
  }
  return t.replace(/\s+/g, " ").trim();
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

/** Words that open a descriptive subtitle ("Sapiens: A Brief History…") rather than a title of its own. */
const SUBTITLE_OPENER = new Set([
  "a", "an", "the", "or", "being", "how", "why", "what", "when", "where", "who", "from", "on", "in", "my", "our",
  "notes", "stories", "poems", "essays", "letters", "adapted", "volume", "vol", "book", "part",
]);
/** Words that mark a subtitle as an edition label ("1984: 75th Anniversary Edition"). */
const SUBTITLE_LABEL = /\b(edition|anniversary|illustrated|deluxe|classics?|novel|memoir|unabridged|abridged|annotated|tie in|young readers)\b/;
/** A series label in the main title: "Percy Jackson and the Olympians, Book One: The Lightning Thief". */
const SERIES_IN_MAIN = new RegExp(`\\b(book|vol|volume|part|no)\\s+(\\d+|${SPELLED}|[ivx]+)\\s*$|#\\s*\\d+\\s*$`, "i");

/**
 * The part of a title that names the book. Usually the main title before a
 * colon, since subtitles vary by edition ("Sapiens" / "Sapiens: A Brief
 * History of Humankind"). Two exceptions keep the subtitle:
 * - a short series or franchise name before the colon ("Dune: House
 *   Atreides", "Warriors: Into the Wild"), when the subtitle reads like a
 *   title and not a description or an edition label;
 * - a series label before the colon ("… Olympians, Book One: The Lightning
 *   Thief"), where the subtitle is the title.
 */
function keyTitle(title: string): string {
  const clean = cleanTitle(title);
  const cut = clean.search(/[:;]/);
  if (cut < 0) return norm(clean) || norm(title);
  const mainRaw = clean.slice(0, cut);
  const sub = norm(clean.slice(cut + 1));
  const main = norm(mainRaw);
  if (!sub) return main || norm(title);
  if (!main) return sub;
  if (SERIES_IN_MAIN.test(mainRaw.trim())) return sub;
  const subWords = sub.split(" ");
  const subRaw = fold(clean.slice(cut + 1)).replace(/[^a-z0-9 ]+/g, " ").trim();
  const opener = subRaw.split(/\s+/)[0] ?? "";
  const titleLike =
    subRaw !== "" && // subtitles in other scripts ("한강 장편소설") are descriptions
    main.split(" ").length <= 2 &&
    subWords.length <= 5 &&
    !SUBTITLE_OPENER.has(opener) &&
    !SUBTITLE_LABEL.test(subRaw) &&
    !/^\d/.test(sub);
  return titleLike ? `${main} ${sub}` : main;
}

/** Honorifics and titles that come and go between sources. */
const HONORIFIC = new Set(["dr", "sir", "dame", "mr", "mrs", "ms", "miss", "prof", "professor", "count", "countess", "lord", "lady", "saint", "st", "rev", "jr", "sr", "ii", "iii"]);

/**
 * The first listed author's surname, with the first initial when we know it:
 * "Frank Herbert" → "f herbert". Translators and co-authors after "&", "and",
 * ";" or a comma are left out ("Han Kang & Deborah Smith" → "h kang"), and
 * "García Márquez, Gabriel" is read as surname first.
 */
export function authorKey(author: string | null): string {
  const raw = fold(author || "").trim();
  if (!raw) return "";
  // First author only. A comma followed by one word (and initials) is "Last, First".
  const firstAuthor = raw.split(/\s*(?:&|;|\band\b|\bwith\b|\btranslated by\b|\btrans\.?\b)\s*/)[0];
  let given = "";
  let family = firstAuthor;
  const comma = firstAuthor.indexOf(",");
  if (comma >= 0) {
    const before = firstAuthor.slice(0, comma);
    const after = firstAuthor.slice(comma + 1).split(",")[0];
    const afterWords = after.replace(/\./g, " ").trim().split(/\s+/).filter(Boolean);
    const lastFirst = afterWords.length >= 1 && afterWords.filter((w) => w.length > 1 && !HONORIFIC.has(w)).length <= 1;
    if (lastFirst) {
      family = before;
      given = afterWords.find((w) => !HONORIFIC.has(w)) ?? "";
    } else {
      family = before; // "Homer, Emily Wilson": the second name is someone else.
    }
  }
  const words = norm(family.replace(/\./g, " ")).split(" ").filter((w) => w && !HONORIFIC.has(w));
  if (words.length === 0) return "";
  const surname = words[words.length - 1];
  if (!given && words.length > 1) given = words[0];
  const initial = given && /^[a-z]/.test(given) ? given[0] : "";
  return `${initial ? `${initial} ` : ""}${surname}`.slice(0, 100);
}

/**
 * Same book from different sources → same key: the title that names the book
 * (see keyTitle) and the first author's initial and surname (see authorKey).
 */
export function dedupeKey(title: string, author: string | null): string {
  return `${keyTitle(title).slice(0, 400)}|${authorKey(author)}`;
}

/**
 * Two dedupe keys that are probably the same book: same surname, and titles
 * that match word for word where one word may be cut short ("a confed of
 * dunces" and "a confederacy of dunces"). Numbers must match exactly, so
 * volume 1 and volume 10 stay apart. A volume number at the end counts the
 * same however it's written: "volume i", "volume 1" and "book 1" match.
 * Mirrors public._same_book_key in the database.
 */
export function sameBookKey(a: string, b: string): boolean {
  if (a === b) return true;
  const [ta, sa = ""] = a.split("|");
  const [tb, sb = ""] = b.split("|");
  if (sa !== sb || !ta || !tb) return false;
  const fb = volumeForms(tb.split(" "));
  return volumeForms(ta.split(" ")).some((wa) => fb.some((wb) => sameWords(wa, wb)));
}

const ROMAN: Record<string, string> = {
  i: "1", ii: "2", iii: "3", iv: "4", v: "5", vi: "6", vii: "7", viii: "8", ix: "9", x: "10",
  xi: "11", xii: "12", xiii: "13", xiv: "14", xv: "15", xvi: "16", xvii: "17", xviii: "18", xix: "19", xx: "20",
};
const VOLUME_WORD = new Set(["book", "vol", "volume", "part"]);

/**
 * A title's spellings with its last-word volume number written one way:
 * "volume i" → "volume 1"; "volume book i" → also "volume 1" (the label word
 * dropped). Both are offered, since "volume" can be part of the title itself.
 */
function volumeForms(words: string[]): string[][] {
  const last = words.length - 1;
  if (last < 1) return [words];
  const num = ROMAN[words[last]] ?? words[last];
  const forms = [[...words.slice(0, last), num]];
  if (/^\d+$/.test(num) && VOLUME_WORD.has(words[last - 1])) forms.push([...words.slice(0, last - 1), num]);
  return forms;
}

function sameWords(wa: string[], wb: string[]): boolean {
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
