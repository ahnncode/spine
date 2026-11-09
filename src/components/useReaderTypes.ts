"use client";

import { useEffect, useState } from "react";
import { fetchReaderTypes, saveMyReaderType, type StoredReaderType } from "@/lib/data";
import type { ReaderType } from "@/lib/readerType";

/**
 * Everyone's saved reader types, shared across the page: avatars all over
 * a feed ask at once, so requests are batched into one query per tick and
 * each reader is fetched once. null = no type (or not visible to you).
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const cache = new Map<string, StoredReaderType | null>();
const listeners = new Map<string, Set<() => void>>();
let queue = new Set<string>();
let timer: ReturnType<typeof setTimeout> | null = null;
let broken = false;

function notify(id: string) {
  listeners.get(id)?.forEach((fn) => fn());
}

function flush() {
  timer = null;
  const ids = [...queue];
  queue = new Set();
  if (!ids.length) return;
  fetchReaderTypes(ids)
    .then((rows) => {
      const found = new Map(rows.map((r) => [r.user_id, r]));
      for (const id of ids) {
        cache.set(id, found.get(id) ?? null);
        notify(id);
      }
    })
    .catch(() => {
      // Before the reader_types table exists (or offline): no rings, no pills, no retries.
      broken = true;
      for (const id of ids) {
        cache.set(id, null);
        notify(id);
      }
    });
}

function request(id: string) {
  if (cache.has(id) || queue.has(id) || broken) return;
  queue.add(id);
  timer ??= setTimeout(flush, 0);
}

/** A reader's saved type: undefined while loading, null when there isn't one. */
export function useReaderType(userId: string | null | undefined): StoredReaderType | null | undefined {
  const valid = Boolean(userId && UUID.test(userId));
  const [, tick] = useState(0);
  useEffect(() => {
    if (!valid || !userId) return;
    const fn = () => tick((n) => n + 1);
    let set = listeners.get(userId);
    if (!set) listeners.set(userId, (set = new Set()));
    set.add(fn);
    request(userId);
    return () => {
      set!.delete(fn);
    };
  }, [userId, valid]);
  if (!valid || !userId) return null;
  if (broken && !cache.has(userId)) return null;
  return cache.get(userId);
}

/**
 * Save your own type when it's new or has moved, so others see what you see.
 * Small wobbles (a point or two on a spectrum) aren't worth a write.
 */
export function useSyncMyReaderType(myId: string | null | undefined, type: ReaderType | null | undefined) {
  useEffect(() => {
    if (!myId || !type || broken) return;
    const next: StoredReaderType = {
      user_id: myId,
      code: type.code,
      pcts: type.axes.map((a) => a.pct),
      drive: type.drive.key,
      wing: type.wing?.key ?? null,
      book_count: type.bookCount,
    };
    const run = (prev: StoredReaderType | null | undefined) => {
      const moved =
        !prev ||
        prev.code !== next.code ||
        prev.drive !== next.drive ||
        prev.wing !== next.wing ||
        prev.book_count !== next.book_count ||
        next.pcts.some((p, i) => Math.abs(p - (prev.pcts[i] ?? 50)) >= 3);
      if (!moved) return;
      cache.set(myId, next);
      notify(myId);
      saveMyReaderType(next).catch(() => {});
    };
    if (cache.has(myId)) run(cache.get(myId));
    else fetchReaderTypes([myId]).then((r) => run(r[0] ?? null)).catch(() => { broken = true; });
  }, [myId, type]);
}
