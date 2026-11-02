"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { RequireAuth, useProfile } from "@/components/Auth";
import { BookActions } from "@/components/BookActions";
import { CheckInSheet } from "@/components/CheckInSheet";
import { Cover } from "@/components/Cover";
import { ArrowIcon, SearchIcon } from "@/components/icons";
import { ScoreChip } from "@/components/ScoreChip";
import { NoteText, TagList } from "@/components/Social";
import { ThoughtsEditor } from "@/components/ThoughtsEditor";
import { TabBar } from "@/components/TabBar";
import { useEnrichment } from "@/components/useEnrichment";
import { useShelf } from "@/components/useShelf";
import { useStreak } from "@/components/useStreak";
import { rankEntries, type Entry, type RankedEntry } from "@/lib/data";
import { GENRES } from "@/lib/genres";

export default function ShelfPage() {
  return (
    <RequireAuth>
      <Shelf />
    </RequireAuth>
  );
}

type Tab = "ranked" | "want" | "unsorted";

function Shelf() {
  const { entries, error, reload } = useShelf();
  const { profile } = useProfile();
  useEnrichment(entries, reload);
  const [tab, setTab] = useState<Tab>("ranked");
  const [genre, setGenre] = useState<string | null>(null);
  const [year, setYear] = useState<string | null>(null);
  const [sheet, setSheet] = useState<Entry | RankedEntry | null>(null);
  const [checking, setChecking] = useState<Entry | null>(null);
  const [editingThoughts, setEditingThoughts] = useState(false);
  const { streak, reloadCheckins } = useStreak(entries);

  const ranked = useMemo(() => rankEntries(entries || []), [entries]);
  const want = useMemo(
    () => (entries || []).filter((e) => e.status === "want").sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [entries],
  );
  const reading = useMemo(() => (entries || []).filter((e) => e.status === "reading"), [entries]);
  const unsorted = useMemo(() => (entries || []).filter((e) => e.status === "unsorted"), [entries]);
  const roughCount = ranked.filter((e) => e.needs_sort).length;

  const genresPresent = useMemo(() => GENRES.filter((g) => ranked.some((e) => e.book.genres?.includes(g.key))), [ranked]);
  const thisYear = String(new Date().getFullYear());
  const shown = ranked.filter(
    (e) => (!genre || e.book.genres?.includes(genre)) && (!year || e.finished_on?.startsWith(year)),
  );

  const tabs: Array<{ id: Tab; label: string; count: number }> = [
    { id: "ranked", label: "Ranked", count: ranked.length },
    { id: "want", label: "Want to read", count: want.length },
  ];
  if (unsorted.length) tabs.push({ id: "unsorted", label: "To rank", count: unsorted.length });

  return (
    <div className="app">
      <main className="screen">
        <div className="topbar">
          <h1 className="h1">Your shelf</h1>
          <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
            {profile?.username && (
              <Link href={`/u/${profile.username}/shelf`} className="btn btn--quiet" style={{ minHeight: 40, fontSize: 14, padding: "0 14px" }}>
                Filter &amp; sort
              </Link>
            )}
            <Link href="/search" className="icon-btn" aria-label="Find a book">
              <SearchIcon size={20} />
            </Link>
          </span>
        </div>

        {reading.length > 0 && (
          <section aria-label="Reading now">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 18 }}>
              <h2 className="eyebrow">Reading now</h2>
              {streak.weeks > 0 && (
                <span className="m" style={{ fontSize: 12, fontWeight: 700, color: streak.activeThisWeek ? "var(--cobalt-ink)" : "var(--accent-ink)" }}>
                  {streak.weeks}-week streak{streak.activeThisWeek ? "" : " · check in to keep it"}
                </span>
              )}
            </div>
            <div className="reading-strip">
              {reading.map((e) => (
                <div key={e.id} className="reading-card">
                  <button onClick={() => setSheet(e)} style={{ background: "none", border: 0, padding: 0 }} aria-label={`${e.book.title} options`}>
                    <Cover book={e.book} width={64} />
                  </button>
                  <div className="reading-card__title">{e.book.title}</div>
                  {e.progress_pct != null && (
                    <div style={{ width: "100%" }} aria-label={`${e.progress_pct}% read`}>
                      <div className="bar" style={{ height: 6 }}><span style={{ width: `${e.progress_pct}%`, background: "var(--accent)" }} /></div>
                      <div className="m muted" style={{ fontSize: 11, marginTop: 4 }}>{e.progress_pct}%</div>
                    </div>
                  )}
                  <button className="small-btn" onClick={() => setChecking(e)}>Check in</button>
                  <Link href={`/rank/${e.book_id}`} style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-2)" }}>Finished? Rank it</Link>
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="segmented" role="tablist" aria-label="Shelf" style={{ marginTop: 16 }}>
          {tabs.map((t) => (
            <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>
              {t.label}
              <span className="count">{t.count}</span>
            </button>
          ))}
        </div>

        {error && <p className="error" role="alert">{error}</p>}
        {!entries && !error && <div aria-busy="true" style={{ minHeight: 200 }} />}

        {entries && entries.length === 0 && (
          <div className="empty">
            <p className="h2">Your shelf is empty</p>
            <p style={{ margin: "0 0 20px", fontSize: 14 }}>Bring your Goodreads history, or rank the last book you finished.</p>
            <div className="stack">
              <Link href="/import" className="btn btn--block">Import from Goodreads</Link>
              <Link href="/start" className="btn btn--outline btn--block">Pick books you&rsquo;ve read</Link>
            </div>
          </div>
        )}

        {entries && entries.length > 0 && tab === "ranked" && (
          <>
            {(genresPresent.length > 1 || ranked.some((e) => e.finished_on?.startsWith(thisYear))) && (
              <div style={{ display: "flex", gap: 8, marginTop: 12, overflowX: "auto", paddingBottom: 2, scrollbarWidth: "none" }}>
                <Chip on={!genre && !year} onClick={() => { setGenre(null); setYear(null); }}>All time</Chip>
                <Chip on={year === thisYear} onClick={() => setYear(year === thisYear ? null : thisYear)}>{thisYear}</Chip>
                {genresPresent.map((g) => (
                  <Chip key={g.key} on={genre === g.key} onClick={() => setGenre(genre === g.key ? null : g.key)}>{g.label}</Chip>
                ))}
              </div>
            )}
            {roughCount > 1 && (
              <Link href="/sharpen" className="card card--ink" style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 14, textDecoration: "none" }}>
                <span className="score score--top d" style={{ width: 44, height: 44, fontSize: 17, fontFamily: "var(--font-display)", fontWeight: 800 }}>
                  {roughCount > 99 ? "99+" : roughCount}
                </span>
                <span style={{ flex: 1 }}>
                  <span style={{ display: "block", fontWeight: 600, fontSize: 15 }}>imported books are only roughly sorted</span>
                  <span style={{ display: "block", fontSize: 13, color: "#c9c8c2", marginTop: 2 }}>Sharpen them with quick matchups</span>
                </span>
                <ArrowIcon size={18} />
              </Link>
            )}
            {shown.length === 0 ? (
              <div className="empty">
                <p className="h2">{ranked.length ? "Nothing here yet" : "Nothing ranked yet"}</p>
                <Link href="/add" className="btn" style={{ marginTop: 12 }}>Rank a book</Link>
              </div>
            ) : (
              <ol style={{ listStyle: "none", margin: "8px 0 0", padding: 0 }}>
                {shown.map((e) => (
                  <li key={e.id}>
                    <button className="book-row" style={rowButton} onClick={() => setSheet(e)}>
                      <span className={`book-row__rank ${e.rank <= 3 ? "book-row__rank--top" : ""}`}>{e.rank}</span>
                      <Cover book={e.book} width={44} />
                      <span className="book-row__body">
                        <span className="book-row__title" style={{ display: "block" }}>{e.book.title}</span>
                        <span className="book-row__sub" style={{ display: "block" }}>{e.book.author}</span>
                        {e.finished_on && (
                          <span className="book-row__sub" style={{ display: "block", fontSize: 12, marginTop: 4 }}>
                            Read {formatDate(e.finished_on)}
                          </span>
                        )}
                      </span>
                      <ScoreChip score={e.score} bucket={e.bucket} />
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </>
        )}

        {entries && entries.length > 0 && tab !== "ranked" && (
          <PlainList
            items={tab === "want" ? want : unsorted}
            emptyTitle={tab === "want" ? "Nothing saved yet" : "All caught up"}
            onOpen={setSheet}
          />
        )}
      </main>

      {sheet && (
        <div className="sheet-backdrop" onClick={() => { setSheet(null); setEditingThoughts(false); }}>
          <div className="sheet" role="dialog" aria-modal="true" aria-label={sheet.book.title} onClick={(ev) => ev.stopPropagation()}>
            <div className="sheet__grab" />
            <div style={{ display: "flex", gap: 16, alignItems: "flex-end" }}>
              <Cover book={sheet.book} width={84} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <h2 className="d" style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.05 }}>{sheet.book.title}</h2>
                <p className="muted" style={{ margin: "4px 0 0", fontSize: 14 }}>{sheet.book.author}</p>
                <Link href={`/book/${sheet.book_id}`} style={{ display: "inline-block", marginTop: 6, fontSize: 14, fontWeight: 600, color: "var(--cobalt-ink)", textDecoration: "none" }}>
                  See friends &amp; scores →
                </Link>
              </div>
              {"score" in sheet && <ScoreChip score={sheet.score} bucket={sheet.bucket} size={52} />}
            </div>
            {sheet.status === "ranked" && (
              <div style={{ marginTop: 16 }}>
                {editingThoughts ? (
                  <ThoughtsEditor
                    entry={sheet}
                    compact
                    onSaved={async () => { await reload(); setEditingThoughts(false); setSheet(null); }}
                  />
                ) : (
                  <>
                    {(sheet.tags?.length > 0 || sheet.note) && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
                        <TagList tags={sheet.tags} />
                        {sheet.note && <NoteText note={sheet.note} spoiler={sheet.note_spoiler} mine />}
                      </div>
                    )}
                    <button className="btn btn--quiet btn--block" onClick={() => setEditingThoughts(true)}>
                      {sheet.note || sheet.tags?.length ? "Edit your thoughts" : "Add your thoughts"}
                    </button>
                  </>
                )}
              </div>
            )}
            {!editingThoughts && (
              <div style={{ marginTop: 10 }}>
                <BookActions bookId={sheet.book_id} entry={sheet} onChange={async () => { await reload(); setSheet(null); }} />
              </div>
            )}
          </div>
        </div>
      )}
      {checking && (
        <CheckInSheet
          entry={checking}
          onClose={() => setChecking(null)}
          onDone={async () => { await Promise.all([reload(), reloadCheckins()]); setChecking(null); }}
        />
      )}
      <TabBar />
    </div>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      style={{
        flexShrink: 0, minHeight: 36, padding: "0 14px", borderRadius: 18, fontSize: 13, fontWeight: 600,
        border: on ? 0 : "1px solid var(--line-2)", background: on ? "var(--ink)" : "transparent", color: on ? "#fff" : "var(--ink)",
      }}
    >
      {children}
    </button>
  );
}

const rowButton = {
  width: "100%",
  background: "none",
  border: 0,
  borderBottom: "1px solid var(--line)",
  textAlign: "left" as const,
};

function PlainList({ items, emptyTitle, onOpen }: { items: Entry[]; emptyTitle: string; onOpen: (e: Entry) => void }) {
  if (items.length === 0) {
    return (
      <div className="empty">
        <p className="h2">{emptyTitle}</p>
        <Link href="/search" style={{ fontWeight: 600, fontSize: 14 }}>Find a book</Link>
      </div>
    );
  }
  return (
    <ul style={{ listStyle: "none", margin: "8px 0 0", padding: 0 }}>
      {items.map((e) => (
        <li key={e.id}>
          <button className="book-row" style={rowButton} onClick={() => onOpen(e)}>
            <Cover book={e.book} width={44} />
            <span className="book-row__body">
              <span className="book-row__title" style={{ display: "block" }}>{e.book.title}</span>
              <span className="book-row__sub" style={{ display: "block" }}>{e.book.author}</span>
            </span>
            <span className="pill">{e.status === "want" ? "Options" : "Rank"}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const sameYear = y === new Date().getFullYear();
  return date.toLocaleDateString(undefined, sameYear ? { month: "short", day: "numeric" } : { month: "short", year: "numeric" });
}
