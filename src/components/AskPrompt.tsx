"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchMyLatestPoll, pollOpen, type Entry, type PickPoll } from "@/lib/data";
import { AskSheet } from "./AskSheet";

/**
 * The way into Ask a friend: a row that opens the sheet, or, while you have a
 * poll open, a link to its votes. Hidden until you've saved two books.
 */
export function AskPrompt({ entries, finished, compact = false }: { entries: Entry[] | null; finished?: string; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [poll, setPoll] = useState<PickPoll | null | undefined>(undefined);
  useEffect(() => {
    fetchMyLatestPoll().then(setPoll).catch(() => setPoll(null));
  }, []);

  const wants = (entries ?? []).filter((e) => e.status === "want");
  if (!entries || poll === undefined || wants.length < 2) return null;

  if (poll && pollOpen(poll)) {
    return (
      <Link href={`/picks/${poll.id}`} className={`ask-row${compact ? " ask-row--compact" : ""}`}>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", fontSize: 14, fontWeight: 600 }}>Your friends are voting on what&rsquo;s next</span>
          <span className="muted" style={{ display: "block", fontSize: 13 }}>See the votes so far</span>
        </span>
        <span aria-hidden="true">→</span>
      </Link>
    );
  }

  return (
    <>
      <button type="button" className={`ask-row${compact ? " ask-row--compact" : ""}`} onClick={() => setOpen(true)}>
        <span style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
          <span style={{ display: "block", fontSize: 14, fontWeight: 600 }}>Can&rsquo;t decide what&rsquo;s next?</span>
          <span className="muted" style={{ display: "block", fontSize: 13 }}>Let your friends vote between a few</span>
        </span>
        <span className="small-btn">Ask friends</span>
      </button>
      {open && <AskSheet wants={wants} finished={finished} onClose={() => setOpen(false)} />}
    </>
  );
}
