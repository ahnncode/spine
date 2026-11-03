"use client";

import { useEffect, useState } from "react";
import { fetchMyReadAlongs, fetchProfiles, type Profile, type ReadAlong } from "@/lib/data";

interface State {
  list: ReadAlong[];
  people: Map<string, Profile>;
}

// Shared across pages for a minute, so Reading now cards don't each refetch.
let cache: { at: number; value: Promise<State> } | null = null;

function load(force = false): Promise<State> {
  if (!force && cache && Date.now() - cache.at < 60_000) return cache.value;
  const value = fetchMyReadAlongs()
    .then(async (list) => {
      const ids = [...new Set(list.flatMap((r) => r.members.map((m) => m.user_id)))];
      return { list, people: await fetchProfiles(ids) };
    })
    .catch(() => ({ list: [], people: new Map<string, Profile>() }));
  cache = { at: Date.now(), value };
  return value;
}

/** Your read-alongs (joined or invited) and the people in them. */
export function useReadAlongs(): State & { reload: () => void } {
  const [state, setState] = useState<State>({ list: [], people: new Map() });
  useEffect(() => {
    let live = true;
    load().then((s) => live && setState(s));
    return () => {
      live = false;
    };
  }, []);
  return { ...state, reload: () => void load(true).then(setState) };
}

/** Your active read-along for a book, if any. */
export function activeFor(list: ReadAlong[], bookId: string, me: string | undefined): ReadAlong | undefined {
  return list.find((r) => r.book_id === bookId && !r.revealed_at && r.members.some((m) => m.user_id === me && m.state === "joined"));
}
