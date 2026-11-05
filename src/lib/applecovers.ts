import { isLatin, nameWords } from "./authors";

/**
 * Backup cover art from Apple's book catalogue, for books Open Library has
 * no picture for. No key needed; Apple allows about 20 lookups a minute.
 */

interface AppleResult {
  trackName?: string;
  artistName?: string;
  artworkUrl100?: string;
  genres?: string[];
}

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .split(":")[0]
    .replace(/[^a-z0-9 ]/g, " ")
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
  const params = new URLSearchParams({ term, media: "ebook", entity: "ebook", limit: "8", country: "us" });
  const res = await fetch(`https://itunes.apple.com/search?${params}`);
  if (!res.ok) throw new Error(`Apple lookup failed (${res.status})`);
  const { results } = (await res.json()) as { results?: AppleResult[] };
  const hit = (results ?? []).find((r) => sameBook({ title, author }, r));
  return hit ? { cover: hit.artworkUrl100 ? bigArtwork(hit.artworkUrl100) : null, genres: hit.genres ?? [] } : null;
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
