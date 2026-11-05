"use client";

import { useMentionPicker } from "@/components/Mentions";
import { useState } from "react";
import { saveFinishedOn, saveThoughts, type Entry } from "@/lib/data";
import { FinishedPicker } from "@/components/FinishedPicker";
import { NOTE_MAX, REVIEW_TAGS } from "@/lib/thoughts";

/**
 * Optional thoughts on a finished book: quick tags, a short review with a
 * spoiler switch, and when you finished it. Every part can be skipped.
 */
export function ThoughtsEditor({
  entry,
  onSaved,
  onDateSaved,
  compact = false,
  showDate = true,
}: {
  entry: Pick<Entry, "id" | "note" | "tags" | "note_spoiler" | "finished_on">;
  onSaved?: () => void | Promise<void>;
  /** After the finish date saves on its own (the editor stays open). */
  onDateSaved?: () => void | Promise<void>;
  compact?: boolean;
  /** Off right after ranking, where the date was just picked. */
  showDate?: boolean;
}) {
  const [tags, setTags] = useState<string[]>(entry.tags ?? []);
  const [note, setNote] = useState(entry.note ?? "");
  const [spoiler, setSpoiler] = useState(entry.note_spoiler ?? false);
  const [finished, setFinished] = useState<string | null>(entry.finished_on ?? null);
  const [dateNote, setDateNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const mention = useMentionPicker<HTMLTextAreaElement>(note, (v) => { setNote(v); setSaved(false); });
  const [error, setError] = useState<string | null>(null);

  // The date saves the moment it's picked: no separate button to forget.
  async function pickDate(v: string | null) {
    const before = finished;
    setFinished(v);
    setDateNote(null);
    try {
      await saveFinishedOn(entry.id, v);
      setDateNote("Date saved");
      await onDateSaved?.();
    } catch {
      setFinished(before);
      setDateNote("Couldn’t save the date. Try again?");
    }
  }

  function toggle(key: string) {
    setSaved(false);
    setTags((t) => (t.includes(key) ? t.filter((x) => x !== key) : t.length >= 6 ? t : [...t, key]));
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await saveThoughts(entry.id, { note, tags, spoiler });
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
        placeholder="What stuck with you? Type @ to mention a friend"
        maxLength={NOTE_MAX}
        value={note}
        onChange={(e) => { setNote(e.target.value); setSaved(false); }}
        {...mention.fieldProps}
      />
      {mention.picker}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 12 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, cursor: "pointer", minHeight: 44 }}>
          <input type="checkbox" checked={spoiler} onChange={(e) => { setSpoiler(e.target.checked); setSaved(false); }} style={{ width: 20, height: 20, accentColor: "var(--ink)" }} />
          Contains spoilers
        </label>
      </div>
      {showDate && <div style={{ marginTop: 12 }}>
        <FinishedPicker value={finished} onChange={pickDate} />
        {dateNote && <p className="muted" role="status" style={{ margin: "6px 0 0", fontSize: 12 }}>{dateNote}</p>}
      </div>}
      {error && <p className="error" role="alert">{error}</p>}
      <button className="btn btn--outline btn--block" style={{ marginTop: 12 }} disabled={busy || saved} onClick={save}>
        {busy ? "Saving…" : saved ? "Saved" : "Save thoughts"}
      </button>
    </div>
  );
}
