"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchShelf, type Entry } from "@/lib/data";

export function useShelf() {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setEntries(await fetchShelf());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load your shelf");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reload();
  }, [reload]);

  return { entries, error, reload, setEntries };
}
