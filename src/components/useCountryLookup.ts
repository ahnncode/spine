"use client";

import { useEffect, useRef } from "react";
import { setBookCountry, type Entry } from "@/lib/data";
import { openLibraryAuthor, wikidataCountries } from "@/lib/countryLookup";

const PER_VISIT = 120;
const BATCH = 20;
/** Open Library asks clients to go gently. */
const GAP_MS = 600;
/** Try a book again this long after a lookup found nothing. */
const RETRY_DAYS = 30;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function needsLookup(e: Entry): boolean {
  if (e.status !== "ranked" && e.status !== "unsorted") return false;
  if (e.book.author_country) return false;
  const at = e.book.country_checked_at ? Date.parse(e.book.country_checked_at) : 0;
  return !at || Date.now() - at > RETRY_DAYS * 86400000;
}

/**
 * Fill in where authors are from for the books you've read, a batch at a time,
 * while you're on the page. Calls onDone when there's something new to show.
 */
export function useCountryLookup(entries: Entry[] | null, onDone: () => void): void {
  const started = useRef(false);
  const alive = useRef(true);
  const done = useRef(onDone);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    done.current = onDone;
  }, [onDone]);

  useEffect(() => {
    if (!entries || started.current) return;
    // Wait for the genre lookup to fill in work keys first; this runs on the next visit.
    const todo = entries.filter((e) => e.book.enriched && needsLookup(e)).slice(0, PER_VISIT);
    if (!todo.length) return;
    started.current = true;

    (async () => {
      let found = 0;
      for (let i = 0; i < todo.length; i += BATCH) {
        const batch = todo.slice(i, i + BATCH);
        const authors = new Map<string, string | null>();
        for (const e of batch) {
          if (!alive.current) return;
          authors.set(e.book_id, await openLibraryAuthor(e.book));
          await sleep(GAP_MS);
        }
        let results;
        try {
          results = await wikidataCountries([...authors.values()].filter((a): a is string => !!a));
        } catch {
          return; // Wikidata is down or busy: try again next visit
        }
        for (const e of batch) {
          if (!alive.current) return;
          const a = authors.get(e.book_id);
          const r = a ? results.get(a) : undefined;
          try {
            await setBookCountry(e.book_id, r?.country ?? null, r?.translated ?? null);
            if (r?.country) found++;
          } catch {}
        }
        if (found && alive.current) done.current();
      }
    })();
  }, [entries]);
}
