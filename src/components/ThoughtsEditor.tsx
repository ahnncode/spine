"use client";

import { useMentionPicker } from "@/components/Mentions";
import { useState } from "react";
import { saveFinishedOn, saveThoughts, setFormat, type Entry, type Format } from "@/lib/data";
import { FormatToggle } from "@/components/FormatToggle";
import { FinishedPicker } from "@/components/FinishedPicker";
import { GENRE_BY_KEY } from "@/lib/genres";
import { NOTE_MAX, TAG_LABEL, tagsFor, type Tag } from "@/lib/thoughts";

/**
 * Optional thoughts on a finished book: quick tags, a short review with a
 * spoiler switch, and when you finished it. Every part can be skipped.
 */
export function ThoughtsEditor({
  entry,
  genres,
  onSaved,
  onDateSaved,
  compact = false,
  showDate = true,
}: {
  entry: Pick<Entry, "id" | "note" | "tags" | "note_spoiler" | "finished_on"> & { format?: Format };
  /** The book's genres: its main one picks the genre tags. */
  genres?: string[] | null;
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
  const [fmt, setFmt] = useState<Format>(entry.format ?? "read");
  // Saves straight away, like the date.
  async function pickFormat(v: Format) {
    const before = fmt;
    setFmt(v);
    try {
      await setFormat(entry.id, v);
      await onDateSaved?.();
    } catch {
      setFmt(before);
    }
  }

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

  const { genre, genreTags, core } = tagsFor(genres);
  // Tags picked before (say, under another genre) stay visible so they can be removed.
  const shownKeys = new Set([...genreTags, ...core].map((t) => t.key));
  const extra: Tag[] = tags.filter((k) => !shownKeys.has(k) && TAG_LABEL[k]).map((k) => ({ key: k, label: TAG_LABEL[k] }));
  const chip = (className: string) =>
    function TagChip(t: Tag) {
      return (
        <button key={t.key} type="button" className={className} aria-pressed={tags.includes(t.key)} onClick={() => toggle(t.key)}>
          {t.label}
        </button>
      );
    };

  return (
    <div className={compact ? "" : "card"} style={{ marginTop: compact ? 0 : 18 }}>
      {!compact && <h2 className="h2">Any thoughts? <span className="muted" style={{ fontWeight: 500 }}>Optional</span></h2>}
      {genreTags.length > 0 && genre && (
        <>
          <p className="eyebrow" style={{ margin: compact ? "0 0 8px" : "12px 0 8px" }}>For {GENRE_BY_KEY[genre]?.label.toLowerCase() ?? genre}</p>
          <div className="tag-list" role="group" aria-label={`Tags for ${GENRE_BY_KEY[genre]?.label ?? genre}`}
            style={{ ["--g" as string]: GENRE_BY_KEY[genre]?.bg ?? "var(--cobalt)", ["--g-fg" as string]: GENRE_BY_KEY[genre]?.fg ?? "#fff" }}>
            {genreTags.map(chip("tag-chip tag-chip--genre"))}
          </div>
        </>
      )}
      {genreTags.length > 0 && <p className="eyebrow" style={{ margin: "14px 0 8px" }}>Any book</p>}
      <div className="tag-list" style={{ marginTop: genreTags.length || compact ? 0 : 12 }} role="group" aria-label="Quick tags">
        {[...core, ...extra].map(chip("tag-chip"))}
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
        <div style={{ marginTop: 14 }}>
          <FormatToggle value={fmt} onChange={pickFormat} />
        </div>
      </div>}
      {error && <p className="error" role="alert">{error}</p>}
      <button className="btn btn--outline btn--block" style={{ marginTop: 12 }} disabled={busy || saved} onClick={save}>
        {busy ? "Saving…" : saved ? "Saved" : "Save thoughts"}
      </button>
    </div>
  );
}
