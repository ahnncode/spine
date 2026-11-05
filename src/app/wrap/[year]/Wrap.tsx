"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { RequireAuth, useProfile } from "@/components/Auth";
import { Avatar, displayName } from "@/components/Avatar";
import { Cover } from "@/components/Cover";
import { BackIcon, ShareIcon } from "@/components/icons";
import { ScoreChip } from "@/components/ScoreChip";
import { useShelf } from "@/components/useShelf";
import { fetchFollowing, fetchProfiles, rankEntries, tasteMatches, type Profile } from "@/lib/data";
import { GENRE_BY_KEY } from "@/lib/genres";
import { readInYear } from "@/lib/stats";

export function Wrap() {
  return (
    <RequireAuth>
      <Inner />
    </RequireAuth>
  );
}

const MONTHS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

function Inner() {
  const params = useParams<{ year: string }>();
  const year = parseInt(params.year, 10) || new Date().getFullYear();
  const { profile } = useProfile();
  const { entries } = useShelf();
  const [friends, setFriends] = useState<{ closest?: [Profile, number]; furthest?: [Profile, number] } | null>(null);
  const [shared, setShared] = useState(false);

  useEffect(() => {
    (async () => {
      const ids = await fetchFollowing();
      const [matches, profiles] = await Promise.all([tasteMatches(ids), fetchProfiles(ids)]);
      const scored = [...matches.entries()].filter(([, m]) => m.match != null).sort((a, b) => b[1].match! - a[1].match!);
      const pick = (i: number): [Profile, number] | undefined =>
        scored[i] && profiles.get(scored[i][0]) ? [profiles.get(scored[i][0])!, scored[i][1].match!] : undefined;
      setFriends({ closest: pick(0), furthest: scored.length > 1 ? pick(scored.length - 1) : undefined });
    })().catch(() => setFriends({}));
  }, []);

  const all = useMemo(() => rankEntries(entries || []), [entries]);
  const books = useMemo(() => readInYear(all, year), [all, year]);
  const pages = books.reduce((s, e) => s + (e.book.pages ?? 0), 0);
  const longest = [...books].sort((a, b) => (b.book.pages ?? 0) - (a.book.pages ?? 0))[0];
  const months = MONTHS.map((_, i) => books.filter((e) => Number(e.finished_on!.slice(5, 7)) === i + 1).length);
  const maxMonth = Math.max(1, ...months);
  const genreCounts = Object.entries(
    books.reduce<Record<string, number>>((acc, e) => {
      for (const g of e.book.genres ?? []) acc[g] = (acc[g] ?? 0) + 1;
      return acc;
    }, {}),
  ).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const top = books.slice(0, 10);

  async function share() {
    const text = `My ${year} in books on readread: ${books.length} read${top[0] ? `, and my #1 was ${top[0].book.title}` : ""}.`;
    const url = `${window.location.origin}/u/${profile?.username ?? ""}`;
    try {
      if (navigator.share) await navigator.share({ title: `${year} in books`, text, url });
      else {
        await navigator.clipboard.writeText(`${text} ${url}`);
        setShared(true);
      }
    } catch {
      /* dismissed */
    }
  }

  return (
    <div className="app">
      <main className="screen screen--flow" style={{ paddingTop: 16 }}>
        <div className="topbar">
          <Link href="/you" className="icon-btn" aria-label="Back"><BackIcon size={20} /></Link>
          <button className="icon-btn" aria-label="Share your year" onClick={share}><ShareIcon size={18} /></button>
        </div>
        {shared && <p className="notice" role="status">Copied — paste it anywhere.</p>}

        <p className="eyebrow" style={{ marginTop: 20 }}>{displayName(profile)}&rsquo;s year in books</p>
        <h1 className="d moment" style={{ fontSize: 120, fontWeight: 800, letterSpacing: "-0.06em", lineHeight: 0.85, margin: "8px 0 0" }}>{year}</h1>

        {!entries ? <div aria-busy="true" style={{ minHeight: 200 }} /> : books.length === 0 ? (
          <div className="empty">
            <p className="h2">No books finished in {year} yet</p>
            <Link href="/add" className="btn" style={{ marginTop: 12 }}>Rank one</Link>
          </div>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10, marginTop: 24 }}>
              <div className="card card--ink moment" style={{ animationDelay: "0.1s" }}>
                <div className="stat-big">{books.length}</div>
                <div style={{ fontWeight: 600, marginTop: 6 }}>books</div>
              </div>
              <div className="card moment" style={{ background: "var(--accent)", borderColor: "var(--accent)", animationDelay: "0.2s" }}>
                <div className="stat-big">{pages ? pages.toLocaleString() : "—"}</div>
                <div style={{ fontWeight: 600, marginTop: 6 }}>pages</div>
              </div>
            </div>

            <section className="card" style={{ marginTop: 10 }}>
              <h2 className="h2">Month by month</h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(12, minmax(0, 1fr))", gap: 4, alignItems: "end", height: 90, marginTop: 14 }} role="img" aria-label={`Books per month: ${months.join(", ")}`}>
                {months.map((n, i) => (
                  <div key={i} style={{ height: `${Math.max(4, (n / maxMonth) * 100)}%`, background: n ? "var(--ink)" : "var(--well)", borderRadius: 4 }} />
                ))}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(12, minmax(0, 1fr))", gap: 4, marginTop: 6 }} aria-hidden="true">
                {MONTHS.map((m, i) => <span key={i} className="m muted" style={{ fontSize: 10, textAlign: "center" }}>{m}</span>)}
              </div>
            </section>

            <section className="card" style={{ marginTop: 10 }}>
              <h2 className="h2">Your top {Math.min(10, top.length)}</h2>
              <ol style={{ listStyle: "none", margin: "6px 0 0", padding: 0 }}>
                {top.map((e, i) => (
                  <li key={e.id}>
                    <Link href={`/book/${e.book_id}`} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0", color: "inherit", textDecoration: "none" }}>
                      <span className="d" style={{ width: 26, fontWeight: 800, fontSize: i < 3 ? 22 : 17, color: i < 3 ? "var(--ink)" : "var(--faint)" }}>{i + 1}</span>
                      <Cover book={e.book} width={34} />
                      <span style={{ flex: 1, minWidth: 0 }} className="book-row__title">{e.book.title}</span>
                      <ScoreChip score={e.score} bucket={e.bucket} size={36} />
                    </Link>
                  </li>
                ))}
              </ol>
            </section>

            {genreCounts.length > 0 && (
              <section className="card" style={{ marginTop: 10 }}>
                <h2 className="h2">What you read</h2>
                <div className="stack" style={{ marginTop: 12 }}>
                  {genreCounts.map(([g, n]) => GENRE_BY_KEY[g] && (
                    <div key={g} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
                      <span style={{ width: 76 }}>{GENRE_BY_KEY[g].label}</span>
                      <span className="compare-bar" style={{ flex: 1 }}>
                        <span style={{ width: `${(n / genreCounts[0][1]) * 100}%`, background: GENRE_BY_KEY[g].bg }} />
                      </span>
                      <span className="m" style={{ width: 20, textAlign: "right", fontWeight: 700 }}>{n}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {longest?.book.pages && (
              <Link href={`/book/${longest.book_id}`} className="card" style={{ marginTop: 10, display: "flex", gap: 14, alignItems: "center", color: "inherit", textDecoration: "none" }}>
                <Cover book={longest.book} width={56} />
                <div>
                  <div className="eyebrow">Longest read</div>
                  <div className="d" style={{ fontWeight: 700, fontSize: 18, marginTop: 4 }}>{longest.book.title}</div>
                  <div className="muted" style={{ fontSize: 13 }}>{longest.book.pages.toLocaleString()} pages</div>
                </div>
              </Link>
            )}

            {friends?.closest && (
              <section className="card" style={{ marginTop: 10, background: "var(--cobalt)", borderColor: "var(--cobalt)", color: "#fff" }}>
                <div className="eyebrow" style={{ color: "#dde1ff" }}>Reading twin</div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 10 }}>
                  <Avatar profile={friends.closest[0]} size={40} />
                  <div style={{ flex: 1, fontWeight: 600 }}>{displayName(friends.closest[0])}</div>
                  <span className="d" style={{ fontSize: 28, fontWeight: 800 }}>{friends.closest[1]}%</span>
                </div>
                {friends.furthest && (
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.2)" }}>
                    <Avatar profile={friends.furthest[0]} size={40} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600 }}>{displayName(friends.furthest[0])}</div>
                      <div style={{ fontSize: 12, color: "#dde1ff" }}>Most likely to start an argument</div>
                    </div>
                    <span className="d" style={{ fontSize: 28, fontWeight: 800 }}>{friends.furthest[1]}%</span>
                  </div>
                )}
              </section>
            )}

            <button className="btn btn--block" style={{ marginTop: 20 }} onClick={share}>
              <ShareIcon size={18} /> Share your year
            </button>
          </>
        )}
      </main>
    </div>
  );
}
