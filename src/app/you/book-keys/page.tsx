"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/Auth";
import { BackIcon } from "@/components/icons";
import { dedupeKey } from "@/lib/books";
import { adminBooksPage, adminClearRekey, adminStageRekey, isAdmin } from "@/lib/data";

export default function Page() {
  return (
    <RequireAuth>
      <BookKeysPage />
    </RequireAuth>
  );
}

interface Change {
  id: string;
  title: string;
  author: string | null;
  from: string;
  to: string;
}

/**
 * One-off admin tool for the new book-matching rules (REA-103). Works out
 * every book's new key here in the browser, with the same code the app uses,
 * and stages the ones that change. The SQL Editor then applies them with
 * apply_book_rekey(), which also merges books that turn out to be the same.
 */
function BookKeysPage() {
  const [admin, setAdmin] = useState<boolean | null>(null);
  const [total, setTotal] = useState(0);
  const [changes, setChanges] = useState<Change[] | null>(null);
  const [staged, setStaged] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    isAdmin().then(setAdmin);
  }, []);

  async function check() {
    setBusy(true);
    setError(null);
    setStaged(null);
    try {
      const found: Change[] = [];
      let after: string | null = null;
      let seen = 0;
      for (;;) {
        const page = await adminBooksPage(after);
        if (page.length === 0) break;
        for (const b of page) {
          const to = dedupeKey(b.title, b.author);
          if (to !== b.dedupe_key) found.push({ id: b.id, title: b.title, author: b.author, from: b.dedupe_key, to });
        }
        seen += page.length;
        setTotal(seen);
        after = page[page.length - 1].id;
      }
      setChanges(found);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read the catalogue");
    }
    setBusy(false);
  }

  async function stage() {
    if (!changes) return;
    setBusy(true);
    setError(null);
    try {
      await adminClearRekey();
      setStaged(await adminStageRekey(changes.map((c) => ({ id: c.id, key: c.to }))));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't stage the keys");
    }
    setBusy(false);
  }

  // New keys shared by more than one book: these will be merged.
  const merging = (() => {
    if (!changes) return 0;
    const counts = new Map<string, number>();
    for (const c of changes) counts.set(c.to, (counts.get(c.to) ?? 0) + 1);
    return [...counts.values()].filter((n) => n > 1).reduce((a, n) => a + n - 1, 0);
  })();

  return (
    <div className="app">
      <main className="screen screen--flow" style={{ paddingTop: 12 }}>
        <Link href="/you" className="icon-btn" aria-label="Back"><BackIcon size={20} /></Link>
        <h1 className="h1" style={{ marginTop: 12 }}>Book keys</h1>

        {admin === false ? (
          <p className="lede">This page is only for admins.</p>
        ) : (
          <>
            <p className="lede">
              Works out every book&rsquo;s match key with the new rules and stages the ones that change. Then run{" "}
              <code>select * from public.apply_book_rekey();</code> in the Supabase SQL Editor to apply them.
            </p>

            <div style={{ display: "flex", gap: 8, marginTop: 20, flexWrap: "wrap" }}>
              <button className="btn btn--outline" onClick={check} disabled={busy || !admin}>
                {busy && !changes ? `Reading… ${total.toLocaleString("en-US")}` : "Check the catalogue"}
              </button>
              {changes && changes.length > 0 && (
                <button className="btn" onClick={stage} disabled={busy}>
                  Stage {changes.length.toLocaleString("en-US")} new keys
                </button>
              )}
            </div>

            {error && <p className="lede" role="alert" style={{ color: "var(--error-ink)", marginTop: 16 }}>{error}</p>}

            {staged !== null && (
              <p className="lede" role="status" style={{ marginTop: 16 }}>
                Staged {staged.toLocaleString("en-US")}. Now run <code>select * from public.apply_book_rekey();</code> in the SQL Editor.
              </p>
            )}

            {changes && (
              <>
                <p className="lede" style={{ marginTop: 20 }}>
                  {total.toLocaleString("en-US")} books checked. {changes.length.toLocaleString("en-US")} get a new key
                  {merging > 0 ? `, and at least ${merging.toLocaleString("en-US")} will merge with another copy` : ""}.
                </p>
                <ul style={{ marginTop: 12, listStyle: "none", padding: 0 }}>
                  {changes.slice(0, 200).map((c) => (
                    <li key={c.id} style={{ display: "block", padding: "10px 0", borderBottom: "1px solid var(--line)" }}>
                      <div style={{ fontSize: 15 }}>{c.title}{c.author ? ` · ${c.author}` : ""}</div>
                      <div style={{ fontSize: 13, color: "var(--ink-2)" }}>
                        <code>{c.from}</code> → <code>{c.to}</code>
                      </div>
                    </li>
                  ))}
                </ul>
                {changes.length > 200 && <p className="lede" style={{ marginTop: 12 }}>Showing the first 200.</p>}
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}
