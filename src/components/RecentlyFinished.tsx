"use client";

import Link from "next/link";
import { isListened, type RankedEntry } from "@/lib/data";
import { rankedInApp } from "@/lib/stats";
import { Cover } from "./Cover";
import { ScoreChip } from "./ScoreChip";

const SHOW = 8;

/** When a ranked book was finished: its finish date, else when it was ranked here. */
function finishedAt(e: RankedEntry): string | null {
  if (e.finished_on) return `${e.finished_on}T12:00:00`;
  return e.ranked_at && rankedInApp(e) ? e.ranked_at : null;
}

function short(iso: string): string {
  const d = new Date(iso);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", ...(sameYear ? {} : { year: "numeric" }) });
}

/**
 * The latest books someone finished, newest first, each with its score. Used
 * on your own profile and on other readers'.
 */
export function RecentlyFinished({ ranked, mine = false }: { ranked: RankedEntry[]; mine?: boolean }) {
  const recent = ranked
    .map((e) => ({ e, at: finishedAt(e) }))
    .filter((x): x is { e: RankedEntry; at: string } => x.at != null)
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, SHOW);
  if (!recent.length) return null;
  return (
    <section aria-label="Recently finished" style={{ marginTop: mine ? 32 : 20 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <h2 className={mine ? "section-title" : "h2"} style={{ margin: 0 }}>Recently finished</h2>
        {mine && <Link href="/shelf" style={{ fontSize: 13, fontWeight: 600, minHeight: 32, display: "inline-flex", alignItems: "center" }}>See all</Link>}
      </div>
      <div className="reading-strip recent-strip" style={{ marginTop: 10 }}>
        {recent.map(({ e, at }) => (
          <Link key={e.id} href={`/book/${e.book_id}`} className="recent-card" aria-label={`${e.book.title}, ${e.score.toFixed(1)}, finished ${short(at)}`}>
            <span className="recent-card__cover">
              <Cover book={e.book} width={72} listened={isListened(e.format)} />
              <span className="recent-card__score"><ScoreChip score={e.score} bucket={e.bucket} size={30} /></span>
            </span>
            <span className="recent-card__title">{e.book.title}</span>
            <span className="m muted" style={{ fontSize: 12 }}>{short(at)}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
