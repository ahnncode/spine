"use client";

import Link from "next/link";
import { useState } from "react";
import { Cover } from "@/components/Cover";
import { saveFinishedOn, today, type Entry } from "@/lib/data";

/**
 * Ranked books with no finish date (often imports where Goodreads had none).
 * Pick a date right here so they count in the right year.
 */
export function MissingDates({ entries, onChanged }: { entries: Entry[]; onChanged: () => void | Promise<void> }) {
  const missing = entries.filter((e) => e.status === "ranked" && !e.finished_on);
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState<Record<string, string>>({});
  if (!missing.length) return null;
  const left = missing.filter((e) => !saved[e.id]).length;

  async function pick(e: Entry, date: string) {
    if (!date) return;
    setSaved((s) => ({ ...s, [e.id]: date }));
    try {
      await saveFinishedOn(e.id, date);
    } catch {
      setSaved((s) => Object.fromEntries(Object.entries(s).filter(([k]) => k !== e.id)));
    }
  }

  async function close() {
    setOpen(false);
    if (Object.keys(saved).length) await onChanged();
  }

  return (
    <>
      <button className="notice" style={{ display: "block", width: "100%", textAlign: "left", border: 0, marginTop: 16 }} onClick={() => setOpen(true)}>
        <strong>{missing.length} ranked book{missing.length === 1 ? " has" : "s have"} no finish date</strong>, so {missing.length === 1 ? "it isn’t" : "they aren’t"} counted in any year. Add dates →
      </button>
      {open && (
        <div className="sheet-backdrop" onClick={close}>
          <div className="sheet" role="dialog" aria-modal="true" aria-label="Add finish dates" onClick={(ev) => ev.stopPropagation()}>
            <div className="sheet__grab" />
            <h2 className="h2">When did you finish these?</h2>
            <p className="muted" style={{ margin: "4px 0 0", fontSize: 13, lineHeight: 1.45 }}>
              Pick a date for any you remember; each one saves right away. Skip the rest.
              Or <Link href="/import" style={{ fontWeight: 600 }}>re-upload your Goodreads export</Link>: any dates in it fill in automatically.
            </p>
            <ul style={{ listStyle: "none", margin: "12px 0 0", padding: 0, maxHeight: "60vh", overflowY: "auto" }}>
              {missing.map((e) => (
                <li key={e.id} className="book-row" style={{ gap: 12 }}>
                  <Cover book={e.book} width={34} />
                  <span className="book-row__body">
                    <span className="book-row__title" style={{ display: "block", fontSize: 15 }}>{e.book.title}</span>
                    <span className="book-row__sub" style={{ display: "block" }}>{saved[e.id] ? "Saved" : e.book.author}</span>
                  </span>
                  <label className="visually-hidden" htmlFor={`fin-${e.id}`}>Finish date for {e.book.title}</label>
                  <input id={`fin-${e.id}`} type="date" className="input" max={today()} value={saved[e.id] ?? ""}
                    onChange={(ev) => pick(e, ev.target.value)}
                    style={{ width: 150, height: 44, padding: "0 8px", fontSize: 14, flexShrink: 0 }} />
                </li>
              ))}
            </ul>
            <button className="btn btn--block" style={{ marginTop: 12 }} onClick={close}>{left === missing.length ? "Close" : `Done (${missing.length - left} dated)`}</button>
          </div>
        </div>
      )}
    </>
  );
}
