"use client";

import { useEffect, useMemo, useState } from "react";
import { Cover } from "@/components/Cover";
import type { Book, BookInput } from "@/lib/books";
import {
  bookForListItem, buildPlan, fetchListItems, planProblem, startRead, updateRead,
  type ClubRead, type ListItem, type PlanWeek,
} from "@/lib/clubs";
import { ensureBook, fetchBooks, suggestChapters } from "@/lib/data";
import { searchBooks } from "@/lib/openlibrary";
import { shortDate, today } from "./ClubBits";

function addDays(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const t = new Date(y, m - 1, d + n);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
}

type Picked = { bookId: string; book: Book; listPosition: number | null };

/**
 * The host picks the club's next book (from its list, or any book), sets the
 * dates, and gets a weekly plan split from the chapter count, which they can
 * adjust, with questions for each week. With `editing`, it edits the current
 * read's finish date, plan and questions instead.
 */
export function ClubPick({
  clubId, listId, readPositions, editing, ending, onClose, onDone,
}: {
  clubId: string;
  listId: string | null;
  /** List positions the club has already read. */
  readPositions: number[];
  editing?: { read: ClubRead; book: Book } | null;
  /** The current read's title, when picking a new book will end it. */
  ending?: string | null;
  onClose: () => void;
  onDone: () => void | Promise<void>;
}) {
  const [step, setStep] = useState<"book" | "plan">(editing ? "plan" : "book");
  const [items, setItems] = useState<ListItem[] | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<BookInput[]>([]);
  const [searching, setSearching] = useState(false);
  const [picked, setPicked] = useState<Picked | null>(editing ? { bookId: editing.book.id, book: editing.book, listPosition: editing.read.list_position } : null);
  const [starts, setStarts] = useState(editing?.read.starts_on ?? today());
  const [ends, setEnds] = useState(editing?.read.ends_on ?? addDays(today(), 28));
  const [chapters, setChapters] = useState<string>(editing ? String(editing.read.plan.at(-1)?.through ?? "") : "");
  const [plan, setPlan] = useState<PlanWeek[]>(editing?.read.plan ?? []);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (listId && !editing) fetchListItems(listId).then(setItems).catch(() => setItems([]));
  }, [listId, editing]);

  useEffect(() => {
    if (step !== "book" || query.trim().length < 3) return;
    const ctl = new AbortController();
    const t = setTimeout(() => {
      setSearching(true);
      searchBooks(query, ctl.signal)
        .then((r) => setResults(r.slice(0, 8)))
        .catch(() => {})
        .finally(() => !ctl.signal.aborted && setSearching(false));
    }, 300);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [query, step]);

  const n = parseInt(chapters, 10);
  // Rebuild the plan whenever the dates or chapter count change (not while editing an existing plan).
  const autoPlan = useMemo(() => (n > 0 && ends > starts ? buildPlan(n, starts, ends) : []), [n, starts, ends]);
  const [touched, setTouched] = useState(Boolean(editing));
  const weeks = touched ? plan : autoPlan;

  async function choose(load: () => Promise<string>, listPosition: number | null, key: string) {
    setBusy(key);
    setError(null);
    try {
      const id = await load();
      const [book] = await fetchBooks([id]);
      setPicked({ bookId: id, book, listPosition });
      setChapters(book?.chapters ? String(book.chapters) : "");
      setStep("plan");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn’t find that book");
    } finally {
      setBusy(null);
    }
  }

  function editWeek(i: number, patch: Partial<PlanWeek>) {
    const base = touched ? plan : autoPlan;
    setPlan(base.map((w, j) => (j === i ? { ...w, ...patch } : w)));
    setTouched(true);
  }

  async function save() {
    if (!picked) return;
    if (!(n > 0)) return setError("How many chapters does it have?");
    if (!(ends > starts)) return setError("The finish date has to be after the start");
    const problem = planProblem(touched ? plan : autoPlan, n);
    if (problem) return setError(problem);
    const final = (touched ? plan : autoPlan).map((w) => ({ ...w, questions: (w.questions ?? []).map((q) => q.trim()).filter(Boolean) }));
    setBusy("save");
    setError(null);
    try {
      if (!picked.book.chapters) await suggestChapters(picked.bookId, n).catch(() => {});
      if (editing) await updateRead(editing.read.id, ends, final);
      else await startRead(clubId, picked.bookId, starts, ends, final, picked.listPosition);
      await onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn’t save that");
      setBusy(null);
    }
  }

  return (
    <div className="sheet-backdrop" onClick={() => !busy && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={editing ? "Edit the plan" : "Pick the next book"} onClick={(e) => e.stopPropagation()}>
        <div className="sheet__grab" />
        <p className="eyebrow" style={{ color: "var(--amber-ink)" }}>{editing ? "The plan" : "You’re the host"}</p>
        <h2 className="g" style={{ margin: "4px 0 0", fontSize: 28, lineHeight: 1.1, fontWeight: 400 }}>
          {editing ? editing.book.title : step === "book" ? (ending ? "Pick the next book" : "Pick the club’s book") : "Dates and plan"}
        </h2>
        {ending && !editing && (
          <p className="club-notice" style={{ marginTop: 12 }}>
            Starting a new book wraps up <strong>{ending}</strong> for everyone. Its verdict and rooms move to the club shelf.
          </p>
        )}

        {step === "book" && (
          <>
            {items && items.length > 0 && (
              <section aria-label="From the club's list" style={{ marginTop: 16 }}>
                <h3 className="eyebrow">From the list</h3>
                <ul className="pick-list">
                  {items.map((it, idx) => {
                    const done = readPositions.includes(it.position);
                    const upNext = !done && items.findIndex((x) => !readPositions.includes(x.position)) === idx;
                    return (
                      <li key={it.position}>
                        <button type="button" className="pick-list__row" disabled={busy !== null} onClick={() => choose(() => bookForListItem(it), it.position, `l${it.position}`)}>
                          <span className="pick-list__year">{it.year}</span>
                          <span style={{ flex: 1, minWidth: 0 }}>
                            <strong style={{ display: "block", fontSize: 15 }}>{it.title}</strong>
                            <span className="muted" style={{ fontSize: 12 }}>{[it.author, it.note, done ? "Read together" : null].filter(Boolean).join(" · ")}</span>
                            {upNext && <span className="club-accent" style={{ display: "block", fontSize: 12, fontWeight: 700 }}>Next on the list</span>}
                          </span>
                          {busy === `l${it.position}` && <span className="muted" style={{ fontSize: 12 }}>Finding…</span>}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}
            <section aria-label="Any book" style={{ marginTop: 16 }}>
              <h3 className="eyebrow">{items && items.length ? "Or any book" : "Find the book"}</h3>
              <label htmlFor="pick-search" className="visually-hidden">Search for a book</label>
              <input id="pick-search" className="input" type="search" style={{ marginTop: 8, width: "100%" }} placeholder="Title or author" value={query} onChange={(e) => setQuery(e.target.value)} />
              {searching && <p className="muted" style={{ margin: "10px 0 0", fontSize: 13 }}>Searching…</p>}
              {!searching && query.trim().length >= 3 && results.length === 0 && <p className="muted" style={{ margin: "10px 0 0", fontSize: 13 }}>No books found. Try the author&rsquo;s name too.</p>}
              <ul className="pick-list">
                {results.map((b, i) => (
                  <li key={`${b.title}-${i}`}>
                    <button type="button" className="pick-list__row" disabled={busy !== null} onClick={() => choose(() => ensureBook(b), null, `s${i}`)}>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <strong style={{ display: "block", fontSize: 15 }}>{b.title}</strong>
                        <span className="muted" style={{ fontSize: 12 }}>{[b.author, b.year].filter(Boolean).join(" · ")}</span>
                      </span>
                      {busy === `s${i}` && <span className="muted" style={{ fontSize: 12 }}>Adding…</span>}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}

        {step === "plan" && picked && (
          <>
            {!editing && (
              <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 14 }}>
                <Cover book={picked.book} width={44} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <strong style={{ display: "block", fontSize: 15 }}>{picked.book.title}</strong>
                  <span className="muted" style={{ fontSize: 13 }}>{picked.book.author}</span>
                </div>
                <button type="button" className="link-btn" style={{ minHeight: 36 }} onClick={() => setStep("book")}>Change</button>
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: editing ? "1fr 1fr" : "1fr 1fr 1fr", gap: 10, marginTop: 14 }}>
              {!editing && (
                <label className="field-label" style={{ margin: 0 }}>Starts
                  <input className="input" type="date" value={starts} style={{ marginTop: 6 }} onChange={(e) => { setStarts(e.target.value); setTouched(false); }} />
                </label>
              )}
              <label className="field-label" style={{ margin: 0 }}>Finishes
                <input className="input" type="date" value={ends} style={{ marginTop: 6 }} onChange={(e) => { setEnds(e.target.value); setTouched(false); }} />
              </label>
              <label className="field-label" style={{ margin: 0 }}>Chapters
                <input className="input" inputMode="numeric" value={chapters} placeholder="?" style={{ marginTop: 6 }} onChange={(e) => { setChapters(e.target.value.replace(/\D/g, "").slice(0, 3)); setTouched(false); }} />
              </label>
            </div>
            {weeks.length > 0 ? (
              <section aria-label="Weekly plan" className="card" style={{ marginTop: 14, padding: 0, overflow: "hidden" }}>
                <div className="club-plan-row" style={{ background: "var(--ground)" }}>
                  <span className="eyebrow">Weekly plan</span>
                  <span className="muted" style={{ fontSize: 12 }}>Read through chapter</span>
                </div>
                {weeks.map((w, i) => (
                  <div key={i} className="club-plan-row" style={{ gridTemplateColumns: "1fr 84px" }}>
                    <span>
                      <strong>Week {i + 1}</strong> <span className="muted">· by {shortDate(w.due)}</span>
                      <label className="visually-hidden" htmlFor={`q-${i}`}>Questions for week {i + 1}</label>
                      <textarea
                        id={`q-${i}`}
                        className="textarea"
                        style={{ minHeight: 44, marginTop: 6, fontSize: 13 }}
                        placeholder="Questions for this week (one per line, optional)"
                        value={(w.questions ?? []).join("\n")}
                        onChange={(e) => editWeek(i, { questions: e.target.value.split("\n") })}
                      />
                    </span>
                    <input className="input" inputMode="numeric" aria-label={`Week ${i + 1}: read through chapter`} value={w.through} onChange={(e) => editWeek(i, { through: Math.max(1, parseInt(e.target.value.replace(/\D/g, ""), 10) || 1) })} />
                  </div>
                ))}
              </section>
            ) : (
              <p className="muted" style={{ marginTop: 14, fontSize: 14 }}>Add the chapter count and the weekly plan fills itself in.</p>
            )}
            {error && <p className="error" role="alert">{error}</p>}
            <div className="stack" style={{ marginTop: 18 }}>
              <button className="btn btn--block" disabled={busy !== null} onClick={save}>{busy === "save" ? "Saving…" : editing ? "Save the plan" : `Start ${picked.book.title}`}</button>
              <button className="link-btn" style={{ minHeight: 44 }} disabled={busy !== null} onClick={onClose}>Cancel</button>
            </div>
          </>
        )}
        {step === "book" && error && <p className="error" role="alert">{error}</p>}
      </div>
    </div>
  );
}
