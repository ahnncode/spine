/**
 * Where a book's author is from, for the world passport.
 *
 * Open Library gives us the author's id; Wikidata links Open Library ids
 * (property P648) to people, and people to their country of citizenship
 * (P27 → its ISO code P297) and the languages they write in (P1412 → P218).
 * A book counts as translated when we know the author's languages and English
 * isn't one of them; otherwise we don't claim either way.
 */

export interface CountryResult {
  country: string | null;
  translated: boolean | null;
}

type LookupBook = { title: string; author: string | null; ol_work_key?: string | null };

const OL_AUTHOR = /^OL\d+A$/;

/** The Open Library author id for a book: from its work when we have one, else a title/author search. */
export async function openLibraryAuthor(book: LookupBook, signal?: AbortSignal): Promise<string | null> {
  try {
    if (book.ol_work_key && /^\/works\/OL\d+W$/.test(book.ol_work_key)) {
      const res = await fetch(`https://openlibrary.org${book.ol_work_key}.json`, { signal });
      if (res.ok) {
        const w = (await res.json()) as { authors?: { author?: { key?: string } }[] };
        const key = w.authors?.[0]?.author?.key?.split("/").pop();
        if (key && OL_AUTHOR.test(key)) return key;
      }
    }
    if (!book.author) return null;
    const q = new URLSearchParams({ title: book.title, author: book.author, fields: "author_key", limit: "1" });
    const res = await fetch(`https://openlibrary.org/search.json?${q}`, { signal });
    if (!res.ok) return null;
    const key = ((await res.json()) as { docs?: { author_key?: string[] }[] }).docs?.[0]?.author_key?.[0];
    return key && OL_AUTHOR.test(key) ? key : null;
  } catch {
    return null;
  }
}

type Row = { olid: { value: string }; iso?: { value: string }; rank?: { value: string }; lang?: { value: string } };

/** Pick one country per author: a "preferred" citizenship first, then the first listed. */
export function pickCountries(rows: Row[]): Map<string, CountryResult> {
  const by = new Map<string, { countries: { iso: string; preferred: boolean }[]; langs: Set<string> }>();
  for (const r of rows) {
    const id = r.olid.value;
    const cur = by.get(id) ?? { countries: [], langs: new Set<string>() };
    if (r.iso?.value && /^[A-Z]{2}$/.test(r.iso.value) && !cur.countries.some((c) => c.iso === r.iso!.value)) {
      cur.countries.push({ iso: r.iso.value, preferred: (r.rank?.value ?? "").endsWith("PreferredRank") });
    }
    if (r.lang?.value) cur.langs.add(r.lang.value.toLowerCase());
    by.set(id, cur);
  }
  const out = new Map<string, CountryResult>();
  for (const [id, v] of by) {
    const country = (v.countries.find((c) => c.preferred) ?? v.countries[0])?.iso ?? null;
    out.set(id, { country, translated: v.langs.size ? !v.langs.has("en") : null });
  }
  return out;
}

/** Countries for up to ~40 Open Library author ids in one Wikidata query. */
export async function wikidataCountries(authorIds: string[], signal?: AbortSignal): Promise<Map<string, CountryResult>> {
  const ids = [...new Set(authorIds.filter((a) => OL_AUTHOR.test(a)))].slice(0, 40);
  if (!ids.length) return new Map();
  const query = `SELECT ?olid ?iso ?rank ?lang WHERE {
  VALUES ?olid { ${ids.map((i) => `"${i}"`).join(" ")} }
  ?a wdt:P648 ?olid .
  OPTIONAL { ?a p:P27 ?st . ?st ps:P27 ?c ; wikibase:rank ?rank . ?c wdt:P297 ?iso . }
  OPTIONAL { ?a wdt:P1412 ?l . ?l wdt:P218 ?lang . }
}`;
  const res = await fetch(`https://query.wikidata.org/sparql?${new URLSearchParams({ query, format: "json" })}`, {
    signal,
    headers: { Accept: "application/sparql-results+json" },
  });
  if (!res.ok) throw new Error("Wikidata is unavailable right now");
  const rows = ((await res.json()) as { results?: { bindings?: Row[] } }).results?.bindings ?? [];
  return pickCountries(rows);
}
