import { englishAuthorName, isLatin } from "./authors";
import { cleanTitle, dedupeKey, sameBookKey, type BookInput } from "./books";
import { genresFromApple, genresFromSubjects } from "./genres";
import { findAppleBook } from "./applecovers";

interface OLDoc {
  key: string;
  title: string;
  author_name?: string[];
  /** Other spellings of the authors' names (often the English one). */
  author_alternative_name?: string[];
  first_publish_year?: number;
  cover_i?: number;
  isbn?: string[];
  number_of_pages_median?: number;
  subject?: string[];
  /** Popularity on Open Library: readers who logged it, and how many editions exist. */
  readinglog_count?: number;
  edition_count?: number;
  /** With lang=en, the best-matching English edition of this work. */
  editions?: { docs?: OLEdition[] };
}

interface OLEdition {
  title?: string;
  language?: string[];
  cover_i?: number;
  isbn?: string[];
}

// Full detail, for filling in one book (includes subjects for genres).
const FIELDS =
  "key,title,author_name,author_alternative_name,first_publish_year,cover_i,isbn,number_of_pages_median,subject," +
  "editions,editions.title,editions.language,editions.cover_i,editions.isbn";
// Search results: just what the list shows. Leaving out subjects and the full
// ISBN lists cuts responses from ~300KB to a few KB.
const QUICK_FIELDS =
  "key,title,author_name,author_alternative_name,first_publish_year,cover_i,number_of_pages_median,readinglog_count,edition_count";
const ENGLISH_FIELDS = `${QUICK_FIELDS},editions,editions.title,editions.language,editions.cover_i,editions.isbn`;

/** readread is for English readers: prefer English editions' titles and covers. */
function englishEdition(d: OLDoc): OLEdition | null {
  const ed = d.editions?.docs?.[0];
  return ed?.title && ed.language?.includes("eng") ? ed : null;
}

/**
 * Books whose author we spelled from Open Library's alternatives (or couldn't),
 * with every spelling we saw, so Apple's catalogue can confirm the English one.
 */
const authorSpellings = new Map<string, string[]>();

/** Spellings to check for a book's author, if it needs checking. */
export function authorToCheck(book: BookInput): string[] | null {
  const key = dedupeKey(book.title, book.author);
  if (authorSpellings.has(key)) return authorSpellings.get(key)!;
  return book.author && !isLatin(book.author) ? [book.author] : null;
}

function toBook(d: OLDoc, isbn13?: string): BookInput {
  const en = englishEdition(d);
  const native = d.author_name?.[0] ?? null;
  const english = englishAuthorName(native, d.author_alternative_name);
  const title = cleanTitle(en?.title ?? d.title);
  if (english.guessed || (english.name && !isLatin(english.name))) {
    const alts = (d.author_alternative_name ?? []).filter((a) => isLatin(a) && !a.includes(";"));
    authorSpellings.set(dedupeKey(title, english.name), [english.name!, ...alts].slice(0, 12));
    if (authorSpellings.size > 500) authorSpellings.delete(authorSpellings.keys().next().value!);
  }
  return {
    title,
    author: english.name,
    ol_work_key: d.key,
    cover_id: en?.cover_i ?? d.cover_i ?? null,
    isbn13: isbn13 ?? en?.isbn?.find((i) => i.length === 13) ?? d.isbn?.find((i) => i.length === 13) ?? null,
    year: d.first_publish_year ?? null,
    pages: d.number_of_pages_median ?? null,
    genres: genresFromSubjects(d.subject, d.first_publish_year),
  };
}

async function search(params: Record<string, string>, signal?: AbortSignal, fields = FIELDS): Promise<OLDoc[]> {
  const res = await fetch(`https://openlibrary.org/search.json?${new URLSearchParams({ fields, lang: "en", ...params })}`, { signal });
  if (!res.ok) throw new Error("Search is unavailable right now");
  return ((await res.json()) as { docs: OLDoc[] }).docs;
}

const STOP_WORDS = new Set(["the", "a", "an", "of", "and", "to", "in", "on", "by"]);

function norm(s: string): string {
  return s.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Order results the way a reader expects: well-known books first. Open
 * Library's own relevance still counts a little, an exact title match gets a
 * nudge, and stubs (no author, no English edition) sink.
 */
export function rankScore(d: OLDoc, query: string, position: number): number {
  const q = norm(query);
  const title = norm(englishEdition(d)?.title ?? d.title);
  const popularity = Math.log10(1 + (d.readinglog_count ?? 0)) + 0.3 * Math.log10(1 + (d.edition_count ?? 0));
  const match = title === q ? 0.6 : title.startsWith(`${q} `) ? 0.3 : 0;
  // Popular books that only matched on some description or subject (search
  // "project hail mary", get Macbeth) don't get to jump the line.
  const words = new Set(`${title} ${norm((d.author_name ?? []).join(" "))}`.split(" "));
  const missing = q.split(" ").filter((w) => w.length > 1 && !STOP_WORDS.has(w) && !words.has(w)).length;
  const stub = (d.author_name?.length ? 0 : 3) + (d.editions !== undefined && !englishEdition(d) ? 1 : 0);
  return popularity + match - 0.05 * position - stub - (missing ? 2 + missing : 0);
}

function tidy(docs: OLDoc[], query: string): BookInput[] {
  const ranked = docs
    .map((d, i) => ({ d, score: rankScore(d, query, i) }))
    .sort((a, b) => b.score - a.score);
  // One result per title + author. Open Library often has the same book as
  // several "works" (reissues, new editions); keep the best-ranked one but the
  // earliest year any of them gives, so a 1983 novel doesn't say 2014.
  const byKey = new Map<string, BookInput>();
  for (const { d } of ranked) {
    const book = toBook(d);
    const key = dedupeKey(book.title, book.author);
    // Near-identical titles too: some entries cut a word short ("A Confed of Dunces").
    const keptKey = byKey.has(key) ? key : [...byKey.keys()].find((k) => sameBookKey(k, key));
    const kept = keptKey ? byKey.get(keptKey) : undefined;
    if (kept) {
      if (book.year && (!kept.year || book.year < kept.year)) kept.year = book.year;
      if (keptKey !== key && key.length > keptKey!.length) kept.title = book.title;
      continue;
    }
    if (byKey.size < 20) byKey.set(key, book);
  }
  return [...byKey.values()];
}

const cache = new Map<string, BookInput[]>();

const words = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").split(/[^a-z0-9]+/).filter((w) => w.length > 1);
/** Every word of the query appears in the book's title or author. */
function covers(b: BookInput, q: string[]): boolean {
  const have = new Set(words(`${b.title} ${b.author ?? ""}`));
  return q.length > 0 && q.every((w) => have.has(w));
}

/**
 * Apple Books' catalogue, for books Open Library doesn't have yet (new
 * releases especially). Companion books like summaries are left out.
 */
async function appleSearch(q: string, signal?: AbortSignal): Promise<BookInput[]> {
  const params = new URLSearchParams({ term: q, media: "ebook", entity: "ebook", limit: "10", country: "us" });
  const res = await fetch(`https://itunes.apple.com/search?${params}`, { signal });
  if (!res.ok) return [];
  const { results } = (await res.json()) as { results?: Array<{ trackName?: string; artistName?: string; releaseDate?: string; artworkUrl100?: string }> };
  return (results ?? [])
    .filter((r) => r.trackName && r.artistName && !/\b(summary|study guide|workbook|analysis|sparknotes|cliffsnotes)\b/i.test(r.trackName))
    .map((r) => ({
      title: cleanTitle(r.trackName!),
      author: r.artistName!.split(/\s*(?:&|,| and )\s*/)[0],
      // Apple's date is when that ebook came out, not when the book did: leave it out.
      year: null,
      cover_url: r.artworkUrl100 ? r.artworkUrl100.replace(/\/\d+x\d+bb\.(jpg|png)$/, "/400x600bb.jpg") : null,
    }));
}

/** Add Apple's finds that Open Library is missing: first if Open Library has nothing that fits the query. */
function withApple(ol: BookInput[], apple: BookInput[], query: string): BookInput[] {
  // Apple often lists several editions of one book; keep one, and none Open Library already has.
  const seen = ol.map((b) => dedupeKey(b.title, b.author));
  const extra = apple.filter((b) => {
    const k = dedupeKey(b.title, b.author);
    if (seen.some((s) => sameBookKey(s, k))) return false;
    seen.push(k);
    return true;
  });
  if (!extra.length) return ol;
  const q = words(query);
  const olFits = ol.some((b) => covers(b, q));
  const fits = extra.filter((b) => covers(b, q));
  if (!olFits && fits.length) return [...fits.slice(0, 3), ...ol, ...extra.filter((b) => !fits.includes(b)).slice(0, 2)];
  return [...ol, ...extra.slice(0, 3)];
}

/**
 * Search in two passes: a quick one that answers in a few hundred
 * milliseconds, then a slower one with English editions (titles and covers)
 * that replaces it. `onResults` is called for each; the last call is final.
 */
export async function searchBooks(query: string, signal?: AbortSignal, onResults?: (books: BookInput[], final: boolean) => void): Promise<BookInput[]> {
  const q = query.trim();
  if (!q) return [];
  const key = q.toLowerCase();
  const hit = cache.get(key);
  if (hit) {
    onResults?.(hit, true);
    return hit;
  }
  let finalDone = false;
  const quick = search({ q, limit: "20" }, signal, QUICK_FIELDS)
    .then((docs) => {
      if (!finalDone) onResults?.(tidy(docs, q), false);
    })
    .catch(() => {});
  const apple = appleSearch(q, signal).catch(() => [] as BookInput[]);
  const english = search({ q, limit: "25" }, signal, ENGLISH_FIELDS).then(async (docs) => {
    finalDone = true;
    const books = withApple(tidy(docs, q), await apple, q);
    cache.set(key, books);
    if (cache.size > 50) cache.delete(cache.keys().next().value!);
    onResults?.(books, true);
    return books;
  });
  try {
    return await english;
  } catch (e) {
    // The English pass failed: keep whatever the quick pass found.
    await quick;
    if (signal?.aborted) throw e;
    const fallback = withApple(await search({ q, limit: "15" }, signal, QUICK_FIELDS).then((docs) => tidy(docs, q)).catch(() => []), await apple, q);
    onResults?.(fallback, true);
    return fallback;
  }
}

/** Look a scanned barcode up by ISBN. */
export async function findByIsbn(isbn: string): Promise<BookInput | null> {
  const docs = await search({ isbn, limit: "1" });
  return docs[0] ? toBook(docs[0], isbn.length === 13 ? isbn : undefined) : null;
}

/** Best Open Library match for a title and author (used to fill in imports). */
export async function lookup(title: string, author: string | null): Promise<BookInput | null> {
  const find = async (t: string) => {
    const params: Record<string, string> = { title: t, limit: "1" };
    if (author) params.author = author;
    return (await search(params))[0];
  };
  // A long title with a subtitle (often from Apple) can miss; try the short one too.
  const short = title.split(/[:(]/)[0].trim();
  const doc = (await find(title)) ?? (short && short !== title ? await find(short) : undefined);
  const book = doc ? toBook(doc) : null;
  if (book?.genres?.length) return book;
  // Open Library has no match, or no subjects we can place: ask Apple for its genre.
  const apple = await findAppleBook(title, author).catch(() => null);
  const genres = genresFromApple(apple?.genres);
  if (!genres.length) return book;
  return book ? { ...book, genres } : { title, author, genres };
}
