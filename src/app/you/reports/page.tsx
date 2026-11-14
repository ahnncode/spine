"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/Auth";
import { BackIcon } from "@/components/icons";
import { RowsSkeleton } from "@/components/Skeleton";
import { adminReports, resolveReport, type OpenReport, type ReportTarget } from "@/lib/data";
import { timeAgo } from "@/lib/time";

export default function Page() {
  return (
    <RequireAuth>
      <ReportsPage />
    </RequireAuth>
  );
}

const KIND: Record<ReportTarget, string> = {
  comment: "Comment on a ranking",
  chapter_comment: "Chapter room comment",
  club_comment: "Club comment",
  club: "Club name or description",
  entry: "Thoughts on a ranking",
  checkin: "Check-in note",
  profile: "Profile",
};

const REMOVE: Record<ReportTarget, string> = {
  comment: "Delete comment",
  chapter_comment: "Delete comment",
  club_comment: "Delete comment",
  club: "Delete the club",
  entry: "Clear their thoughts",
  checkin: "Clear the note",
  profile: "Clear their bio",
};

function ReportsPage() {
  const [items, setItems] = useState<OpenReport[] | null>(null);
  const [denied, setDenied] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminReports().then(setItems).catch(() => setDenied(true));
  }, []);

  async function act(r: OpenReport, action: "dismiss" | "remove") {
    const key = `${r.target_type}:${r.target_id}`;
    setBusy(key);
    setError(null);
    try {
      await resolveReport(r.target_type, r.target_id, action);
      setItems((list) => (list ?? []).filter((x) => `${x.target_type}:${x.target_id}` !== key));
    } catch {
      setError("That didn’t go through. Try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="app">
      <main className="screen screen--flow" style={{ paddingTop: 12 }}>
        <Link href="/you" className="icon-btn" aria-label="Back"><BackIcon size={20} /></Link>
        <h1 className="h1" style={{ marginTop: 12 }}>Reports</h1>

        {denied ? (
          <p className="lede">This page is only for moderators.</p>
        ) : items === null ? (
          <RowsSkeleton count={3} />
        ) : items.length === 0 ? (
          <p className="lede">Nothing waiting. When someone flags a comment or profile, it shows up here.</p>
        ) : (
          <>
            <p className="lede">{items.length === 1 ? "One thing" : `${items.length} things`} flagged. Keep it if it&rsquo;s fine; take it down if it breaks the rules.</p>
            {error && <p className="error" role="alert" style={{ marginTop: 12 }}>{error}</p>}
            <ul className="report-list">
              {items.map((r) => {
                const key = `${r.target_type}:${r.target_id}`;
                return (
                  <li key={key} className="report-row">
                    <div className="muted" style={{ fontSize: 13 }}>
                      {KIND[r.target_type]} by{" "}
                      {r.author_username ? <Link href={`/u/${r.author_username}`}>{r.author_name || `@${r.author_username}`}</Link> : (r.author_name ?? "someone who left")}
                      {r.author_reports > 1 ? `, who has ${r.author_reports} things flagged` : ""}
                    </div>
                    <blockquote className="report-row__body">{r.body?.trim() || <span className="muted">Already gone or empty.</span>}</blockquote>
                    <div style={{ fontSize: 13 }}>
                      <strong>{r.reports === 1 ? "1 report" : `${r.reports} reports`}</strong>
                      <span className="muted">, latest {timeAgo(r.last_at)}</span>
                      {r.reasons.length > 0 && <span className="muted">. &ldquo;{r.reasons.join("”, “")}&rdquo;</span>}
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                      <button className="small-btn" style={{ background: "var(--error)", color: "var(--on-ink)" }} disabled={busy === key} onClick={() => act(r, "remove")}>{REMOVE[r.target_type]}</button>
                      <button className="small-btn small-btn--outline" disabled={busy === key} onClick={() => act(r, "dismiss")}>Keep it</button>
                      {r.link && <Link href={r.link} className="link-btn" style={{ fontSize: 13, alignSelf: "center", padding: "10px 4px" }}>See it in place</Link>}
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </main>
    </div>
  );
}
