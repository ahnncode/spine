import type { BookInput } from "./books";
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
}

const FIELDS = "key,title,author_name,first_publish_year,cover_i,isbn,number_of_pages_median,subject";

function toBook(d: OLDoc, isbn13?: string): BookInput {
  return {
    title: d.title,
    author: d.author_name?.[0] ?? null,
    ol_work_key: d.key,
    cover_id: d.cover_i ?? null,
    isbn13: isbn13 ?? d.isbn?.find((i) => i.length === 13) ?? null,
    year: d.first_publish_year ?? null,
    pages: d.number_of_pages_median ?? null,
    genres: genresFromSubjects(d.subject, d.first_publish_year),
  };
}

async function search(params: Record<string, string>, signal?: AbortSignal): Promise<OLDoc[]> {
  const res = await fetch(`https://openlibrary.org/search.json?${new URLSearchParams({ fields: FIELDS, ...params })}`, { signal });
  if (!res.ok) throw new Error("Search is unavailable right now");
  return ((await res.json()) as { docs: OLDoc[] }).docs;
}

export async function searchBooks(query: string, signal?: AbortSignal): Promise<BookInput[]> {
  const q = query.trim();
  if (!q) return [];
  return (await search({ q, limit: "20" }, signal)).map((d) => toBook(d));
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
