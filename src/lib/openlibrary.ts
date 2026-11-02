import type { BookInput } from "./books";

interface OLDoc {
  key: string;
  title: string;
  author_name?: string[];
  first_publish_year?: number;
  cover_i?: number;
  isbn?: string[];
  number_of_pages_median?: number;
}

export async function searchBooks(query: string, signal?: AbortSignal): Promise<BookInput[]> {
  const q = query.trim();
  if (!q) return [];
  const params = new URLSearchParams({
    q,
    limit: "20",
    fields: "key,title,author_name,first_publish_year,cover_i,isbn,number_of_pages_median",
  });
  const res = await fetch(`https://openlibrary.org/search.json?${params}`, { signal });
  if (!res.ok) throw new Error("Search is unavailable right now");
  const json = (await res.json()) as { docs: OLDoc[] };
  return json.docs.map((d) => ({
    title: d.title,
    author: d.author_name?.[0] ?? null,
    ol_work_key: d.key,
    cover_id: d.cover_i ?? null,
    isbn13: d.isbn?.find((i) => i.length === 13) ?? null,
    year: d.first_publish_year ?? null,
    pages: d.number_of_pages_median ?? null,
  }));
}
