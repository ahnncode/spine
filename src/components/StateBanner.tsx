"use client";

import Link from "next/link";
import { useState } from "react";
import type { Entry } from "@/lib/data";
import { progressLabel } from "@/lib/progress";
import { STOP_REASON_LABEL } from "@/lib/stopReasons";
import { ResumeSheet, StopSheet } from "./StopSheet";

function day(iso: string): string {
  const d = new Date(iso);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", ...(sameYear ? {} : { year: "numeric" }) });
}

/**
 * The book page's banner for a book you put aside or didn't finish: where you
 * stopped, why, and what you can do next.
 */
export function StateBanner({ entry, onChange }: { entry: Entry; onChange: () => void | Promise<void> }) {
  const [sheet, setSheet] = useState<"resume" | "drop" | null>(null);
  const paused = entry.status === "paused";
  const p = progressLabel(entry);
  const why = entry.stop_reason ? STOP_REASON_LABEL[entry.stop_reason] : null;
  const done = async () => {
    setSheet(null);
    await onChange();
  };

  return (
    <section className={`state-banner state-banner--${paused ? "paused" : "dropped"}`} aria-label={paused ? "Put aside" : "Didn’t finish"}>
      <span className="state-banner__eyebrow" style={{ color: paused ? "var(--amber-ink)" : "var(--muted)" }}>
        {paused ? "Put aside" : "Didn’t finish"}
        {entry.stopped_at ? ` · ${day(entry.stopped_at)}` : ""}
      </span>
      {paused && entry.progress_pct != null && (
        <span className="reading-card__bar" aria-hidden="true"><span style={{ width: `${entry.progress_pct}%` }} /></span>
      )}
      <p style={{ margin: 0, fontSize: 15, lineHeight: 1.45 }}>
        <strong>{p && p !== "Not started" ? `${paused ? "" : "Got to "}${paused ? p : p.replace(/^Chapter/, "chapter")}.` : paused ? "Saved where you were." : "Stopped early."}</strong>
        {why ? ` ${why}.` : ""}
        {entry.stop_note && (
          <span style={{ display: "block", marginTop: 4, opacity: 0.85 }}>&ldquo;{entry.stop_note}&rdquo;</span>
        )}
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button className="btn" style={{ flex: 1 }} onClick={() => setSheet("resume")}>{paused ? "Pick back up" : "Try again"}</button>
        {paused ? (
          <button className="btn btn--outline" onClick={() => setSheet("drop")}>Drop it</button>
        ) : (
          <Link href={`/rank/${entry.book_id}`} className="btn btn--outline" style={{ flex: 1 }}>Rank it anyway</Link>
        )}
      </div>
      {paused && <p style={{ margin: 0, fontSize: 13, opacity: 0.8 }}>Only you see the reason and note.</p>}
      {sheet === "resume" && <ResumeSheet entry={entry} onClose={() => setSheet(null)} onDone={done} />}
      {sheet === "drop" && <StopSheet entry={entry} mode="drop" onClose={() => setSheet(null)} onDone={done} />}
    </section>
  );
}
