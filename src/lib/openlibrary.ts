import { englishAuthorName, isLatin } from "./authors";
import { cleanTitle, dedupeKey, type BookInput } from "./books";
import { genresFromSubjects } from "./genres";

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
const QUICK_FIELDS = "key,title,author_name,author_alternative_name,first_publish_year,cover_i,number_of_pages_median";
const ENGLISH_FIELDS = `${QUICK_FIELDS},editions,editions.title,editions.language,editions.cover_i,editions.isbn`;

/** Spine is for English readers: prefer English editions' titles and covers. */
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

function tidy(docs: OLDoc[]): BookInput[] {
  // Catalogue clean-up: books with an English edition first, author-less
  // stubs last, and one result per title + author.
  const score = (d: OLDoc) => (englishEdition(d) || d.editions === undefined ? 0 : 1) + (d.author_name?.length ? 0 : 2);
  const ranked = docs.map((d, i) => ({ d, i })).sort((a, b) => score(a.d) - score(b.d) || a.i - b.i);
  const seen = new Set<string>();
  const out: BookInput[] = [];
  for (const { d } of ranked) {
    const book = toBook(d);
    const key = dedupeKey(book.title, book.author);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(book);
    if (out.length >= 20) break;
  }
  return out;
}

const cache = new Map<string, BookInput[]>();

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
  const quick = search({ q, limit: "15" }, signal, QUICK_FIELDS)
    .then((docs) => {
      if (!finalDone) onResults?.(tidy(docs), false);
    })
    .catch(() => {});
  const english = search({ q, limit: "20" }, signal, ENGLISH_FIELDS).then((docs) => {
    finalDone = true;
    const books = tidy(docs);
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
    const fallback = await search({ q, limit: "15" }, signal, QUICK_FIELDS).then(tidy);
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
  const params: Record<string, string> = { title, limit: "1" };
  if (author) params.author = author;
  const docs = await search(params);
  return docs[0] ? toBook(docs[0]) : null;
}
