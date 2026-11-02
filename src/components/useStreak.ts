"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchCheckinDays, type Entry } from "@/lib/data";
import { activityDates, weeklyStreak } from "@/lib/stats";

/** Weekly reading streak from check-ins, starts and rankings. */
export function useStreak(entries: Entry[] | null) {
  const [days, setDays] = useState<string[]>([]);

  const reloadCheckins = useCallback(async () => {
    try {
      setDays(await fetchCheckinDays());
    } catch {
      /* streak just shows without check-ins */
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reloadCheckins();
  }, [reloadCheckins]);

  const streak = useMemo(() => weeklyStreak(activityDates(entries || [], days)), [entries, days]);
  return { streak, reloadCheckins };
}
