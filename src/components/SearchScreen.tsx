"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { dedupeKey, type BookInput } from "@/lib/books";
import { addToWant, ensureBook, type Entry } from "@/lib/data";
import { searchBooks } from "@/lib/openlibrary";
import { RequireAuth } from "./Auth";
import { Cover } from "./Cover";
import { BookmarkIcon, SearchIcon } from "./icons";
import { TabBar } from "./TabBar";
import { useShelf } from "./useShelf";

export function SearchScreen({ mode }: { mode: "discover" | "add" }) {
  return (
    <RequireAuth>
      <Inner mode={mode} />
    </RequireAuth>
  );
}

function Inner({ mode }: { mode: "discover" | "add" }) {
  const router = useRouter();
  const { entries, reload } = useShelf();
  const [query, setQuery] = useState("");
  const [rawResults, setResults] = useState<BookInput[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<BookInput | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const byKey = useMemo(() => {
    const m = new Map<string, Entry>();
    for (const e of entries || []) m.set(e.book.dedupe_key, e);
    return m;
  }, [entries]);

  useEffect(() => {
    if (mode === "add") inputRef.current?.focus();
  }, [mode]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setSearching(true);
      setError(null);
      try {
        setResults(await searchBooks(q, ctrl.signal));
      } catch (e) {
        if (!ctrl.signal.aborted) setError(e instanceof Error ? e.message : "Search failed");
      } finally {
        if (!ctrl.signal.aborted) setSearching(false);
      }
    }, 300);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query]);

  async function rank(book: BookInput) {
    setBusy(true);
    try {
      const id = await ensureBook(book);
      router.push(`/rank/${id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't open that book");
      setBusy(false);
    }
  }

  async function want(book: BookInput) {
    setBusy(true);
    try {
      await addToWant(await ensureBook(book));
      await reload();
      setPicked(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save that");
    } finally {
      setBusy(false);
    }
  }

  // Short queries show the prompt instead of stale results.
  const results = query.trim().length >= 2 ? rawResults : null;
  const pickedEntry = picked ? byKey.get(dedupeKey(picked.title, picked.author)) : undefined;

  return (
    <div className="app">
      <main className="screen">
        <h1 className="h1">{mode === "add" ? "What did you finish?" : "Discover"}</h1>
        <div className="search-box">
          <SearchIcon size={20} />
          <label htmlFor="q" className="visually-hidden">Search by title or author</label>
          <input
            id="q"
            ref={inputRef}
            className="input"
            type="search"
            placeholder="Title or author"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
          />
        </div>

        {error && <p className="error" role="alert">{error}</p>}

        {results === null ? (
          <div className="empty">
            <p className="h2">{mode === "add" ? "Rank a book in a few taps" : "Find your next read"}</p>
            <p style={{ margin: 0, fontSize: 14 }}>
              Search above, or{" "}
              <Link href="/import" style={{ fontWeight: 600 }}>bring in your Goodreads shelf</Link>.
            </p>
          </div>
        ) : results.length === 0 && !searching ? (
          <div className="empty">
            <p className="h2">No matches</p>
            <p style={{ margin: 0, fontSize: 14 }}>Try the author&rsquo;s last name, or fewer words.</p>
          </div>
        ) : (
          <ul style={{ listStyle: "none", margin: "8px 0 0", padding: 0 }} aria-busy={searching}>
            {results.map((b) => {
              const entry = byKey.get(dedupeKey(b.title, b.author));
              return (
                <li key={(b.ol_work_key || "") + b.title}>
                  <button
                    className="book-row"
                    style={{ width: "100%", background: "none", border: 0, borderBottom: "1px solid var(--line)", textAlign: "left" }}
                    onClick={() => setPicked(b)}
                  >
                    <Cover book={b} width={44} />
                    <div className="book-row__body">
                      <div className="book-row__title">{b.title}</div>
                      <div className="book-row__sub">
                        {[b.author, b.year].filter(Boolean).join(" · ")}
                      </div>
                    </div>
                    {entry && (
                      <span className={`pill ${entry.status === "ranked" ? "pill--ink" : "pill--cobalt"}`}>
                        {entry.status === "ranked" ? "Ranked" : entry.status === "want" ? "Saved" : "To rank"}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </main>

      {picked && (
        <div className="sheet-backdrop" onClick={() => !busy && setPicked(null)}>
          <div className="sheet" role="dialog" aria-modal="true" aria-label={picked.title} onClick={(e) => e.stopPropagation()}>
            <div className="sheet__grab" />
            <div style={{ display: "flex", gap: 16, alignItems: "flex-end" }}>
              <Cover book={picked} width={96} />
              <div style={{ minWidth: 0 }}>
                <h2 className="d" style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.05 }}>
                  {picked.title}
                </h2>
                <p className="muted" style={{ margin: "4px 0 0", fontSize: 14 }}>
                  {[picked.author, picked.year, picked.pages ? `${picked.pages} pages` : null].filter(Boolean).join(" · ")}
                </p>
              </div>
            </div>
            <div className="stack" style={{ marginTop: 22 }}>
              <button className="btn btn--block" disabled={busy} onClick={() => rank(picked)}>
                {pickedEntry?.status === "ranked" ? "Re-rank it" : "I’ve read it — rank it"}
              </button>
              {(!pickedEntry || pickedEntry.status !== "want") && pickedEntry?.status !== "ranked" && (
                <button className="btn btn--outline btn--block" disabled={busy} onClick={() => want(picked)}>
                  <BookmarkIcon size={16} /> Want to read
                </button>
              )}
              {pickedEntry?.status === "want" && (
                <p className="muted" style={{ textAlign: "center", fontSize: 14, margin: "4px 0 0" }}>On your want-to-read list</p>
              )}
            </div>
          </div>
        </div>
      )}
      <TabBar />
    </div>
  );
}
