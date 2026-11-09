"use client";

import { useEffect, useMemo, useState } from "react";
import { useProfile } from "@/components/Auth";
import { useShelf } from "@/components/useShelf";
import { useSyncMyReaderType } from "@/components/useReaderTypes";
import { fetchAbandonedCount, rankEntries, today } from "@/lib/data";
import { buildReaderType, readerInputFromShelf } from "@/lib/readerType";

/**
 * Keeps your saved reader type current from any main screen, not only You,
 * so friends see it on your profile as soon as you've opened the app.
 * Renders nothing; works out the type exactly as the You screen does.
 */
export function ReaderTypeSync() {
  const { profile } = useProfile();
  const { entries } = useShelf();
  const [abandoned, setAbandoned] = useState<number | null | undefined>(undefined);
  useEffect(() => {
    if (!profile?.id) return;
    fetchAbandonedCount().then(setAbandoned).catch(() => setAbandoned(null));
  }, [profile?.id]);
  const type = useMemo(() => {
    if (!entries || abandoned === undefined) return undefined;
    return buildReaderType(readerInputFromShelf(rankEntries(entries), entries, abandoned, today()));
  }, [entries, abandoned]);
  useSyncMyReaderType(profile?.id, type);
  return null;
}
