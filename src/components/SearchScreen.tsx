"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { dedupeKey, type Book, type BookInput } from "@/lib/books";
import { addToWant, ensureBook, recommendations, startReading, type Entry } from "@/lib/data";
import { WeeklyPicks } from "@/components/WeeklyPicks";
import { searchBooks } from "@/lib/openlibrary";
import { formatScore } from "@/lib/ranking";
import { TASTE_UNLOCK } from "@/lib/stats";
import { RequireAuth } from "./Auth";
import { Cover } from "./Cover";
import { AddFriendIcon, ArrowIcon, BookmarkIcon, BookOpenIcon, ScanIcon, SearchIcon } from "./icons";
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
  const [recs, setRecs] = useState<Array<{ book: Book; predicted: number; basis: number }> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const byKey = useMemo(() => {
    const m = new Map<string, Entry>();
    for (const e of entries || []) {
      m.set(e.book.dedupe_key, e);
      // Same work, even if its title was saved a little differently (series tags, editions).
      if (e.book.ol_work_key) m.set(`w:${e.book.ol_work_key}`, e);
    }
    return m;
  }, [entries]);
  const entryFor = (b: BookInput) =>
    byKey.get(dedupeKey(b.title, b.author)) ?? (b.ol_work_key ? byKey.get(`w:${b.ol_work_key}`) : undefined);
  const rankedCount = (entries || []).filter((e) => e.status === "ranked").length;
  const reading = (entries || []).filter((e) => e.status === "reading");

  useEffect(() => {
    if (mode === "add") inputRef.current?.focus();
  }, [mode]);

  useEffect(() => {
    if (mode !== "discover") return;
    recommendations(12).then(setRecs).catch(() => setRecs([]));
  }, [mode]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2 || q.startsWith("@")) return;
    const ctrl = new AbortController();
    // Show the loading bar from the first keystroke, not after the debounce.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSearching(true);
    setError(null);
    const t = setTimeout(async () => {
      try {
        await searchBooks(q, ctrl.signal, (books, final) => {
          if (ctrl.signal.aborted) return;
          setResults(books);
          if (final) setSearching(false);
        });
      } catch (e) {
        if (!ctrl.signal.aborted) {
          setError(e instanceof Error ? e.message : "Search failed");
          setSearching(false);
        }
      }
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query]);

  async function act(book: BookInput, what: "rank" | "reading" | "want" | "page") {
    setBusy(true);
    setError(null);
    try {
      // A book already on your shelf keeps its id, so nothing gets duplicated.
      const id = entryFor(book)?.book_id ?? (await ensureBook(book));
      if (what === "rank") return router.push(`/rank/${id}`);
      if (what === "page") return router.push(`/book/${id}`);
      if (what === "reading") await startReading(id);
      else await addToWant(id);
      await reload();
      setPicked(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn’t save that");
    } finally {
      setBusy(false);
    }
  }

  // Short queries show the prompt instead of stale results.
  const results = query.trim().length >= 2 && !query.trim().startsWith("@") ? rawResults : null;
  // Books already on your shelf show up instantly, before the catalogue answers.
  const term = query.trim().toLowerCase();
  const onShelf = term.length >= 2
    ? (entries || []).filter((e) => `${e.book.title} ${e.book.author ?? ""}`.toLowerCase().includes(term)).slice(0, 3)
    : [];
  const pickedEntry = picked ? entryFor(picked) : undefined;

  return (
    <div className="app">
      <main className="screen">
        <div className="topbar">
          <h1 className="h1">{mode === "add" ? "What did you finish?" : "Discover"}</h1>
          <div style={{ display: "flex", gap: 8 }}>
            {mode === "discover" && (
              <Link href="/people" className="icon-btn" aria-label="Find friends">
                <AddFriendIcon size={21} />
              </Link>
            )}
            <Link href="/scan" className="icon-btn" aria-label="Scan a barcode">
              <ScanIcon size={20} />
            </Link>
          </div>
        </div>
        <div className="search-box">
          <SearchIcon size={20} />
          <label htmlFor="q" className="visually-hidden">Search by title or author</label>
          <input
            id="q"
            ref={inputRef}
            className="input"
            type="search"
            placeholder={mode === "discover" ? "Title, author, or @friend" : "Title or author"}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
          />
        </div>

        {/* "@sam" is a person, not a book: send it to people search. */}
        {query.trim().startsWith("@") && query.trim().length >= 2 && (
          <Link href={`/people?q=${encodeURIComponent(query.trim().slice(1))}`} className="card" style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none", marginTop: 12, padding: "14px 16px" }}>
            <AddFriendIcon size={20} />
            <span style={{ flex: 1, fontWeight: 600 }}>Find people named {query.trim()}</span>
            <ArrowIcon size={18} />
          </Link>
        )}
        <div className="search-progress" data-on={searching && term.length >= 2} aria-hidden="true"><span /></div>
        {error && <p className="error" role="alert">{error}</p>}

        {onShelf.length > 0 && (
          <section aria-label="On your shelf" style={{ marginTop: 10 }}>
            <h2 className="eyebrow" style={{ margin: "6px 0 0" }}>On your shelf</h2>
            <ul style={{ listStyle: "none", margin: "2px 0 0", padding: 0 }}>
              {onShelf.map((e) => (
                <li key={e.id}>
                  <Link href={`/book/${e.book_id}`} className="book-row">
                    <Cover book={e.book} width={36} />
                    <span className="book-row__body">
                      <span className="book-row__title" style={{ display: "block", fontSize: 15 }}>{e.book.title}</span>
                      <span className="book-row__sub" style={{ display: "block" }}>{e.book.author}</span>
                    </span>
                    <span className={`pill ${e.status === "ranked" ? "pill--ink" : "pill--cobalt"}`}>
                      {{ ranked: "Ranked", want: "Saved", reading: "Reading", unsorted: "To rank" }[e.status]}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {results === null ? (
          mode === "add" ? (
            <>
              {reading.length > 0 && (
                <>
                  <h2 className="h2" style={{ marginTop: 22 }}>Finished one of these?</h2>
                  <ul style={{ listStyle: "none", margin: "4px 0 0", padding: 0 }}>
                    {reading.map((e) => (
                      <li key={e.id}>
                        <Link href={`/rank/${e.book_id}`} className="book-row">
                          <Cover book={e.book} width={44} />
                          <span className="book-row__body">
                            <span className="book-row__title" style={{ display: "block" }}>{e.book.title}</span>
                            <span className="book-row__sub" style={{ display: "block" }}>{e.book.author}</span>
                          </span>
                          <span className="pill pill--ink">Rank</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              <div className="empty">
                <p className="h2">Rank a book in a few taps</p>
                <p style={{ margin: 0, fontSize: 14 }}>
                  Search above, <Link href="/scan" style={{ fontWeight: 600 }}>scan a barcode</Link>, or{" "}
                  <Link href="/import" style={{ fontWeight: 600 }}>bring in your Goodreads or StoryGraph shelf</Link>.
                </p>
              </div>
            </>
          ) : (
            <>
              <WeeklyPicks />
              <Recommendations recs={recs} rankedCount={rankedCount} />
            </>
          )
        ) : results.length === 0 && searching ? (
          <ul style={{ listStyle: "none", margin: "8px 0 0", padding: 0 }} aria-busy="true" aria-label="Searching">
            {[0, 1, 2, 3, 4].map((i) => (
              <li key={i} className="book-row skeleton-row" style={{ animationDelay: `${i * 0.08}s` }}>
                <span className="skeleton" style={{ width: 44, height: 66, borderRadius: 4 }} />
                <span style={{ flex: 1 }}>
                  <span className="skeleton" style={{ display: "block", width: `${70 - i * 7}%`, height: 14 }} />
                  <span className="skeleton" style={{ display: "block", width: "40%", height: 12, marginTop: 8 }} />
                </span>
              </li>
            ))}
          </ul>
        ) : results.length === 0 && !searching ? (
          <div className="empty">
            <p className="h2">{onShelf.length ? "Nothing else in the catalogue" : "No matches"}</p>
            <p style={{ margin: 0, fontSize: 14 }}>Try the author&rsquo;s last name, or fewer words.</p>
          </div>
        ) : (
          <ul style={{ listStyle: "none", margin: "8px 0 0", padding: 0 }} aria-busy={searching}>
            {results.map((b) => {
              const entry = entryFor(b);
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
                      <div className="book-row__sub">{[b.author, b.year].filter(Boolean).join(" · ")}</div>
                    </div>
                    {entry && (
                      <span className={`pill ${entry.status === "ranked" ? "pill--ink" : "pill--cobalt"}`}>
                        {{ ranked: "Ranked", want: "Saved", reading: "Reading", unsorted: "To rank" }[entry.status]}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <Link href="/people" className="card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", textDecoration: "none", marginTop: 20, padding: "16px 18px" }}>
          <span style={{ fontWeight: 600 }}>Find friends on readread</span>
          <ArrowIcon size={18} />
        </Link>
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
                <button className="btn btn--ghost" style={{ minHeight: 36, padding: 0, marginTop: 6, fontSize: 14, color: "var(--cobalt-ink)" }} disabled={busy} onClick={() => act(picked, "page")}>
                  See friends &amp; scores →
                </button>
              </div>
            </div>
            <div className="stack" style={{ marginTop: 18 }}>
              <button className="btn btn--block" disabled={busy} onClick={() => act(picked, "rank")}>
                {pickedEntry?.status === "ranked" ? "Re-rank it" : pickedEntry?.status === "reading" ? "Finished — rank it" : "I’ve read it — rank it"}
              </button>
              {(!pickedEntry || pickedEntry.status === "want") && (
                <button className="btn btn--outline btn--block" disabled={busy} onClick={() => act(picked, "reading")}>
                  <BookOpenIcon size={18} /> Reading it now
                </button>
              )}
              {!pickedEntry && (
                <button className="btn btn--quiet btn--block" disabled={busy} onClick={() => act(picked, "want")}>
                  <BookmarkIcon size={16} /> Want to read
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      <TabBar />
    </div>
  );
}

function Recommendations({ recs, rankedCount }: { recs: Array<{ book: Book; predicted: number; basis: number }> | null; rankedCount: number }) {
  if (rankedCount < TASTE_UNLOCK) {
    const left = TASTE_UNLOCK - rankedCount;
    return (
      <div className="card card--ink" style={{ marginTop: 20 }}>
        <div className="eyebrow" style={{ color: "#c9c8c2" }}>For you</div>
        <p className="d" style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.03em", margin: "6px 0 0", lineHeight: 1.05 }}>
          Rank {left} more book{left === 1 ? "" : "s"} to unlock picks made for your taste.
        </p>
        <div className="bar" style={{ marginTop: 14, background: "#2a2a2a" }}>
          <span style={{ width: `${(rankedCount / TASTE_UNLOCK) * 100}%`, background: "var(--accent)" }} />
        </div>
        <Link href="/add" className="btn btn--block" style={{ marginTop: 16, background: "#fff", color: "var(--ink)" }}>Rank a book</Link>
      </div>
    );
  }
  if (!recs) return <div aria-busy="true" style={{ minHeight: 120 }} />;
  if (!recs.length) {
    return (
      <div className="empty">
        <p className="h2">Picks are warming up</p>
        <p style={{ margin: 0, fontSize: 14 }}>As more readers rank books you&rsquo;ve read, we&rsquo;ll find what they loved that you haven&rsquo;t.</p>
      </div>
    );
  }
  return (
    <>
      <h2 className="h2" style={{ marginTop: 22 }}>For you</h2>
      <p className="muted" style={{ margin: "2px 0 0", fontSize: 13 }}>Loved by readers who rank like you</p>
      <ul style={{ listStyle: "none", margin: "6px 0 0", padding: 0 }}>
        {recs.map((r) => (
          <li key={r.book.id}>
            <Link href={`/book/${r.book.id}`} className="book-row">
              <Cover book={r.book} width={44} />
              <span className="book-row__body">
                <span className="book-row__title" style={{ display: "block" }}>{r.book.title}</span>
                <span className="book-row__sub" style={{ display: "block" }}>{r.book.author}</span>
              </span>
              <span className="pill pill--cobalt m" style={{ fontWeight: 700 }}>~{formatScore(r.predicted)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
