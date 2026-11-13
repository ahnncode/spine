"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { RequireAuth } from "@/components/Auth";
import { Cover } from "@/components/Cover";
import { BackIcon } from "@/components/icons";
import { fetchShelf, rankEntries, setTopPicks, type Entry } from "@/lib/data";

export default function Page() {
  return (
    <RequireAuth>
      <TopTen />
    </RequireAuth>
  );
}

const MAX = 10;

/**
 * After a big import the top of the ranking is Goodreads' order. Here you
 * tap your favorites in order, and they become your real top 10.
 */
function TopTen() {
  const router = useRouter();
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [picks, setPicks] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchShelf().then(setEntries).catch(() => setError("Couldn’t load your shelf. Try again in a moment."));
  }, []);

  // Your loved books, in today's order (stars first), so the likely picks are near the top.
  const loved = useMemo(() => rankEntries(entries ?? []).filter((e) => e.bucket === "loved"), [entries]);
  const unrated = (entries ?? []).filter((e) => e.status === "unsorted").length;
  const next = unrated > 0 ? "/quick-rate" : "/shelf";

  function toggle(bookId: string) {
    setPicks((p) => (p.includes(bookId) ? p.filter((x) => x !== bookId) : p.length < MAX ? [...p, bookId] : p));
  }

  async function save() {
    if (!entries || !picks.length) return;
    setSaving(true);
    setError(null);
    try {
      await setTopPicks(entries, picks);
      router.push(next);
    } catch {
      setError("That didn’t save. Try again.");
      setSaving(false);
    }
  }

  return (
    <div className="app">
      <main className="screen screen--flow" style={{ paddingBottom: 120 }}>
        <div className="topbar">
          <Link href="/shelf" className="icon-btn" aria-label="Back to your shelf"><BackIcon size={20} /></Link>
          <Link href={next} className="btn btn--ghost" style={{ minHeight: 44 }}>Skip</Link>
        </div>
        <h1 className="h1" style={{ marginTop: 12 }}>Pick your top 10</h1>
        <p className="lede">
          Your stars put these books in Loved, but they can&rsquo;t say which is your favorite. Tap your favorite first, then the next. Tap again to take one out.
        </p>

        {entries === null ? (
          <div aria-busy="true" className="spacer" />
        ) : loved.length === 0 ? (
          <p className="muted" style={{ marginTop: 16 }}>No loved books yet. Rank a few and come back.</p>
        ) : (
          <ul className="pick-grid" aria-label="Your loved books">
            {loved.map((e) => {
              const at = picks.indexOf(e.book_id);
              return (
                <li key={e.id}>
                  <button
                    type="button"
                    className="pick-grid__book"
                    aria-pressed={at >= 0}
                    aria-label={at >= 0 ? `${e.book.title}, your number ${at + 1}` : e.book.title}
                    onClick={() => toggle(e.book_id)}
                    disabled={at < 0 && picks.length >= MAX}
                  >
                    <span className="pick-grid__cover">
                      <Cover book={e.book} width={104} />
                      {at >= 0 && <span className="pick-grid__n" aria-hidden="true">{at + 1}</span>}
                    </span>
                    <span className="pick-grid__title">{e.book.title}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <div className="pick-bar">
          {error && <p className="error" role="alert" style={{ margin: "0 0 8px" }}>{error}</p>}
          <button className="btn btn--block" disabled={!picks.length || saving} onClick={save}>
            {saving ? "Saving…" : picks.length === 0 ? "Tap your favorite first" : picks.length < MAX ? `Save my top ${picks.length}` : "Save my top 10"}
          </button>
        </div>
      </main>
    </div>
  );
}
