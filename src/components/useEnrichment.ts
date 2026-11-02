"use client";

import { useEffect, useRef } from "react";
import { enrichBook, type Entry } from "@/lib/data";
import { lookup } from "@/lib/openlibrary";

const PER_VISIT = 40;
const GAP_MS = 350;

/**
 * Imported books arrive without covers or genres. While someone looks at
 * their shelf, quietly fill a batch in from Open Library, then refresh.
 */
export function useEnrichment(entries: Entry[] | null, onDone: () => void) {
  const started = useRef(false);

  useEffect(() => {
    if (!entries || started.current) return;
    const todo = entries.filter((e) => !e.book.enriched).slice(0, PER_VISIT);
    if (!todo.length) return;
    started.current = true;
    let cancelled = false;

    (async () => {
      let changed = 0;
      for (const e of todo) {
        if (cancelled) return;
        try {
          const found = await lookup(e.book.title, e.book.author);
          // Mark as enriched even when nothing matched, so we don't retry forever.
          await enrichBook(e.book_id, found ?? { title: e.book.title, author: e.book.author });
          if (found?.cover_id || found?.genres?.length) changed++;
        } catch {
          // Network hiccup: leave it for next visit.
        }
        await new Promise((r) => setTimeout(r, GAP_MS));
      }
      if (!cancelled && changed) onDone();
    })();

    return () => {
      cancelled = true;
    };
  }, [entries, onDone]);
}
