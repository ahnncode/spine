"use client";

import { useState } from "react";
import { saveThoughts, type Entry } from "@/lib/data";
import { NOTE_MAX, REVIEW_TAGS } from "@/lib/thoughts";

/**
 * Optional thoughts on a finished book: quick tags, a short review with a
 * spoiler switch, and when you finished it. Every part can be skipped.
 */
export function ThoughtsEditor({
  entry,
  onSaved,
  compact = false,
}: {
  entry: Pick<Entry, "id" | "note" | "tags" | "note_spoiler" | "finished_on">;
  onSaved?: () => void | Promise<void>;
  compact?: boolean;
}) {
  const [tags, setTags] = useState<string[]>(entry.tags ?? []);
  const [note, setNote] = useState(entry.note ?? "");
  const [spoiler, setSpoiler] = useState(entry.note_spoiler ?? false);
  const [finished, setFinished] = useState(entry.finished_on ?? "");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = new Date();
  const max = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  function toggle(key: string) {
    setSaved(false);
    setTags((t) => (t.includes(key) ? t.filter((x) => x !== key) : t.length >= 6 ? t : [...t, key]));
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await saveThoughts(entry.id, { note, tags, spoiler, finishedOn: finished || null });
      setSaved(true);
      await onSaved?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn’t save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={compact ? "" : "card"} style={{ marginTop: compact ? 0 : 18 }}>
      {!compact && <h2 className="h2">Any thoughts? <span className="muted" style={{ fontWeight: 500 }}>Optional</span></h2>}
      <div className="tag-list" style={{ marginTop: compact ? 0 : 12 }} role="group" aria-label="Quick tags">
        {REVIEW_TAGS.map((t) => (
          <button key={t.key} type="button" className="tag-chip" aria-pressed={tags.includes(t.key)} onClick={() => toggle(t.key)}>
            {t.label}
          </button>
        ))}
      </div>
      <label htmlFor={`note-${entry.id}`} className="visually-hidden">Your thoughts</label>
      <textarea
        id={`note-${entry.id}`}
        className="textarea"
        style={{ marginTop: 12 }}
        placeholder="What stuck with you?"
        maxLength={NOTE_MAX}
        value={note}
        onChange={(e) => { setNote(e.target.value); setSaved(false); }}
      />
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 10 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, cursor: "pointer", minHeight: 44 }}>
          <input type="checkbox" checked={spoiler} onChange={(e) => { setSpoiler(e.target.checked); setSaved(false); }} style={{ width: 20, height: 20, accentColor: "var(--ink)" }} />
          Contains spoilers
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
          <span className="muted">Finished</span>
          <input type="date" className="input" style={{ height: 44, padding: "0 10px", fontSize: 15 }} max={max} value={finished} onChange={(e) => { setFinished(e.target.value); setSaved(false); }} />
        </label>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      <button className="btn btn--outline btn--block" style={{ marginTop: 12 }} disabled={busy || saved} onClick={save}>
        {busy ? "Saving…" : saved ? "Saved" : "Save thoughts"}
      </button>
    </div>
  );
}
