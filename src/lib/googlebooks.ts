/**
 * Google Books, for Korean books: Apple doesn't sell books in Korea and Open
 * Library has few Korean editions, but Google has most of them, with the
 * author's Korean name and a cover. No key needed for a reader's own searches.
 */
import { cleanTitle, type BookInput } from "./books";

interface GoogleVolume {
  volumeInfo?: {
    title?: string;
    authors?: string[];
    publishedDate?: string;
    pageCount?: number;
    language?: string;
    industryIdentifiers?: Array<{ type?: string; identifier?: string }>;
    imageLinks?: { thumbnail?: string; smallThumbnail?: string };
  };
}

/** Google's cover link, over https and at a size that looks sharp. */
export function googleCover(link: string | undefined): string | null {
  if (!link) return null;
  const url = link.replace(/^http:\/\//, "https://").replace(/&edge=curl/g, "");
  if (!/^https:\/\/books\.google\.com\/books\/(publisher\/)?content\?/.test(url)) return null;
  return url.includes("fife=") ? url : `${url}&fife=w400-h600`;
}

export function fromVolume(v: GoogleVolume): BookInput | null {
  const info = v.volumeInfo;
  if (!info?.title || !info.authors?.length) return null;
  const year = Number(info.publishedDate?.slice(0, 4));
  const cover = googleCover(info.imageLinks?.thumbnail ?? info.imageLinks?.smallThumbnail);
  return {
    title: cleanTitle(info.title),
    // "손원평 (지은이)" → "손원평"
    author: info.authors[0].replace(/\s*\([^)]*\)\s*$/, "").trim(),
    isbn13: info.industryIdentifiers?.find((i) => i.type === "ISBN_13")?.identifier ?? null,
    year: year > 1000 ? year : null,
    pages: info.pageCount && info.pageCount > 0 ? info.pageCount : null,
    cover_url: cover && cover.length <= 400 ? cover : null,
  };
}

/**
 * Google limits searches made without a key, and refuses them when busy. With
 * a browser key (restricted to readread.app in Google Cloud), searches go
 * through reliably. Without one, Korean search falls back to Open Library.
 */
const KEY = process.env.NEXT_PUBLIC_GOOGLE_BOOKS_KEY;

async function volumes(params: Record<string, string>, signal?: AbortSignal): Promise<BookInput[]> {
  const query = new URLSearchParams({ printType: "books", maxResults: "20", ...params, ...(KEY ? { key: KEY } : {}) });
  const res = await fetch(`https://www.googleapis.com/books/v1/volumes?${query}`, { signal });
  if (!res.ok) {
    // Visible in the browser console, so a quota problem is easy to spot.
    console.warn(`[readread] Google Books search failed (${res.status})${KEY ? "" : ": no API key set"}`);
    return [];
  }
  const { items } = (await res.json()) as { items?: GoogleVolume[] };
  return (items ?? []).map(fromVolume).filter((b): b is BookInput => b !== null);
}

/** Books matching a search, in one language (Google's two-letter code). */
export function googleSearch(q: string, lang: string, signal?: AbortSignal): Promise<BookInput[]> {
  return volumes({ q, langRestrict: lang }, signal).catch(() => []);
}

/** The book with this ISBN, if Google knows it. */
export async function googleIsbn(isbn: string): Promise<BookInput | null> {
  const found = await volumes({ q: `isbn:${isbn.replace(/\D/g, "")}`, maxResults: "1" }).catch(() => []);
  return found[0] ? { ...found[0], isbn13: found[0].isbn13 ?? (isbn.length === 13 ? isbn : null) } : null;
}
