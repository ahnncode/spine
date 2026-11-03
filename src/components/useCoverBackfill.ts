"use client";

import { useEffect, useRef } from "react";
import { findAppleCover } from "@/lib/applecovers";
import { setBookCover, type Entry } from "@/lib/data";

/** Apple allows about 20 lookups a minute. */
const GAP_MS = 3200;
const PER_VISIT = 60;
const REFRESH_EVERY = 1;

/**
 * Books Open Library has no picture for get a one-time look in Apple's book
 * catalogue. Runs quietly while the page is open; covers appear as found.
 */
export function useCoverBackfill(entries: Entry[] | null, onFound: () => void): void {
  const started = useRef(false);
  const alive = useRef(true);
  const found = useRef(onFound);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    found.current = onFound;
  }, [onFound]);

  useEffect(() => {
    if (!entries || started.current) return;
    // Wait for Open Library lookups to finish first; they may find a cover.
    const todo = entries
      .filter((e) => e.book.enriched && !e.book.cover_id && !e.book.cover_url && !e.book.cover_checked)
      .slice(0, PER_VISIT);
    if (!todo.length) return;
    started.current = true;

    (async () => {
      let hits = 0;
      for (const e of todo) {
        if (!alive.current) return;
        try {
          const url = await findAppleCover(e.book.title, e.book.author);
          await setBookCover(e.book_id, url);
          if (url && ++hits % REFRESH_EVERY === 0 && alive.current) found.current();
        } catch {
          // Rate limited or offline: try again another visit.
        }
        await new Promise((r) => setTimeout(r, GAP_MS));
      }
      if (alive.current && hits % REFRESH_EVERY) found.current();
    })();
  }, [entries]);
}
