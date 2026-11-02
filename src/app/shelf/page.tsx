"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { RequireAuth } from "@/components/Auth";
import { Cover } from "@/components/Cover";
import { ArrowIcon, SearchIcon } from "@/components/icons";
import { ScoreChip } from "@/components/ScoreChip";
import { TabBar } from "@/components/TabBar";
import { useShelf } from "@/components/useShelf";
import { rankEntries, removeEntry, type Entry, type RankedEntry } from "@/lib/data";

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
  const [tab, setTab] = useState<Tab>("ranked");
  const [sheet, setSheet] = useState<Entry | RankedEntry | null>(null);
  const [busy, setBusy] = useState(false);

  const ranked = useMemo(() => rankEntries(entries || []), [entries]);
  const want = useMemo(
    () => (entries || []).filter((e) => e.status === "want").sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [entries],
  );
  const unsorted = useMemo(() => (entries || []).filter((e) => e.status === "unsorted"), [entries]);
  const roughCount = ranked.filter((e) => e.needs_sort).length;

  async function remove(e: Entry) {
    setBusy(true);
    try {
      await removeEntry(e.id);
      await reload();
      setSheet(null);
    } finally {
      setBusy(false);
    }
  }

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
          <Link href="/search" className="icon-btn" aria-label="Find a book">
            <SearchIcon size={20} />
          </Link>
        </div>

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
              <Link href="/add" className="btn btn--outline btn--block">Rank a book</Link>
            </div>
          </div>
        )}

        {entries && entries.length > 0 && tab === "ranked" && (
          <>
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
            {ranked.length === 0 ? (
              <div className="empty">
                <p className="h2">Nothing ranked yet</p>
                <Link href="/add" className="btn" style={{ marginTop: 12 }}>Rank a book</Link>
              </div>
            ) : (
              <ol style={{ listStyle: "none", margin: "8px 0 0", padding: 0 }}>
                {ranked.map((e) => (
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
        <div className="sheet-backdrop" onClick={() => !busy && setSheet(null)}>
          <div className="sheet" role="dialog" aria-modal="true" aria-label={sheet.book.title} onClick={(ev) => ev.stopPropagation()}>
            <div className="sheet__grab" />
            <div style={{ display: "flex", gap: 16, alignItems: "flex-end" }}>
              <Cover book={sheet.book} width={84} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <h2 className="d" style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.05 }}>{sheet.book.title}</h2>
                <p className="muted" style={{ margin: "4px 0 0", fontSize: 14 }}>{sheet.book.author}</p>
              </div>
              {"score" in sheet && <ScoreChip score={sheet.score} bucket={sheet.bucket} size={52} />}
            </div>
            <div className="stack" style={{ marginTop: 22 }}>
              <Link href={`/rank/${sheet.book_id}`} className="btn btn--block">
                {sheet.status === "ranked" ? "Re-rank" : "I’ve read it — rank it"}
              </Link>
              <button className="btn btn--ghost btn--block" disabled={busy} onClick={() => remove(sheet)}>
                Remove from shelf
              </button>
            </div>
          </div>
        </div>
      )}
      <TabBar />
    </div>
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
            <span className="pill">Rank</span>
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
