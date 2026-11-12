"use client";

import Link from "next/link";
import { useState } from "react";
import { useMentionPicker } from "@/components/Mentions";
import { dropBook, pauseBook, resumeBook, type Entry } from "@/lib/data";
import { progressLabel } from "@/lib/progress";
import { DROP_REASONS, PAUSE_REASONS, STOP_NOTE_MAX, STOP_REASON_LABEL } from "@/lib/stopReasons";
import { Cover } from "./Cover";

function where(entry: Entry): string {
  const p = progressLabel(entry);
  if (!p) return "where you are";
  return p.startsWith("Chapter") ? p.replace("Chapter", "chapter") : `${p} through`;
}

/**
 * Put a book aside (paused, meaning to come back) or drop it (didn't finish).
 * Progress is kept either way. A pause is private and never posts; a drop can
 * post to the feed, with an optional reason and note.
 */
export function StopSheet({
  entry,
  mode: initialMode,
  onClose,
  onDone,
}: {
  entry: Entry;
  mode: "pause" | "drop";
  onClose: () => void;
  onDone: () => void | Promise<void>;
}) {
  const [mode, setMode] = useState(initialMode);
  const [reason, setReason] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const mention = useMentionPicker<HTMLTextAreaElement>(note, setNote);
  const [spoiler, setSpoiler] = useState(false);
  const [shared, setShared] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reasons = mode === "pause" ? PAUSE_REASONS : DROP_REASONS;
  const at = where(entry);

  function switchMode(m: "pause" | "drop") {
    setMode(m);
    setReason(null);
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      if (mode === "pause") await pauseBook(entry.id, { reason, note });
      else await dropBook(entry.id, { reason, note, spoiler, shared });
      await onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn’t save that");
      setBusy(false);
    }
  }

  return (
    <div className="sheet-backdrop" onClick={() => !busy && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={mode === "pause" ? `Put ${entry.book.title} aside` : `Didn’t finish ${entry.book.title}`} onClick={(e) => e.stopPropagation()}>
        <div className="sheet__grab" />
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <Cover book={entry.book} width={48} />
          <div style={{ minWidth: 0 }}>
            <p className="eyebrow" style={{ color: mode === "pause" ? "var(--amber-ink)" : undefined }}>{mode === "pause" ? "Put aside" : "Didn’t finish"}</p>
            <h2 className="g" style={{ margin: "4px 0 0", fontSize: 24, lineHeight: 1.1, fontWeight: 400 }}>
              {mode === "pause" ? `Taking a break from ${entry.book.title}` : `Done with ${entry.book.title}?`}
            </h2>
          </div>
        </div>

        {mode === "pause" ? (
          <p className="stop-saved">
            <strong>Saved at {at}.</strong> Pick it back up any time and carry on from there.
          </p>
        ) : (
          <p style={{ margin: "14px 0 0", fontSize: 15, lineHeight: 1.45, color: "var(--ink-2)" }}>
            You got to {at}. That&rsquo;s kept, and it won&rsquo;t touch your rankings.
          </p>
        )}

        <p className="muted" style={{ margin: "18px 0 8px", fontSize: 13, fontWeight: 600 }}>
          {mode === "pause" ? "Why?" : "What happened?"} <span style={{ fontWeight: 400 }}>Optional</span>
        </p>
        <div className="tag-list" role="group" aria-label="Reason">
          {reasons.map((r) => (
            <button key={r.key} type="button" className="tag-chip" aria-pressed={reason === r.key} onClick={() => setReason(reason === r.key ? null : r.key)}>
              {r.label}
            </button>
          ))}
        </div>

        <label htmlFor="stop-note" className="muted" style={{ display: "block", margin: "16px 0 8px", fontSize: 13, fontWeight: 600 }}>
          {mode === "pause" ? "A note for yourself" : "Say more"} <span style={{ fontWeight: 400 }}>Optional{mode === "drop" ? " · @ to mention" : ""}</span>
        </label>
        <textarea
          id="stop-note"
          className="textarea"
          maxLength={STOP_NOTE_MAX}
          value={note}
          placeholder={mode === "pause" ? "Where to pick it back up, or why" : "What didn’t work for you?"}
          onChange={(e) => setNote(e.target.value)}
          {...(mode === "drop" ? mention.fieldProps : {})}
        />
        {mode === "drop" && mention.picker}

        {mode === "drop" ? (
          <div className="switch-list" style={{ marginTop: 14 }}>
            <label className="switch-row">
              <span>Share on my feed</span>
              <input type="checkbox" role="switch" checked={shared} onChange={(e) => setShared(e.target.checked)} />
            </label>
            <label className="switch-row">
              <span>Contains spoilers</span>
              <input type="checkbox" role="switch" checked={spoiler} onChange={(e) => setSpoiler(e.target.checked)} />
            </label>
          </div>
        ) : (
          <p className="muted" style={{ margin: "12px 0 0", fontSize: 13, lineHeight: 1.4 }}>
            Only you see the reason and note. Friends see &ldquo;put aside&rdquo; on your profile, and nothing posts to the feed.
          </p>
        )}

        {mode === "drop" && (
          <p style={{ margin: "14px 0 0", fontSize: 14 }}>
            Read enough to have an opinion? <Link href={`/rank/${entry.book_id}`} style={{ fontWeight: 600 }}>Rank it anyway</Link>
          </p>
        )}

        {error && <p className="error" role="alert">{error}</p>}
        <div className="stack" style={{ marginTop: 20 }}>
          <button className="btn btn--block" disabled={busy} onClick={save}>
            {busy ? "Saving…" : mode === "pause" ? "Put it aside" : "Didn’t finish it"}
          </button>
          {mode === "pause" ? (
            <button className="link-btn" style={{ minHeight: 44 }} disabled={busy} onClick={onClose}>Keep reading</button>
          ) : (
            <button className="link-btn" style={{ minHeight: 44 }} disabled={busy} onClick={() => switchMode("pause")}>Put it aside instead</button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Back to Reading: carry on from where they stopped, or start over. From
 * Didn't finish it's "Give it another go", with an optional feed post.
 */
export function ResumeSheet({ entry, onClose, onDone }: { entry: Entry; onClose: () => void; onDone: () => void | Promise<void> }) {
  const fromDrop = entry.status === "dropped";
  const [startOver, setStartOver] = useState(false);
  const [share, setShare] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const p = progressLabel(entry);
  const since = entry.stopped_at ? sinceText(entry.stopped_at) : null;
  const why = entry.stop_reason ? STOP_REASON_LABEL[entry.stop_reason] : null;

  async function go() {
    setBusy(true);
    setError(null);
    try {
      await resumeBook(entry.id, { startOver, fromDrop, share });
      await onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn’t save that");
      setBusy(false);
    }
  }

  return (
    <div className="sheet-backdrop" onClick={() => !busy && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={`Pick ${entry.book.title} back up`} onClick={(e) => e.stopPropagation()}>
        <div className="sheet__grab" />
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <Cover book={entry.book} width={52} />
          <div style={{ minWidth: 0 }}>
            <h2 className="g" style={{ margin: 0, fontSize: 24, lineHeight: 1.1, fontWeight: 400 }}>
              {fromDrop ? "Give it another go" : `Back to ${entry.book.title}`}
            </h2>
            <p className="muted" style={{ margin: "4px 0 0", fontSize: 14 }}>
              {[fromDrop ? "Didn’t finish" : "Put aside", since, why].filter(Boolean).join(" · ")}
            </p>
          </div>
        </div>
        <div role="radiogroup" aria-label="Where to start" className="resume-options">
          <button type="button" role="radio" aria-checked={!startOver} className="resume-option" onClick={() => setStartOver(false)}>
            <span className="resume-option__dot" aria-hidden="true" />
            <span>
              <strong>{p && p !== "Not started" ? `Carry on from ${p.startsWith("Chapter") ? p.replace(/ of \d+$/, "").toLowerCase() : p}` : "Carry on where you were"}</strong>
              {p && p.startsWith("Chapter") && <span className="muted">{p.replace(/^Chapter \d+ /, "")}{entry.progress_pct != null ? ` · ${entry.progress_pct}% through` : ""}</span>}
            </span>
          </button>
          <button type="button" role="radio" aria-checked={startOver} className="resume-option" onClick={() => setStartOver(true)}>
            <span className="resume-option__dot" aria-hidden="true" />
            <span>
              <strong>Start from the beginning</strong>
              <span className="muted">Your old check-ins stay in the diary</span>
            </span>
          </button>
        </div>
        {fromDrop && (
          <div className="switch-list" style={{ marginTop: 14 }}>
            <label className="switch-row">
              <span>Share on my feed</span>
              <input type="checkbox" role="switch" checked={share} onChange={(e) => setShare(e.target.checked)} />
            </label>
          </div>
        )}
        {error && <p className="error" role="alert">{error}</p>}
        <div className="stack" style={{ marginTop: 20 }}>
          <button className="btn btn--block" disabled={busy} onClick={go}>{busy ? "Saving…" : "Pick it back up"}</button>
          <button className="link-btn" style={{ minHeight: 44 }} disabled={busy} onClick={onClose}>Not yet</button>
        </div>
      </div>
    </div>
  );
}

function sinceText(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 864e5);
  if (days < 1) return "today";
  if (days < 14) return `${days} day${days === 1 ? "" : "s"} ago`;
  if (days < 60) return `${Math.round(days / 7)} weeks ago`;
  return `${Math.round(days / 30)} months ago`;
}
