import { sameBook } from "./applecovers";
import { isLatin } from "./authors";
import { lookup } from "./openlibrary";

/**
 * An "about this book" blurb: Open Library's work description first, then
 * Apple Books' (publisher copy). Cleaned to plain text.
 */

const MIN = 80;
const MAX = 2500;

/** Turn HTML or Open Library's markdown into tidy plain text. */
export function cleanDescription(raw: string): string {
  let s = raw
    // Open Library: reference lists and "----------" footers come after the text.
    .split(/\n-{3,}|\n\s*\[\d+\]:/)[0]
    .replace(/\(\s*\[source\]\[\d+\]\s*\)/gi, "")
    .replace(/\[([^\]]+)\]\[\d+\]/g, "$1")
    .replace(/\[([^\]]+)\]\((?:https?:)?[^)]*\)/g, "$1")
    .replace(/https?:\/\/\S+/g, "")
    // Apple: HTML.
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>\s*<p[^>]*>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;|&apos;/g, "’")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[*_]{1,2}([^*_]+)[*_]{1,2}/g, "$1")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (s.length > MAX) {
    const cut = s.slice(0, MAX);
    const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf(".\n"));
    s = end > MAX / 2 ? cut.slice(0, end + 1) : `${cut.trimEnd()}…`;
  }
  return s;
}

/** Mostly English letters (skips descriptions in other languages and scripts). */
function looksEnglish(s: string): boolean {
  if (!isLatin(s.slice(0, 400))) return false;
  const words = s.toLowerCase().match(/[a-z']+/g) ?? [];
  const common = words.filter((w) => ["the", "and", "of", "a", "to", "in", "is", "her", "his", "with", "for"].includes(w)).length;
  return words.length > 0 && common / words.length > 0.06;
}

async function fromOpenLibrary(book: { title: string; author: string | null; ol_work_key?: string | null }): Promise<string | null> {
  let key = book.ol_work_key ?? null;
  if (!key) key = (await lookup(book.title, book.author).catch(() => null))?.ol_work_key ?? null;
  if (!key || !/^\/works\/OL\d+W$/.test(key)) return null;
  const res = await fetch(`https://openlibrary.org${key}.json`);
  if (!res.ok) return null;
  const work = (await res.json()) as { description?: string | { value?: string } };
  const raw = typeof work.description === "string" ? work.description : work.description?.value;
  if (!raw) return null;
  const text = cleanDescription(raw);
  return text.length >= MIN && looksEnglish(text) ? text : null;
}

async function fromApple(book: { title: string; author: string | null }): Promise<string | null> {
  const term = [book.title.split(":")[0].replace(/[()[\]]/g, " "), book.author ?? ""].join(" ").replace(/\s+/g, " ").trim();
  const params = new URLSearchParams({ term, media: "ebook", entity: "ebook", limit: "8", country: "us" });
  const res = await fetch(`https://itunes.apple.com/search?${params}`);
  if (!res.ok) return null;
  const { results } = (await res.json()) as { results?: Array<{ trackName?: string; artistName?: string; description?: string }> };
  const hit = (results ?? []).find((r) => r.description && sameBook(book, r));
  if (!hit?.description) return null;
  const text = cleanDescription(hit.description);
  return text.length >= MIN && looksEnglish(text) ? text : null;
}

export async function findDescription(book: {
  title: string;
  author: string | null;
  ol_work_key?: string | null;
}): Promise<{ text: string; source: "openlibrary" | "apple" } | null> {
  const ol = await fromOpenLibrary(book).catch(() => null);
  if (ol) return { text: ol, source: "openlibrary" };
  const apple = await fromApple(book).catch(() => null);
  if (apple) return { text: apple, source: "apple" };
  return null;
}
