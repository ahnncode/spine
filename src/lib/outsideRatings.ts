import { sameTitle } from "./descriptions";
import { lookup } from "./openlibrary";

/**
 * Star ratings from elsewhere (Apple Books, Open Library), shown as a quiet
 * reference under readread's own scores. Out of 5; hidden below MIN_COUNT.
 */

export const MIN_COUNT = 25;

export interface OutsideRating {
  source: "apple" | "openlibrary";
  label: string;
  average: number;
  count: number;
}

type BookRef = { id: string; title: string; author: string | null; ol_work_key?: string | null };

// One lookup per book per visit.
const cache = new Map<string, Promise<OutsideRating[]>>();

async function apple(book: BookRef): Promise<OutsideRating | null> {
  const plain = book.title.split(":")[0].replace(/\((?:book|vol\.?|volume)?\s*[\divx]+\)/gi, " ").replace(/[()[\]]/g, " ");
  const term = [plain, book.author ?? ""].join(" ").replace(/\s+/g, " ").trim();
  const params = new URLSearchParams({ term, media: "ebook", entity: "ebook", limit: "8", country: "us" });
  const res = await fetch(`https://itunes.apple.com/search?${params}`);
  if (!res.ok) return null;
  const { results } = (await res.json()) as { results?: Array<{ trackName?: string; artistName?: string; averageUserRating?: number; userRatingCount?: number }> };
  // The match with the most ratings (Apple sometimes lists several editions).
  const hits = (results ?? []).filter((r) => r.averageUserRating && r.userRatingCount && sameTitle(book, r));
  const best = hits.sort((a, b) => (b.userRatingCount ?? 0) - (a.userRatingCount ?? 0))[0];
  return best ? { source: "apple", label: "Apple Books", average: best.averageUserRating!, count: best.userRatingCount! } : null;
}

async function openLibrary(book: BookRef): Promise<OutsideRating | null> {
  let key = book.ol_work_key ?? null;
  if (!key) key = (await lookup(book.title, book.author).catch(() => null))?.ol_work_key ?? null;
  if (!key || !/^\/works\/OL\d+W$/.test(key)) return null;
  const res = await fetch(`https://openlibrary.org${key}/ratings.json`);
  if (!res.ok) return null;
  const { summary } = (await res.json()) as { summary?: { average?: number | null; count?: number } };
  return summary?.average && summary.count ? { source: "openlibrary", label: "Open Library", average: summary.average, count: summary.count } : null;
}

export function outsideRatings(book: BookRef): Promise<OutsideRating[]> {
  let p = cache.get(book.id);
  if (!p) {
    p = Promise.all([apple(book).catch(() => null), openLibrary(book).catch(() => null)]).then((rs) =>
      rs.filter((r): r is OutsideRating => Boolean(r) && r!.count >= MIN_COUNT),
    );
    cache.set(book.id, p);
  }
  return p;
}
