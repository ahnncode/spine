"use client";

import { useEffect, useState } from "react";
import type { Book } from "@/lib/books";
import { fetchBookDescription, saveBookDescription } from "@/lib/data";
import { findDescription } from "@/lib/descriptions";

const WEEK = 7 * 24 * 3600 * 1000;
const SOURCE: Record<string, string> = { openlibrary: "Open Library", apple: "Apple Books" };

/**
 * "About this book": a short description, looked up the first time anyone
 * opens the book and saved for everyone after that.
 */
export function BookSummary({ book }: { book: Pick<Book, "id" | "title" | "author" | "ol_work_key"> }) {
  const { id, title, author, ol_work_key: workKey } = book;
  const [state, setState] = useState<{ text: string | null; source: string | null; looking: boolean }>({ text: null, source: null, looking: true });
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const saved = await fetchBookDescription(id).catch(() => null);
      if (!alive) return;
      if (saved?.description) return setState({ text: saved.description, source: saved.source, looking: false });
      // Looked recently and found nothing: don't look again yet.
      if (saved && Date.now() - Date.parse(saved.checked) < WEEK) return setState({ text: null, source: null, looking: false });
      const found = await findDescription({ title, author, ol_work_key: workKey }).catch(() => null);
      if (!alive) return;
      setState({ text: found?.text ?? null, source: found?.source ?? null, looking: false });
      saveBookDescription(id, found?.text ?? null, found?.source ?? null).catch(() => {});
    })();
    return () => {
      alive = false;
    };
  }, [id, title, author, workKey]);

  if (state.looking) {
    return (
      <div aria-busy="true" aria-label="Looking up a summary" style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 7 }}>
        {[100, 94, 62].map((w) => <span key={w} className="skeleton" style={{ display: "block", height: 12, width: `${w}%` }} />)}
      </div>
    );
  }
  if (!state.text) return null;
  const long = state.text.length > 260;

  return (
    <section style={{ marginTop: 16 }} aria-label="About this book">
      <p className={`book-summary${open || !long ? "" : " book-summary--clamped"}`}>{state.text}</p>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}>
        {long && (
          <button className="link-btn" style={{ fontSize: 13, fontWeight: 600 }} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
            {open ? "Show less" : "Read more"}
          </button>
        )}
        {state.source && <span className="muted" style={{ fontSize: 11 }}>from {SOURCE[state.source] ?? state.source}</span>}
      </div>
    </section>
  );
}
