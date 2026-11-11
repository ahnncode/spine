"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { dedupeKey, type Book, type BookInput } from "@/lib/books";
import { addToWant, ensureBook, fetchShelf, rankEntries, recommendations, startReading, STATUS_LABEL, type Entry } from "@/lib/data";
import { WeeklyPicks } from "@/components/WeeklyPicks";
import { YourClubs } from "@/components/YourClubs";
import { CheckInSheet } from "@/components/CheckInSheet";
import { searchBooks } from "@/lib/openlibrary";
import { formatScore } from "@/lib/ranking";
import { TASTE_UNLOCK } from "@/lib/stats";
import { RequireAuth } from "./Auth";
import { Cover } from "./Cover";
import { AddFriendIcon, ArrowIcon, BookmarkIcon, BookOpenIcon, ScanIcon, SearchIcon } from "./icons";
import { TabBar } from "./TabBar";
import { useShelf } from "./useShelf";
import { RowsSkeleton } from "@/components/Skeleton";

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
  const [checking, setChecking] = useState<Entry | null>(null);
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
  const myRanks = useMemo(() => new Map(rankEntries(entries || []).map((e) => [e.book_id, e])), [entries]);

  // Opening this screen again ("Rank another"): start fresh, not on the last search.
  // (The app keeps recent screens alive in the background, so state would survive.)
  useEffect(() => {
    if (mode !== "add") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setQuery("");
    setResults(null);
    setPicked(null);
  }, [mode]);
  const reading = (entries || []).filter((e) => e.status === "reading");
  const [recent, setRecent] = useState<BookInput[]>([]);
  useEffect(() => {
    if (mode !== "add") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- per-viewer convenience from this browser
    setRecent(readRecent());
  }, [mode]);

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
    rememberBook(book);
    setBusy(true);
    setError(null);
    try {
      // A book already on your shelf keeps its id, so nothing gets duplicated.
      const id = entryFor(book)?.book_id ?? (await ensureBook(book));
      if (what === "rank") return router.push(`/rank/${id}`);
      if (what === "page") return router.push(`/book/${id}`);
      if (what === "reading") {
        await startReading(id);
        // Straight into the first check-in: where you are, how it's going.
        const shelf = await fetchShelf();
        const started = shelf.find((e) => e.book_id === id && e.status === "reading");
        await reload();
        setPicked(null);
        if (started) setChecking(started);
        return;
      }
      await addToWant(id);
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
          <h1 className="h1">{mode === "add" ? "Add a book" : "Discover"}</h1>
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
        {mode === "add" && <p className="muted" style={{ margin: "4px 0 0", fontSize: 14 }}>Finished it, reading it, or saving it for later.</p>}
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
          {query && (
            <button type="button" className="search-clear" aria-label="Clear search" onClick={() => { setQuery(""); inputRef.current?.focus(); }}>
              <span aria-hidden="true">×</span>
            </button>
          )}
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
          <section aria-label="On your shelf" style={{ marginTop: 12 }}>
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
                      {STATUS_LABEL[e.status]}
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
                  <h2 className="h2" style={{ marginTop: 24 }}>Finished one of these?</h2>
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
              {recent.length > 0 && (
                <>
                  <h2 className="h2" style={{ marginTop: 24 }}>Recently looked up</h2>
                  <ul style={{ listStyle: "none", margin: "4px 0 0", padding: 0 }}>
                    {recent.map((b) => {
                      const entry = entryFor(b);
                      return (
                        <li key={(b.ol_work_key || "") + b.title}>
                          <button className="book-row" style={{ width: "100%", background: "none", border: 0, borderBottom: "1px solid var(--line)", textAlign: "left" }}
                            onClick={() => (entry && ["ranked", "paused", "dropped"].includes(entry.status) ? act(b, "page") : setPicked(b))}>
                            <Cover book={b} width={44} />
                            <span className="book-row__body">
                              <span className="book-row__title" style={{ display: "block" }}>{b.title}</span>
                              <span className="book-row__sub" style={{ display: "block" }}>{b.author}</span>
                            </span>
                            {entry && <span className={`pill ${entry.status === "ranked" ? "pill--ink" : "pill--cobalt"}`}>{STATUS_LABEL[entry.status]}</span>}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
              <div className="empty">
                <p className="h2">Log a book in a few taps</p>
                <p style={{ margin: 0, fontSize: 14 }}>
                  Search above, <Link href="/scan" style={{ fontWeight: 600 }}>scan a barcode</Link>, or{" "}
                  <Link href="/import" style={{ fontWeight: 600 }}>bring in your Goodreads or StoryGraph shelf</Link>.
                </p>
              </div>
            </>
          ) : (
            <>
              <WeeklyPicks />
              {mode === "discover" && <YourClubs where="discover" />}
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
                    // Already ranked: go to its page (re-rank lives there) instead of asking again.
                    onClick={() => (entry && ["ranked", "paused", "dropped"].includes(entry.status) ? act(b, "page") : setPicked(b))}
                  >
                    <Cover book={b} width={44} />
                    <div className="book-row__body">
                      <div className="book-row__title">{b.title}</div>
                      <div className="book-row__sub">{[b.author, b.year].filter(Boolean).join(" · ")}</div>
                    </div>
                    {entry && (
                      <span className={`pill ${entry.status === "ranked" ? "pill--ink" : "pill--cobalt"}`}>
                        {entry.status === "ranked" && myRanks.get(entry.book_id)
                          ? `#${myRanks.get(entry.book_id)!.rank} · ${formatScore(myRanks.get(entry.book_id)!.score)}`
                          : STATUS_LABEL[entry.status]}
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
              <button type="button" onClick={() => act(picked, "page")} disabled={busy} aria-label={`${picked.title}: book page`} style={{ background: "none", border: 0, padding: 0, cursor: "pointer", flexShrink: 0 }}>
                <Cover book={picked} width={96} />
              </button>
              <div style={{ minWidth: 0 }}>
                <h2 className="d" style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: "-0.01em", lineHeight: 1.05 }}>
                  <button type="button" className="link-plain" onClick={() => act(picked, "page")} disabled={busy}>{picked.title}</button>
                </h2>
                <p className="muted" style={{ margin: "4px 0 0", fontSize: 14 }}>
                  {[picked.author, picked.year, picked.pages ? `${picked.pages} pages` : null].filter(Boolean).join(" · ")}
                </p>
                <button className="btn btn--ghost" style={{ minHeight: 36, padding: 0, marginTop: 8, fontSize: 14, color: "var(--cobalt-ink)" }} disabled={busy} onClick={() => act(picked, "page")}>
                  See friends &amp; scores →
                </button>
              </div>
            </div>
            <div className="stack" style={{ marginTop: 20 }}>
              <button className="btn btn--block" disabled={busy} onClick={() => act(picked, "rank")}>
                {pickedEntry?.status === "ranked" ? "Re-rank it" : pickedEntry?.status === "reading" ? "Done? Rank it" : "I’ve read it"}
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
      {checking && (
        <CheckInSheet entry={checking} onClose={() => setChecking(null)} onDone={async () => { await reload(); setChecking(null); }} />
      )}
      <TabBar />
    </div>
  );
}

function Recommendations({ recs, rankedCount }: { recs: Array<{ book: Book; predicted: number; basis: number }> | null; rankedCount: number }) {
  if (rankedCount < TASTE_UNLOCK) {
    const left = TASTE_UNLOCK - rankedCount;
    return (
      <div className="card" style={{ marginTop: 20 }}>
        <div className="eyebrow">For you</div>
        <p className="g" style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.01em", margin: "6px 0 0", lineHeight: 1.05 }}>
          Rank {left} more book{left === 1 ? "" : "s"} to unlock picks made for your taste.
        </p>
        <div className="bar" style={{ marginTop: 16 }}>
          <span style={{ width: `${(rankedCount / TASTE_UNLOCK) * 100}%`, background: "var(--accent)" }} />
        </div>
        <Link href="/add" className="btn btn--block" style={{ marginTop: 16 }}>Rank a book</Link>
      </div>
    );
  }
  if (!recs) return <RowsSkeleton count={3} label="Loading picks for you" />;
  if (!recs.length) {
    return (
      <div className="empty">
        <p className="h2">Picks are warming up</p>
        <p style={{ margin: 0, fontSize: 14 }}>Once more people rank books you&rsquo;ve read, we&rsquo;ll find the ones they loved that you haven&rsquo;t got to.</p>
      </div>
    );
  }
  return (
    <>
      <h2 className="h2" style={{ marginTop: 24 }}>For you</h2>
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

/* Books looked up on the add screen, newest first, kept in this browser only. */
const RECENT_KEY = "readread:recent-books";
function readRecent(): BookInput[] {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
    return Array.isArray(v) ? v.slice(0, 5) : [];
  } catch {
    return [];
  }
}
function rememberBook(b: BookInput) {
  try {
    const key = dedupeKey(b.title, b.author);
    const next = [b, ...readRecent().filter((x) => dedupeKey(x.title, x.author) !== key)].slice(0, 5);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* storage blocked: nothing to remember */
  }
}
