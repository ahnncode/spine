import { isLatin, nameWords } from "./authors";
import { NOT_A_KEY_CHAR, appleCountry, fold } from "./scripts";

/**
 * Backup cover art from Apple's book catalogue, for books Open Library has
 * no picture for. No key needed; Apple allows about 20 lookups a minute.
 */

interface AppleResult {
  trackName?: string;
  artistName?: string;
  artworkUrl100?: string;
  genres?: string[];
  trackViewUrl?: string;
}

/** Artwork served by Apple (their terms tie it to promoting Apple Books). */
export function isAppleArt(url: string | null | undefined): boolean {
  return Boolean(url && /(^|\.)mzstatic\.com\//.test(url.replace(/^https?:\/\//, "")));
}

function norm(s: string): string {
  return fold(s)
    .split(":")[0]
    .replace(NOT_A_KEY_CHAR, " ")
    .replace(/^(the|a|an) /, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Same book? Titles must match (ignoring subtitles); authors share a surname. */
export function sameBook(want: { title: string; author: string | null }, got: AppleResult): boolean {
  if (!got.trackName) return false;
  const a = norm(want.title), b = norm(got.trackName);
  if (!a || !(a === b || b.startsWith(`${a} `) || a.startsWith(`${b} `))) return false;
  if (!want.author) return true;
  const surname = norm(want.author).split(" ").pop() ?? "";
  return !surname || norm(got.artistName ?? "").split(" ").includes(surname);
}

/** A big version of Apple's artwork URL (it serves any size inside a box). */
export function bigArtwork(url: string): string {
  return url.replace(/\/\d+x\d+bb\.(jpg|png)$/, "/400x600bb.jpg");
}

/** The same book in Apple's catalogue: its cover and its genre names. */
export async function findAppleBook(title: string, author: string | null): Promise<{ cover: string | null; genres: string[] } | null> {
  const term = [title.split(":")[0].replace(/[()[\]]/g, " "), author ?? ""].join(" ").replace(/\s+/g, " ").trim();
  // Korean books: Apple's Korean store.
  const params = new URLSearchParams({ term, media: "ebook", entity: "ebook", limit: "8", country: appleCountry(title) });
  const res = await fetch(`https://itunes.apple.com/search?${params}`);
  if (!res.ok) throw new Error(`Apple lookup failed (${res.status})`);
  const { results } = (await res.json()) as { results?: AppleResult[] };
  const hit = (results ?? []).find((r) => sameBook({ title, author }, r));
  return hit ? { cover: hit.artworkUrl100 ? bigArtwork(hit.artworkUrl100) : null, genres: hit.genres ?? [] } : null;
}

// One Apple Books link lookup per book per visit.
const linkCache = new Map<string, Promise<string | null>>();

/**
 * The book's Apple Books page. Apple's terms ask that their artwork,
 * descriptions and ratings sit beside a link to the book in their store.
 */
export function appleBooksLink(title: string, author: string | null): Promise<string | null> {
  const key = `${title}|${author ?? ""}`;
  let hit = linkCache.get(key);
  if (!hit) {
    hit = (async () => {
      const term = [title.split(":")[0].replace(/[()[\]]/g, " "), author ?? ""].join(" ").replace(/\s+/g, " ").trim();
      const params = new URLSearchParams({ term, media: "ebook", entity: "ebook", limit: "8", country: appleCountry(title) });
      const res = await fetch(`https://itunes.apple.com/search?${params}`);
      if (!res.ok) return null;
      const { results } = (await res.json()) as { results?: AppleResult[] };
      const found = (results ?? []).find((r) => sameBook({ title, author }, r));
      return found?.trackViewUrl && /^https:\/\/books\.apple\.com\//.test(found.trackViewUrl) ? found.trackViewUrl : null;
    })().catch(() => null);
    linkCache.set(key, hit);
  }
  return hit;
}

export async function findAppleCover(title: string, author: string | null): Promise<string | null> {
  return (await findAppleBook(title, author))?.cover ?? null;
}

/**
 * How Apple's English catalogue spells an author, for names Open Library has
 * in another script or in an uncertain order. `spellings` are the names we
 * already think it could be; Apple's must use the same words.
 */
export async function findAppleAuthor(title: string, spellings: string[]): Promise<string | null> {
  const words = spellings.filter(isLatin).map(nameWords);
  if (!words.length) return null;
  const term = `${title.split(":")[0]} ${spellings.find(isLatin) ?? ""}`.replace(/[()[\]]/g, " ").replace(/\s+/g, " ").trim();
  const params = new URLSearchParams({ term, media: "ebook", entity: "ebook", limit: "8", country: "us" });
  const res = await fetch(`https://itunes.apple.com/search?${params}`);
  if (!res.ok) throw new Error(`Apple lookup failed (${res.status})`);
  const { results } = (await res.json()) as { results?: AppleResult[] };
  for (const r of results ?? []) {
    if (!r.artistName || !sameBook({ title, author: null }, r)) continue;
    const first = r.artistName.split(/\s*(?:&|,| and )\s*/)[0].trim();
    const got = nameWords(first);
    if (got.size && words.some((w) => [...got].every((x) => w.has(x)) && [...w].every((x) => got.has(x)))) return first;
  }
  return null;
}
