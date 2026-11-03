import { cleanTitle, dedupeKey, type BookInput } from "./books";
import { genresFromSubjects } from "./genres";

interface OLDoc {
  key: string;
  title: string;
  author_name?: string[];
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

const FIELDS =
  "key,title,author_name,first_publish_year,cover_i,isbn,number_of_pages_median,subject," +
  "editions,editions.title,editions.language,editions.cover_i,editions.isbn";

/** Spine is for English readers: prefer English editions' titles and covers. */
function englishEdition(d: OLDoc): OLEdition | null {
  const ed = d.editions?.docs?.[0];
  return ed?.title && ed.language?.includes("eng") ? ed : null;
}

function toBook(d: OLDoc, isbn13?: string): BookInput {
  const en = englishEdition(d);
  return {
    title: cleanTitle(en?.title ?? d.title),
    author: d.author_name?.[0] ?? null,
    ol_work_key: d.key,
    cover_id: en?.cover_i ?? d.cover_i ?? null,
    isbn13: isbn13 ?? en?.isbn?.find((i) => i.length === 13) ?? d.isbn?.find((i) => i.length === 13) ?? null,
    year: d.first_publish_year ?? null,
    pages: d.number_of_pages_median ?? null,
    genres: genresFromSubjects(d.subject, d.first_publish_year),
  };
}

async function search(params: Record<string, string>, signal?: AbortSignal): Promise<OLDoc[]> {
  const res = await fetch(`https://openlibrary.org/search.json?${new URLSearchParams({ fields: FIELDS, lang: "en", ...params })}`, { signal });
  if (!res.ok) throw new Error("Search is unavailable right now");
  return ((await res.json()) as { docs: OLDoc[] }).docs;
}

export async function searchBooks(query: string, signal?: AbortSignal): Promise<BookInput[]> {
  const q = query.trim();
  if (!q) return [];
  const docs = await search({ q, limit: "30" }, signal);
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
