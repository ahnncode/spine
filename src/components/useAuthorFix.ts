"use client";

import { useEffect, useRef } from "react";
import { findAppleAuthor } from "@/lib/applecovers";
import { isLatin } from "@/lib/authors";
import { setBookAuthor, type Entry } from "@/lib/data";
import { authorToCheck, lookup } from "@/lib/openlibrary";

const GAP_MS = 2500;
const PER_VISIT = 30;
const TRIED = "spine:author-tried";

function tried(): Set<string> {
  try {
    return new Set(JSON.parse(sessionStorage.getItem(TRIED) || "[]") as string[]);
  } catch {
    return new Set();
  }
}

/**
 * Books whose author is stored in another script (村上春樹) get their English
 * spelling (Haruki Murakami), looked up quietly while the shelf is open.
 */
export function useAuthorFix(entries: Entry[] | null, onFixed: () => void): void {
  const started = useRef(false);
  const alive = useRef(true);
  const fixed = useRef(onFixed);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    fixed.current = onFixed;
  }, [onFixed]);

  useEffect(() => {
    if (!entries || started.current) return;
    const done = tried();
    const todo = entries.filter((e) => e.book.author && !isLatin(e.book.author) && !done.has(e.book_id)).slice(0, PER_VISIT);
    if (!todo.length) return;
    started.current = true;

    (async () => {
      for (const e of todo) {
        if (!alive.current) return;
        done.add(e.book_id);
        try {
          sessionStorage.setItem(TRIED, JSON.stringify([...done]));
        } catch {}
        try {
          const found = await lookup(e.book.title, e.book.author);
          if (!found?.author || !isLatin(found.author)) continue;
          // An uncertain word order gets confirmed by Apple's English catalogue.
          const spellings = authorToCheck(found);
          const english = spellings ? (await findAppleAuthor(found.title, spellings).catch(() => null)) ?? found.author : found.author;
          if ((await setBookAuthor(e.book_id, english)) && alive.current) fixed.current();
        } catch {
          // Try again another visit.
        }
        await new Promise((r) => setTimeout(r, GAP_MS));
      }
    })();
  }, [entries]);
}
