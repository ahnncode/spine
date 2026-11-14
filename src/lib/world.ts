import { COUNTRIES } from "./countries";
import type { Entry } from "./data";

export type Continent = "AF" | "AS" | "EU" | "NA" | "OC" | "SA";

export const CONTINENTS: Array<{ key: Continent; name: string }> = [
  { key: "AS", name: "Asia" },
  { key: "EU", name: "Europe" },
  { key: "NA", name: "North America" },
  { key: "SA", name: "South America" },
  { key: "AF", name: "Africa" },
  { key: "OC", name: "Oceania" },
];

export interface CountryStamp {
  code: string;
  name: string;
  continent: Continent;
  /** ISO numeric, the key in /world-map.json. */
  numeric: string | null;
  books: Entry[];
  translated: number;
}

export interface WorldPassport {
  countries: CountryStamp[];
  continents: number;
  translated: number;
  /** Books you've read whose author's country we know. */
  placed: number;
}

/** Books you've read: ranked, or read and waiting to be rated. */
const isRead = (e: Entry) => e.status === "ranked" || e.status === "unsorted";

export function countryName(code: string): string {
  return COUNTRIES[code]?.[1] ?? code;
}

/** Your stamps: one per country you've read an author from, most-read first. */
export function worldPassport(entries: Entry[]): WorldPassport {
  const by = new Map<string, CountryStamp>();
  let translated = 0;
  let placed = 0;
  for (const e of entries) {
    const code = e.book.author_country;
    if (!isRead(e) || !code || !COUNTRIES[code]) continue;
    const [numeric, name, continent] = COUNTRIES[code];
    const s = by.get(code) ?? { code, name, continent, numeric, books: [], translated: 0 };
    s.books.push(e);
    placed++;
    if (e.book.translated) {
      s.translated++;
      translated++;
    }
    by.set(code, s);
  }
  const countries = [...by.values()].sort((a, b) => b.books.length - a.books.length || a.name.localeCompare(b.name));
  return { countries, continents: new Set(countries.map((c) => c.continent)).size, translated, placed };
}

/** Is this the first book you've read from its author's country? */
export function isNewCountry(entries: Entry[], bookId: string, country: string | null | undefined): boolean {
  if (!country) return false;
  return !entries.some((e) => e.book_id !== bookId && isRead(e) && e.book.author_country === country);
}

/** The inks stamps cycle through (all pass 4.5:1 on the page in both themes). */
export const STAMP_INKS = ["var(--focus)", "var(--accent-ink)", "var(--success)", "var(--ink)", "var(--amber-ink)"];
