"use client";

import { useEffect, useRef, useState } from "react";
import { enrichBook, type Entry } from "@/lib/data";
import { lookup } from "@/lib/openlibrary";

const PER_VISIT = 250;
/** Open Library asks clients to go gently; faster than this starts failing. */
const GAP_MS = 600;
/** Refresh the page every this many filled-in books, so progress shows. */
const REFRESH_EVERY = 20;
const RETRY_AFTER_MS = 4000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Imported books arrive without covers or genres. While someone looks at
 * their shelf, quietly fill them in from Open Library, then refresh.
 *
 * A book that still can't be looked up after a retry is marked as done with
 * no genre, so it shows in "pick a genre" instead of looking stuck.
 * Returns whether lookups are running right now.
 */
export function useEnrichment(entries: Entry[] | null, onDone: () => void): { active: boolean } {
  const started = useRef(false);
  const alive = useRef(true);
  const done = useRef(onDone);
  const [active, setActive] = useState(false);

  // Stop only when the page goes away — not when a refresh hands us new entries.
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
    const todo = entries.filter((e) => !e.book.enriched).slice(0, PER_VISIT);
    if (!todo.length) return;
    started.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActive(true);

    (async () => {
      let changed = 0;
      const note = () => {
        changed++;
        if (changed % REFRESH_EVERY === 0 && alive.current) done.current();
      };

      async function attempt(e: Entry, last: boolean): Promise<boolean> {
        try {
          const found = await lookup(e.book.title, e.book.author);
          // Mark as enriched even when nothing matched, so we don't retry forever.
          await enrichBook(e.book_id, found ?? { title: e.book.title, author: e.book.author });
          note();
          return true;
        } catch {
          if (!last) return false;
          // Give up on the catalogue for this one; it moves to "pick a genre".
          try {
            await enrichBook(e.book_id, { title: e.book.title, author: e.book.author });
            note();
          } catch {}
          return true;
        }
      }

      const failed: Entry[] = [];
      for (const e of todo) {
        if (!alive.current) return;
        if (!(await attempt(e, false))) failed.push(e);
        await sleep(GAP_MS);
      }
      if (failed.length && alive.current) {
        await sleep(RETRY_AFTER_MS);
        for (const e of failed) {
          if (!alive.current) return;
          await attempt(e, true);
          await sleep(GAP_MS * 2);
        }
      }
      if (!alive.current) return;
      setActive(false);
      if (changed % REFRESH_EVERY) done.current();
    })();
  }, [entries]);

  return { active };
}
