"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/Auth";
import { Cover } from "@/components/Cover";
import { ArrowIcon, FileIcon, SearchIcon } from "@/components/icons";
import { dedupeKey, type BookInput } from "@/lib/books";
import { addToRank, ensureBooks } from "@/lib/data";
import { lookup, searchBooks } from "@/lib/openlibrary";
import { setQueue } from "@/lib/queue";

export default function StartPage() {
  return (
    <RequireAuth>
      <Start />
    </RequireAuth>
  );
}

/** Widely read books across genres, so most people recognise a handful. */
const POPULAR: Array<[string, string]> = [
  ["To Kill a Mockingbird", "Harper Lee"],
  ["1984", "George Orwell"],
  ["Pride and Prejudice", "Jane Austen"],
  ["The Great Gatsby", "F. Scott Fitzgerald"],
  ["Harry Potter and the Sorcerer's Stone", "J.K. Rowling"],
  ["The Hunger Games", "Suzanne Collins"],
  ["The Hobbit", "J.R.R. Tolkien"],
  ["The Catcher in the Rye", "J.D. Salinger"],
  ["Where the Crawdads Sing", "Delia Owens"],
  ["Project Hail Mary", "Andy Weir"],
  ["The Martian", "Andy Weir"],
  ["Gone Girl", "Gillian Flynn"],
  ["The Seven Husbands of Evelyn Hugo", "Taylor Jenkins Reid"],
  ["Educated", "Tara Westover"],
  ["Sapiens", "Yuval Noah Harari"],
  ["Atomic Habits", "James Clear"],
  ["The Midnight Library", "Matt Haig"],
  ["The Book Thief", "Markus Zusak"],
  ["The Kite Runner", "Khaled Hosseini"],
  ["Dune", "Frank Herbert"],
  ["Normal People", "Sally Rooney"],
  ["A Court of Thorns and Roses", "Sarah J. Maas"],
  ["It Ends with Us", "Colleen Hoover"],
  ["The Alchemist", "Paulo Coelho"],
  ["Lessons in Chemistry", "Bonnie Garmus"],
  ["Fourth Wing", "Rebecca Yarros"],
  ["The Silent Patient", "Alex Michaelides"],
  ["Circe", "Madeline Miller"],
  ["Little Women", "Louisa May Alcott"],
  ["Of Mice and Men", "John Steinbeck"],
  ["The Handmaid's Tale", "Margaret Atwood"],
  ["Born a Crime", "Trevor Noah"],
  ["The Road", "Cormac McCarthy"],
  ["Tomorrow, and Tomorrow, and Tomorrow", "Gabrielle Zevin"],
  ["The Fellowship of the Ring", "J.R.R. Tolkien"],
  ["Little Fires Everywhere", "Celeste Ng"],
];

const CACHE = "spine:popular-books";
const TARGET = 10;

function Start() {
  const router = useRouter();
  const [books, setBooks] = useState<BookInput[]>(() => POPULAR.map(([title, author]) => ({ title, author })));
  const [picked, setPicked] = useState<Map<string, BookInput>>(new Map());
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<BookInput[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fill in real covers (cached for the session so it's quick next time).
  useEffect(() => {
    let cancelled = false;
    try {
      const cached = JSON.parse(sessionStorage.getItem(CACHE) || "null");
      if (Array.isArray(cached) && cached.length === POPULAR.length) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- restoring a session cache
        setBooks(cached);
        return;
      }
    } catch {}
    (async () => {
      const out: BookInput[] = POPULAR.map(([title, author]) => ({ title, author }));
      let next = 0;
      async function worker() {
        while (!cancelled && next < POPULAR.length) {
          const i = next++;
          try {
            const found = await lookup(POPULAR[i][0], POPULAR[i][1]);
            if (found) out[i] = { ...found, title: POPULAR[i][0], author: found.author ?? POPULAR[i][1] };
          } catch {}
        }
      }
      await Promise.all(Array.from({ length: 6 }, worker));
      if (cancelled) return;
      setBooks(out);
      try { sessionStorage.setItem(CACHE, JSON.stringify(out)); } catch {}
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const ctrl = new AbortController();
    const t = setTimeout(() => searchBooks(q, ctrl.signal, (r) => !ctrl.signal.aborted && setResults(r.slice(0, 9))).catch(() => {}), 300);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [query]);

  function toggle(b: BookInput) {
    const key = dedupeKey(b.title, b.author);
    setPicked((prev) => {
      const next = new Map(prev);
      if (next.has(key)) next.delete(key);
      else next.set(key, b);
      return next;
    });
  }

  async function go() {
    setBusy(true);
    setError(null);
    try {
      const chosen = [...picked.values()];
      const ids = await ensureBooks(chosen);
      const bookIds = chosen.map((b) => ids.get(dedupeKey(b.title, b.author))).filter((x): x is string => Boolean(x));
      await addToRank(bookIds);
      setQueue(bookIds);
      router.push(`/rank/${bookIds[0]}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn’t save those");
      setBusy(false);
    }
  }

  const shown = query.trim().length >= 2 && results ? results : books;
  const count = picked.size;

  return (
    <div className="app">
      <main className="screen screen--flow" style={{ paddingBottom: 120 }}>
        <span className="wordmark">readread</span>
        <h1 className="h1 h1--xl" style={{ marginTop: 32 }}>Let&rsquo;s build your shelf.</h1>

        <Link href="/import" className="card card--ink" style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 24, textDecoration: "none" }}>
          <span className="icon-btn" style={{ background: "#2a2a2a", color: "#fff", borderRadius: 12 }}><FileIcon /></span>
          <span style={{ flex: 1 }}>
            <span style={{ display: "block", fontWeight: 600 }}>Coming from Goodreads or StoryGraph?</span>
            <span style={{ display: "block", fontSize: 13, color: "#c9c8c2", marginTop: 2 }}>Bring your whole library in one upload</span>
          </span>
          <ArrowIcon size={18} />
        </Link>

        <h2 className="h2" style={{ marginTop: 24 }}>Or tap books you&rsquo;ve read</h2>
        <p className="muted" style={{ margin: "4px 0 0", fontSize: 14 }}>
          Pick {TARGET} or so and you&rsquo;ll unlock taste match and picks for you. You&rsquo;ll rank them next.
        </p>

        <div className="search-box">
          <SearchIcon size={20} />
          <label htmlFor="sq" className="visually-hidden">Search for a book you’ve read</label>
          <input id="sq" className="input" type="search" placeholder="Find another book" value={query} onChange={(e) => setQuery(e.target.value)} autoComplete="off" />
        </div>

        <ul style={{ listStyle: "none", padding: 0, margin: "16px 0 0", display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "16px 12px" }}>
          {shown.map((b) => {
            const on = picked.has(dedupeKey(b.title, b.author));
            return (
              <li key={dedupeKey(b.title, b.author)}>
                <button
                  onClick={() => toggle(b)}
                  aria-pressed={on}
                  style={{ width: "100%", background: "none", border: 0, padding: 0, textAlign: "left", position: "relative" }}
                >
                  <span style={{ display: "block", borderRadius: 8, outline: on ? "3px solid var(--accent)" : "none", outlineOffset: 2, opacity: on ? 1 : 0.92 }}>
                    <Cover book={b} width={104} />
                  </span>
                  {on && (
                    <span aria-hidden="true" className="score score--top" style={{ position: "absolute", top: -6, right: -6, width: 26, height: 26, fontSize: 14 }}>✓</span>
                  )}
                  <span className="book-row__title" style={{ display: "block", fontSize: 13, marginTop: 8 }}>{b.title}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </main>

      <div className="tabbar" style={{ padding: "12px 16px 18px" }}>
        <div style={{ maxWidth: "var(--col)", margin: "0 auto", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div className="bar" style={{ height: 6 }}><span style={{ width: `${Math.min(1, count / TARGET) * 100}%`, background: "var(--accent)" }} /></div>
            <div className="m muted" style={{ fontSize: 12, marginTop: 8 }}>{count} picked{count < TARGET ? ` · ${TARGET - count} to unlock taste match` : " · taste match unlocked"}</div>
          </div>
          <button className="btn" disabled={!count || busy} onClick={go}>
            {busy ? "Saving…" : `Rank ${count || ""}`}
          </button>
        </div>
        {error && <p className="error" role="alert" style={{ textAlign: "center" }}>{error}</p>}
        <div style={{ textAlign: "center", marginTop: 8 }}>
          <Link href="/feed" style={{ fontSize: 13, color: "var(--muted)" }}>Skip for now</Link>
        </div>
      </div>
    </div>
  );
}
