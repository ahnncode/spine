"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { RequireAuth } from "@/components/Auth";
import { Cover } from "@/components/Cover";
import { BackIcon } from "@/components/icons";
import { fetchShelf, quickRate, restoreEntry, type Entry } from "@/lib/data";
import { bucketForScore, formatScore } from "@/lib/ranking";

export default function Page() {
  return (
    <RequireAuth>
      <QuickRate />
    </RequireAuth>
  );
}

/**
 * Rate a backlog fast: one book at a time, tap a number out of 10, next.
 * Each lands at that score, below anything scored higher, and stays flagged
 * so the daily head-to-head and Sharpen can fine-tune it. Backlog ratings
 * don't post to friends' feeds.
 */
function QuickRate() {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [half, setHalf] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [last, setLast] = useState<{ before: Entry; score: number } | null>(null);
  const [rated, setRated] = useState(0);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    fetchShelf()
      .then((e) => {
        setEntries(e);
        setTotal(e.filter((x) => x.status === "unsorted").length);
      })
      .catch(() => setError("Couldn’t load your shelf. Pull to refresh and try again."));
  }, []);

  const queue = useMemo(() => (entries ?? []).filter((e) => e.status === "unsorted" && !skipped.has(e.id)), [entries, skipped]);
  const book = queue[0] ?? null;

  async function rate(n: number) {
    if (!entries || !book || busy) return;
    const score = half ? Math.min(10, n + 0.5) : n;
    setBusy(true);
    setError(null);
    try {
      const r = await quickRate({ entries, bookId: book.book_id, score, existing: book, quiet: true });
      const placed: Entry = { ...book, status: "ranked", bucket: r.bucket, sort_key: r.sortKey, manual_score: score, needs_sort: true };
      setLast({ before: book, score });
      setRated((x) => x + 1);
      setHalf(false);
      if (r.renumbered) setEntries(await fetchShelf());
      else setEntries(entries.map((e) => (e.id === book.id ? placed : e)));
    } catch {
      setError("That didn’t save. Tap the score again.");
    } finally {
      setBusy(false);
    }
  }

  async function undo() {
    if (!last || busy) return;
    setBusy(true);
    try {
      await restoreEntry(last.before);
      setEntries((list) => (list ?? []).map((e) => (e.id === last.before.id ? last.before : e)));
      setRated((x) => Math.max(0, x - 1));
      setLast(null);
    } catch {
      setError("Couldn’t undo that one. You can fix it from your shelf.");
    } finally {
      setBusy(false);
    }
  }

  const done = total - queue.length;

  return (
    <div className="app">
      <main className="screen screen--flow">
        <div className="topbar">
          <Link href="/shelf" className="icon-btn" aria-label="Back to your shelf"><BackIcon size={20} /></Link>
          {total > 0 && <span className="m muted" style={{ fontSize: 13 }}>{Math.min(done + 1, total)} of {total}</span>}
          <span style={{ width: 44 }} />
        </div>
        {total > 0 && (
          <div className="bar" style={{ marginTop: 12 }} aria-hidden="true">
            <span style={{ width: `${(done / total) * 100}%`, background: "var(--accent)" }} />
          </div>
        )}

        {entries === null ? (
          <div aria-busy="true" className="spacer" />
        ) : !book ? (
          <div style={{ marginTop: 32 }}>
            <h1 className="h1">{rated ? "That’s the lot" : "Nothing to rate"}</h1>
            <p className="lede">
              {rated
                ? `${rated} book${rated === 1 ? "" : "s"} rated and on your ranking. Each day we’ll ask you to settle one or two that sit close together, so the order gets sharper without a marathon.`
                : "Everything you’ve read is already ranked."}
              {skipped.size > 0 && ` You skipped ${skipped.size}; they’re still in “To rank”.`}
            </p>
            <div className="spacer" style={{ minHeight: 24 }} />
            <Link href="/shelf" className="btn btn--block">See your ranking</Link>
            {rated > 0 && <Link href="/sharpen" className="btn btn--ghost btn--block" style={{ marginTop: 8 }}>Fine-tune some now</Link>}
          </div>
        ) : (
          <>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 20 }}>
              <Cover book={book.book} width={140} />
              <h1 className="h1" style={{ fontSize: 26, marginTop: 18, textAlign: "center" }}>{book.book.title}</h1>
              <p className="muted" style={{ margin: "4px 0 0", fontSize: 15 }}>{book.book.author}</p>
            </div>

            <p className="h2" style={{ marginTop: 24 }}>What would you give it?</p>
            <div className="quick-grid" role="group" aria-label="Score out of 10">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => {
                const s = half ? Math.min(10, n + 0.5) : n;
                const tier = bucketForScore(s);
                const off = half && n === 10;
                return (
                  <button
                    key={n}
                    type="button"
                    className="quick-grid__n"
                    data-tier={tier}
                    disabled={busy || off}
                    onClick={() => rate(n)}
                    aria-label={`${formatScore(s)} out of 10`}
                  >
                    {off ? "–" : formatScore(s)}
                  </button>
                );
              })}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
              <button type="button" className="tag-chip" aria-pressed={half} onClick={() => setHalf((h) => !h)}>Add a half</button>
              <button type="button" className="btn btn--ghost" style={{ minHeight: 44 }} disabled={busy} onClick={() => setSkipped((s) => new Set(s).add(book.id))}>
                Skip for now
              </button>
            </div>
            {error && <p className="error" role="alert" style={{ marginTop: 12 }}>{error}</p>}
            {last && (
              <p className="muted" style={{ marginTop: 16, fontSize: 14 }} aria-live="polite">
                {last.before.book.title} went in at {formatScore(last.score)}.{" "}
                <button type="button" className="link-btn" style={{ padding: "10px 2px" }} onClick={undo} disabled={busy}>Undo</button>
              </p>
            )}
          </>
        )}
      </main>
    </div>
  );
}
