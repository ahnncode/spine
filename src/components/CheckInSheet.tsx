"use client";

import { useMentionPicker } from "@/components/Mentions";
import Link from "next/link";
import { useState } from "react";
import { checkIn, type Entry } from "@/lib/data";
import { CHECKIN_NOTE_MAX, VIBES } from "@/lib/thoughts";
import { Cover } from "./Cover";

/**
 * Check in on a book you're reading. Progress is optional: by page when we
 * know the page count, otherwise by percent.
 */
export function CheckInSheet({ entry, onClose, onDone }: { entry: Entry; onClose: () => void; onDone: () => void | Promise<void> }) {
  const pages = entry.book.pages ?? null;
  const start = entry.progress_pct ?? 0;
  const [pct, setPct] = useState<number>(start);
  const [page, setPage] = useState<string>(pages && entry.progress_pct != null ? String(Math.round((entry.progress_pct / 100) * pages)) : "");
  const [touched, setTouched] = useState(false);
  const [note, setNote] = useState("");
  const mention = useMentionPicker<HTMLInputElement>(note, setNote);
  const [vibe, setVibe] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const today = new Date();
  const doneToday =
    entry.last_checkin_on ===
    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  function fromPage(v: string) {
    const clean = v.replace(/\D/g, "").slice(0, 5);
    setPage(clean);
    setTouched(true);
    const n = parseInt(clean, 10);
    if (pages && Number.isFinite(n)) setPct(Math.max(0, Math.min(100, Math.round((n / pages) * 100))));
  }

  async function save(withProgress: boolean) {
    setBusy(true);
    setError(null);
    try {
      await checkIn(entry.book_id, withProgress ? pct : null, { note, vibe });
      await onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn’t check in");
      setBusy(false);
    }
  }

  return (
    <div className="sheet-backdrop" onClick={() => !busy && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={`Check in on ${entry.book.title}`} onClick={(e) => e.stopPropagation()}>
        <div className="sheet__grab" />
        <div style={{ display: "flex", gap: 16, alignItems: "flex-end" }}>
          <Cover book={entry.book} width={72} />
          <div style={{ minWidth: 0 }}>
            <p className="eyebrow">{doneToday ? "Checked in today" : "Reading check-in"}</p>
            <h2 className="d" style={{ margin: "4px 0 0", fontSize: 22, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.05 }}>{entry.book.title}</h2>
          </div>
        </div>

        <div style={{ marginTop: 22 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <label htmlFor="progress" style={{ fontWeight: 600, fontSize: 14 }}>How far are you?</label>
            <span className="d" style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.03em" }}>{pct}%</span>
          </div>
          <input
            id="progress"
            type="range"
            min={0}
            max={100}
            step={1}
            value={pct}
            onChange={(e) => { setPct(Number(e.target.value)); setTouched(true); if (pages) setPage(String(Math.round((Number(e.target.value) / 100) * pages))); }}
            style={{ width: "100%", marginTop: 10, accentColor: "var(--accent)", height: 32 }}
          />
          {pages && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, fontSize: 14 }}>
              <label htmlFor="page" className="muted">Page</label>
              <input id="page" className="input" inputMode="numeric" style={{ width: 90, height: 44 }} value={page} onChange={(e) => fromPage(e.target.value)} />
              <span className="muted">of {pages}</span>
            </div>
          )}
        </div>

        <div className="tag-list" role="group" aria-label="How’s it going?" style={{ marginTop: 18 }}>
          {VIBES.map((v) => (
            <button key={v.key} type="button" className="tag-chip" aria-pressed={vibe === v.key} onClick={() => setVibe(vibe === v.key ? null : v.key)}>
              {v.label}
            </button>
          ))}
        </div>
        <label htmlFor="checkin-note" className="visually-hidden">A quick thought</label>
        <input
          id="checkin-note"
          className="input"
          style={{ width: "100%", marginTop: 10 }}
          placeholder="A quick thought (optional) · @ to mention"
          maxLength={CHECKIN_NOTE_MAX}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          {...mention.fieldProps}
        />
        {mention.picker}

        {error && <p className="error" role="alert">{error}</p>}
        <div className="stack" style={{ marginTop: 20 }}>
          <button className="btn btn--block" disabled={busy} onClick={() => save(touched || entry.progress_pct != null)}>
            {busy ? "Saving…" : doneToday ? "Update progress" : "Check in"}
          </button>
          {pct >= 100 ? (
            <Link href={`/rank/${entry.book_id}`} className="btn btn--outline btn--block">Finished — rank it</Link>
          ) : (
            <button className="btn btn--quiet btn--block" disabled={busy || (doneToday && !note.trim() && !vibe)} onClick={() => save(false)}>
              Just read a bit, skip progress
            </button>
          )}
        </div>
        <p className="muted" style={{ fontSize: 13, textAlign: "center", margin: "12px 0 0" }}>
          A check-in any day keeps this week&rsquo;s streak going.
        </p>
      </div>
    </div>
  );
}
