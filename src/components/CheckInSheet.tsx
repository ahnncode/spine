"use client";

import { useMentionPicker } from "@/components/Mentions";
import Link from "next/link";
import { useState } from "react";
import { checkIn, type Entry, isListened, setFormat, suggestChapters, type Format, type ProgressUnit } from "@/lib/data";
import { CHECKIN_NOTE_MAX, VIBES } from "@/lib/thoughts";
import { FormatToggle } from "./FormatToggle";
import { Cover } from "./Cover";
import { StopSheet } from "./StopSheet";
import { RoomPrompt } from "./ChapterRooms";

/**
 * Check in on a book you're reading. Progress is optional and goes by chapter
 * (the default), page, or percent. Chapter counts come from readers: the
 * first one to enter a book's count shares it as everyone's starting point.
 */
export function CheckInSheet({ entry, onClose, onDone }: { entry: Entry; onClose: () => void; onDone: () => void | Promise<void> }) {
  const [fmt, setFmt] = useState<Format>(entry.format ?? "read");
  function pickFormat(v: Format) {
    setFmt(v);
    setFormat(entry.id, v).catch(() => setFmt(entry.format ?? "read"));
  }
  const pages = entry.book.pages ?? null;
  const start = entry.progress_pct ?? 0;
  const [pct, setPct] = useState<number>(start);
  const [page, setPage] = useState<string>(pages && entry.progress_pct != null ? String(Math.round((entry.progress_pct / 100) * pages)) : "");
  const [touched, setTouched] = useState(false);
  const [unit, setUnit] = useState<ProgressUnit>(() => {
    const u = entry.progress_unit ?? (entry.progress_pct != null ? "percent" : "chapter");
    return u === "page" && !pages ? "percent" : u;
  });
  const [total, setTotal] = useState<string>(String(entry.chapter_total ?? entry.book.chapters ?? ""));
  const totalN = parseInt(total, 10) > 0 ? Math.min(999, parseInt(total, 10)) : null;
  // Chapters finished, estimated from a percent when switching from pages or percent.
  const fromPct = (p: number, t: number) => Math.max(0, Math.min(t, Math.floor((p / 100) * t)));
  const [chapter, setChapter] = useState<number>(() => {
    if (entry.progress_chapter != null) return entry.progress_chapter;
    const t = entry.chapter_total ?? entry.book.chapters;
    return t && entry.progress_pct != null ? fromPct(entry.progress_pct, t) : 0;
  });
  // Once they set a chapter themselves, stop estimating it.
  const [chapterSet, setChapterSet] = useState(entry.progress_chapter != null);
  // Chapter progress also gives a percent once the count is known.
  const chapterPct = totalN ? Math.round((Math.min(chapter, totalN) / totalN) * 100) : null;
  const shownPct = unit === "chapter" ? chapterPct : pct;
  // Already partway (by page or percent) but no chapter count yet: don't claim chapter 0.
  const unknownChapter = !totalN && !chapterSet && pct > 0;
  function stepChapter(d: number) {
    setChapter((c) => Math.max(0, Math.min(totalN ?? 999, c + d)));
    setChapterSet(true);
    setTouched(true);
  }
  // Switching units carries progress across instead of starting over.
  function pickUnit(u: ProgressUnit) {
    if (u === unit) return;
    if (unit === "chapter" && chapterPct != null && chapterSet) {
      setPct(chapterPct);
      if (pages) setPage(String(Math.round((chapterPct / 100) * pages)));
    }
    if (u === "chapter" && totalN && !chapterSet) setChapter(fromPct(pct, totalN));
    setUnit(u);
  }
  const [note, setNote] = useState("");
  const mention = useMentionPicker<HTMLInputElement>(note, setNote);
  const [vibe, setVibe] = useState<string | null>(null);
  // Most check-ins are "I read some": mood and a note wait behind one tap.
  const [extra, setExtra] = useState(false);
  const [busy, setBusy] = useState(false);
  // Not reading it right now: put it aside or drop it, from the same sheet.
  const [stop, setStop] = useState<"pause" | "drop" | null>(null);
  const [error, setError] = useState<string | null>(null);
  // After saving: the chapter whose room just opened.
  const [opened, setOpened] = useState<number | null>(null);
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
      const progress = !withProgress ? null : unit === "chapter" ? chapterPct : pct;
      await checkIn(entry.book_id, progress, {
        note,
        vibe,
        unit,
        chapter: withProgress && unit === "chapter" ? chapter : null,
        chapterTotal: unit === "chapter" ? totalN : null,
      });
      // First reader to count the chapters shares it with everyone after.
      if (totalN && !entry.book.chapters) await suggestChapters(entry.book_id, totalN).catch(() => {});
      // Reached a new chapter: its room just opened, so offer it before closing.
      const at = !withProgress ? null : unit === "chapter" ? chapter : totalN ? fromPct(pct, totalN) : null;
      const before = entry.progress_chapter ?? (entry.progress_pct != null && totalN ? fromPct(entry.progress_pct, totalN) : 0);
      if (at && at > 0 && at > before) {
        setOpened(at);
        setBusy(false);
        return;
      }
      await onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn’t check in");
      setBusy(false);
    }
  }

  if (stop) return <StopSheet entry={entry} mode={stop} onClose={() => setStop(null)} onDone={onDone} />;
  if (opened != null) {
    return (
      <div className="sheet-backdrop" onClick={() => onDone()}>
        <div className="sheet" role="dialog" aria-modal="true" aria-label="Checked in" onClick={(e) => e.stopPropagation()}>
          <div className="sheet__grab" />
          <p className="eyebrow" style={{ color: "var(--success)" }}>Checked in</p>
          <h2 className="g" style={{ margin: "4px 0 0", fontSize: 24, lineHeight: 1.1, fontWeight: 400 }}>
            Chapter {opened}{totalN ? ` of ${totalN}` : ""}
          </h2>
          <p className="muted" style={{ margin: "4px 0 0", fontSize: 14 }}>{entry.book.title}</p>
          <RoomPrompt bookId={entry.book_id} chapter={opened} onOpen={() => void onDone()} />
          <button className="link-btn" style={{ minHeight: 44, width: "100%", marginTop: 8 }} onClick={() => onDone()}>Done</button>
        </div>
      </div>
    );
  }

  return (
    <div className="sheet-backdrop" onClick={() => !busy && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={`Check in on ${entry.book.title}`} onClick={(e) => e.stopPropagation()}>
        <div className="sheet__grab" />
        <div style={{ display: "flex", gap: 16, alignItems: "flex-end" }}>
          <Link href={`/book/${entry.book_id}`} aria-label={`${entry.book.title}: book page`} style={{ flexShrink: 0 }}>
            <Cover book={entry.book} width={72} listened={isListened(entry.format)} />
          </Link>
          <div style={{ minWidth: 0 }}>
            <p className="eyebrow">{doneToday ? "Checked in today" : "Reading check-in"}</p>
            <h2 className="d" style={{ margin: "4px 0 0", fontSize: 20, fontWeight: 700, letterSpacing: "-0.01em", lineHeight: 1.05 }}>
              <Link href={`/book/${entry.book_id}`} style={{ color: "inherit", textDecoration: "none" }}>{entry.book.title}</Link>
            </h2>
            <Link href={`/book/${entry.book_id}`} style={{ display: "inline-block", marginTop: 8, fontSize: 13, fontWeight: 600, color: "var(--cobalt-ink)", textDecoration: "none" }}>
              Book page →
            </Link>
          </div>
        </div>

        {/* Asked on a book's first check-in; after that the cover's headphones mark says it. */}
        {!entry.last_checkin_on && (
          <div style={{ marginTop: 20 }}>
            <FormatToggle value={fmt} onChange={pickFormat} label="Reading or listening?" />
          </div>
        )}

        <div style={{ marginTop: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>{isListened(fmt) ? "How far have you listened?" : "How far are you?"}</span>
            <div className="unit-tabs" role="group" aria-label="Track progress by">
              <button type="button" aria-pressed={unit === "chapter"} onClick={() => pickUnit("chapter")}>Chapter</button>
              {pages && <button type="button" aria-pressed={unit === "page"} onClick={() => pickUnit("page")}>Page</button>}
              <button type="button" aria-pressed={unit === "percent"} onClick={() => pickUnit("percent")}>%</button>
            </div>
          </div>

          {unit === "chapter" && (
            <div className="chapter-picker">
              <button type="button" className="icon-btn" aria-label="One chapter back" onClick={() => stepChapter(-1)} disabled={chapter <= 0}>−</button>
              <div className="chapter-picker__now" aria-live="polite">
                <span className="chapter-picker__label">{unknownChapter ? "Your chapter" : chapter === 0 ? "Not started" : "Finished chapter"}</span>
                <span className="d chapter-picker__n">{unknownChapter ? "?" : chapter}</span>
              </div>
              <button type="button" className="icon-btn" aria-label="One chapter forward" onClick={() => stepChapter(1)} disabled={totalN != null && chapter >= totalN}>+</button>
              <label className="chapter-picker__of">
                <span>of</span>
                <input className="input" inputMode="numeric" aria-label="Chapters in the book" placeholder="?" value={total}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, "").slice(0, 3);
                    setTotal(v);
                    const n = parseInt(v, 10);
                    if (n > 0) setChapter((c) => (chapterSet ? Math.min(c, n) : fromPct(pct, n)));
                  }} />
              </label>
            </div>
          )}
          {unit === "chapter" && (
            <p className="muted" style={{ margin: "8px 0 0", fontSize: 13 }}>
              {!totalN
                ? pct > 0 && !chapterSet
                  ? `You’re ${pct}% through. Add how many chapters it has and we’ll work out your chapter.`
                  : "Add how many chapters it has to see your percent. Readers after you get it filled in."
                : `${chapterPct}% through${!entry.chapter_total && entry.book.chapters ? " · chapter count from another reader" : ""}`}
            </p>
          )}

          {unit === "page" && pages && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, fontSize: 15 }}>
              <label htmlFor="page" className="muted">Page</label>
              <input id="page" className="input" inputMode="numeric" style={{ width: 96, height: 48 }} value={page} onChange={(e) => fromPage(e.target.value)} />
              <span className="muted">of {pages}</span>
              <span className="d" style={{ marginLeft: "auto", fontSize: 28, fontWeight: 700 }}>{pct}%</span>
            </div>
          )}

          {unit === "percent" && (
            <>
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6 }}>
                <span className="d" style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.01em" }}>{pct}%</span>
              </div>
              <label htmlFor="progress" className="visually-hidden">Percent through</label>
              <input
                id="progress"
                type="range"
                min={0}
                max={100}
                step={1}
                value={pct}
                onChange={(e) => { setPct(Number(e.target.value)); setTouched(true); if (pages) setPage(String(Math.round((Number(e.target.value) / 100) * pages))); }}
                style={{ width: "100%", marginTop: 4, accentColor: "var(--accent)", height: 32 }}
              />
            </>
          )}
        </div>

        {!extra ? (
          <button type="button" className="btn btn--quiet" style={{ marginTop: 16, alignSelf: "flex-start", minHeight: 44 }} onClick={() => setExtra(true)}>
            + Add a thought
          </button>
        ) : (<>
        <div className="tag-list" role="group" aria-label="How’s it going?" style={{ marginTop: 20 }}>
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
          style={{ width: "100%", marginTop: 12 }}
          placeholder="A quick thought (optional) · @ to mention"
          maxLength={CHECKIN_NOTE_MAX}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          {...mention.fieldProps}
        />
        {mention.picker}
        </>)}

        {error && <p className="error" role="alert">{error}</p>}
        <div className="stack" style={{ marginTop: 20 }}>
          <button className="btn btn--block" disabled={busy} onClick={() => save(touched || entry.progress_pct != null || entry.progress_chapter != null)}>
            {busy ? "Saving…" : doneToday ? "Update progress" : "Check in"}
          </button>
          {(shownPct ?? 0) >= 100 ? (
            <Link href={`/rank/${entry.book_id}`} className="btn btn--outline btn--block">Done? Rank it</Link>
          ) : (
            <button className="link-btn" style={{ minHeight: 44 }} disabled={busy || (doneToday && !note.trim() && !vibe)} onClick={() => save(false)}>
              Just read a bit, skip progress
            </button>
          )}
        </div>
        <p className="muted" style={{ fontSize: 13, textAlign: "center", margin: "12px 0 0" }}>
          A check-in any day keeps this week&rsquo;s streak going.
        </p>
        <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid var(--line)" }}>
          <p className="muted" style={{ margin: "0 0 10px", fontSize: 13, textAlign: "center" }}>Not reading it right now?</p>
          <div className="stop-row">
            <button type="button" className="stop-btn stop-btn--pause" disabled={busy} onClick={() => setStop("pause")}>
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5.5 3.5v9M10.5 3.5v9" /></svg>
              Put aside
            </button>
            <button type="button" className="stop-btn stop-btn--drop" disabled={busy} onClick={() => setStop("drop")}>
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 4l8 8M12 4l-8 8" /></svg>
              Drop it
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
