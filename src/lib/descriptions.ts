import { NOT_A_KEY_CHAR, appleCountry, nativeScript } from "./scripts";
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

type OLText = string | { value?: string } | undefined;
const textOf = (d: OLText) => (typeof d === "string" ? d : d?.value) ?? null;
const usable = (raw: string | null) => {
  if (!raw) return null;
  const text = cleanDescription(raw);
  return text.length >= MIN && looksEnglish(text) ? text : null;
};

async function fromOpenLibrary(book: { title: string; author: string | null; ol_work_key?: string | null }): Promise<string | null> {
  let key = book.ol_work_key ?? null;
  if (!key) key = (await lookup(book.title, book.author).catch(() => null))?.ol_work_key ?? null;
  if (!key || !/^\/works\/OL\d+W$/.test(key)) return null;
  const res = await fetch(`https://openlibrary.org${key}.json`);
  if (res.ok) {
    const work = (await res.json()) as { description?: OLText };
    const text = usable(textOf(work.description));
    if (text) return text;
  }
  // Translations often keep the description on their English editions, not
  // on the work (which may be in the original language).
  const eds = await fetch(`https://openlibrary.org${key}/editions.json?limit=50`);
  if (!eds.ok) return null;
  const { entries } = (await eds.json()) as { entries?: Array<{ description?: OLText; languages?: Array<{ key?: string }> }> };
  const english = (entries ?? [])
    .filter((e) => e.description && (!e.languages?.length || e.languages.some((l) => l.key === "/languages/eng")))
    .sort((a, b) => Number(Boolean(b.languages?.length)) - Number(Boolean(a.languages?.length)));
  for (const e of english) {
    const text = usable(textOf(e.description));
    if (text) return text;
  }
  return null;
}

const ROMAN: Record<string, string> = { i: "1", ii: "2", iii: "3", iv: "4", v: "5", vi: "6", vii: "7", viii: "8", ix: "9", x: "10" };

/** A title reduced to comparable words: "On the Calculation of Volume (Book I)" → on the calculation of volume 1. */
export function titleWords(title: string): string[] {
  return title
    .split(":")[0]
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .normalize("NFC")
    .replace(/&/g, " and ")
    .replace(NOT_A_KEY_CHAR, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter((w, i) => !(i === 0 && ["the", "a", "an"].includes(w)))
    .filter((w) => !["book", "vol", "novel"].includes(w))
    .map((w) => ROMAN[w] ?? w);
}

/** Same book for a description: same title words (series numbers must agree), and the author's surname. */
export function sameTitle(want: { title: string; author: string | null }, got: { trackName?: string; artistName?: string }): boolean {
  if (!got.trackName) return false;
  const a = titleWords(want.title).join(" ");
  const b = titleWords(got.trackName).join(" ");
  if (!a || a !== b) return false;
  if (!want.author) return true;
  const surname = want.author.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").split(/\s+/).pop() ?? "";
  return !surname || (got.artistName ?? "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").includes(surname);
}

async function fromApple(book: { title: string; author: string | null }): Promise<string | null> {
  // Search without series markers like "(Book I)", which Apple's titles rarely have.
  const plain = book.title.split(":")[0].replace(/\((?:book|vol\.?|volume)?\s*[\divx]+\)/gi, " ").replace(/[()[\]]/g, " ");
  const term = [plain, book.author ?? ""].join(" ").replace(/\s+/g, " ").trim();
  const params = new URLSearchParams({ term, media: "ebook", entity: "ebook", limit: "8", country: appleCountry(book.title) });
  const res = await fetch(`https://itunes.apple.com/search?${params}`);
  if (!res.ok) return null;
  const { results } = (await res.json()) as { results?: Array<{ trackName?: string; artistName?: string; description?: string }> };
  const hit = (results ?? []).find((r) => r.description && sameTitle(book, r));
  if (!hit?.description) return null;
  const text = cleanDescription(hit.description);
  // A Korean book's description is in Korean, which is what its readers want.
  return text.length >= MIN && (looksEnglish(text) || nativeScript(book.title) !== null) ? text : null;
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
