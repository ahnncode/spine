import Link from "next/link";
import type { ReactNode } from "react";
import type { Entry } from "@/lib/data";
import { Cover } from "./Cover";

/** One compact "Reading now" card: cover beside title, a bar, check in. Same on You and Shelf. */
export function ReadingCard({ entry: e, extra, onCheckIn }: { entry: Entry; extra?: ReactNode; onCheckIn: () => void }) {
  return (
    <div className="reading-card reading-card--row">
      <Link href={`/book/${e.book_id}`} aria-label={`${e.book.title}: book page`} style={{ flexShrink: 0 }}>
        <Cover book={e.book} width={56} />
      </Link>
      <div className="reading-card__main">
        <Link href={`/book/${e.book_id}`} className="reading-card__title" style={{ color: "inherit", textDecoration: "none", minHeight: 0 }}>{e.book.title}</Link>
        {extra}
        <div style={{ marginTop: "auto" }} aria-label={e.progress_pct != null ? `${e.progress_pct}% read` : "Not checked in yet"}>
          <div className="reading-card__bar"><span style={{ width: `${e.progress_pct ?? 0}%` }} /></div>
          <div className="m muted" style={{ fontSize: 12, marginTop: 4 }}>{e.progress_pct != null ? `${e.progress_pct}%` : "Just started"}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button className="small-btn" style={{ minHeight: 34, padding: "0 12px", fontSize: 13 }} onClick={onCheckIn}>Check in</button>
          <Link href={`/rank/${e.book_id}`} style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-2)", whiteSpace: "nowrap" }}>Rank it</Link>
        </div>
      </div>
    </div>
  );
}
