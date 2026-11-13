"use client";

import { useMemo, useState } from "react";
import { countHeadToHeads, logMatchup, rankEntries, recordMatchup, today, type Entry, type RankedEntry } from "@/lib/data";
import { applyMatchup, nextPair } from "@/lib/sharpen";
import { Cover } from "./Cover";

const PER_DAY = 2;
const KEY = "readread:close-call";

function readDone(): number {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "null") as { day: string; n: number } | null;
    return v && v.day === today() ? v.n : 0;
  } catch {
    return 0;
  }
}
function writeDone(n: number) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ day: today(), n }));
  } catch {
    /* private window: fine, it just may ask again */
  }
}

/**
 * Today's close call: one or two matchups between neighbouring books on your
 * own shelf that are still roughly placed (imports, quick ratings). A few
 * seconds a day, and a big backlog sorts itself out over time.
 */
export function DailyCloseCall({ entries, setEntries }: { entries: Entry[] | null; setEntries: (e: Entry[]) => void }) {
  const [done, setDone] = useState(() => (typeof window === "undefined" ? 0 : readDone()));
  const [lastKey, setLastKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [thanks, setThanks] = useState(false);

  const ranked = useMemo(() => rankEntries(entries ?? []), [entries]);
  const rough = ranked.filter((e) => e.needs_sort).length;
  // Fixed for this render cycle so the pair doesn't reshuffle while you look at it.
  const pair = useMemo(() => (done < PER_DAY ? nextPair(ranked, lastKey) : null), [ranked, lastKey, done]);

  if (!entries) return null;
  if (thanks && !pair) {
    return (
      <p className="close-call__done" aria-live="polite">
        Settled for today. {rough > 0 ? `${rough} book${rough === 1 ? "" : "s"} still roughly placed; more tomorrow.` : "Your ranking is all yours now."}
      </p>
    );
  }
  if (!pair) return null;

  async function choose(winner: RankedEntry, loser: RankedEntry) {
    if (!entries || saving) return;
    setSaving(true);
    try {
      await recordMatchup(winner, loser);
      countHeadToHeads(1);
      logMatchup(winner.book_id, loser.book_id, { context: "sharpen" });
      const n = done + 1;
      writeDone(n);
      setDone(n);
      setLastKey(`${winner.id}:${loser.id}`);
      setThanks(true);
      setEntries(applyMatchup(entries, winner, loser));
    } catch {
      /* leave the pair up; they can tap again */
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="close-call" aria-label="Today's close call">
      <p className="close-call__q">
        <strong>Today&rsquo;s close call.</strong> <span className="muted">Which did you like more?</span>
        {done > 0 && <span className="muted"> One more.</span>}
      </p>
      <div className="close-call__pair">
        {pair.map((e, i) => (
          <button key={e.id} type="button" className="close-call__book" disabled={saving} onClick={() => choose(e, pair[1 - i])}>
            <Cover book={e.book} width={44} />
            <span className="close-call__title">{e.book.title}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
