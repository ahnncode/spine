"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { RequireAuth } from "@/components/Auth";
import { Avatar, displayName } from "@/components/Avatar";
import { BookActions } from "@/components/BookActions";
import { Cover } from "@/components/Cover";
import { BackIcon } from "@/components/icons";
import { ScoreChip } from "@/components/ScoreChip";
import { TabBar } from "@/components/TabBar";
import type { Book } from "@/lib/books";
import {
  bookStats, fetchBook, fetchFollowing, fetchProfiles, fetchShelf, friendsOnBook, predictedScore,
  rankEntries, tasteMatches, type Entry, type Match, type Profile, type ScoredEntry,
} from "@/lib/data";
import { GENRE_BY_KEY } from "@/lib/genres";
import { formatScore } from "@/lib/ranking";

export function BookPage() {
  return (
    <RequireAuth>
      <Inner />
    </RequireAuth>
  );
}

interface Social {
  stats: { avg: number | null; readers: number };
  predicted: { score: number | null; basis: number };
  friends: ScoredEntry[];
  profiles: Map<string, Profile>;
  matches: Map<string, Match>;
}

function Inner() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [book, setBook] = useState<Book | null | undefined>(undefined);
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [social, setSocial] = useState<Social | null>(null);

  const loadShelf = useCallback(async () => setEntries(await fetchShelf()), []);

  useEffect(() => {
    let live = true;
    (async () => {
      const [b] = await Promise.all([fetchBook(id), loadShelf()]);
      if (!live) return;
      setBook(b);
      if (!b) return;
      const following = await fetchFollowing();
      const [stats, predicted, friends] = await Promise.all([bookStats(id), predictedScore(id), friendsOnBook(id, following)]);
      const ids = friends.map((f) => f.user_id);
      const [profiles, matches] = await Promise.all([fetchProfiles(ids), tasteMatches(ids)]);
      if (live) setSocial({ stats, predicted, friends, profiles, matches });
    })().catch(() => live && setBook((b) => b ?? null));
    return () => {
      live = false;
    };
  }, [id, loadShelf]);

  const mine = useMemo(() => entries?.find((e) => e.book_id === id) ?? null, [entries, id]);
  const myRanked = useMemo(() => (entries ? rankEntries(entries).find((e) => e.book_id === id) : undefined), [entries, id]);

  if (book === null) {
    return (
      <div className="app">
        <main className="screen">
          <div className="empty">
            <p className="h2">We couldn’t find that book</p>
            <Link href="/search" className="btn" style={{ marginTop: 12 }}>Search</Link>
          </div>
        </main>
        <TabBar />
      </div>
    );
  }

  const friends = [...(social?.friends ?? [])].sort(
    (a, b) => (social?.matches.get(b.user_id)?.match ?? -1) - (social?.matches.get(a.user_id)?.match ?? -1),
  );

  return (
    <div className="app">
      <main className="screen" style={{ paddingTop: 0, paddingLeft: 0, paddingRight: 0 }}>
        <div style={{ background: "#dce5d3", padding: "14px 16px 26px", display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ alignSelf: "stretch" }}>
            <button className="icon-btn" style={{ background: "rgba(255,255,255,0.7)" }} aria-label="Back" onClick={() => router.back()}>
              <BackIcon size={20} />
            </button>
          </div>
          {book ? <Cover book={book} width={140} /> : <div style={{ width: 140, height: 210 }} aria-busy="true" />}
        </div>

        {book && (
          <div style={{ padding: "18px 20px 0" }}>
            <h1 className="h1" style={{ fontSize: 32 }}>{book.title}</h1>
            <p className="muted" style={{ margin: "4px 0 0", fontSize: 14 }}>
              {[book.author, book.year, book.pages ? `${book.pages} pages` : null].filter(Boolean).join(" · ")}
            </p>
            {book.genres?.length > 0 && (
              <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                {book.genres.map((g) => GENRE_BY_KEY[g] && (
                  <span key={g} className="pill" style={{ background: GENRE_BY_KEY[g].bg, color: GENRE_BY_KEY[g].fg }}>
                    {GENRE_BY_KEY[g].label}
                  </span>
                ))}
              </div>
            )}

            {myRanked ? (
              <div className="card" style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 14 }}>
                <ScoreChip score={myRanked.score} bucket={myRanked.bucket} size={60} />
                <div>
                  <div style={{ fontWeight: 600 }}>Your #{myRanked.rank}</div>
                  <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>
                    {social?.predicted.score != null ? `Readers like you: ${formatScore(social.predicted.score)}` : "Your score"}
                  </div>
                </div>
              </div>
            ) : (
              <div className="card" style={{ marginTop: 16, background: "var(--cobalt)", borderColor: "var(--cobalt)", color: "#fff", display: "flex", alignItems: "center", gap: 14 }}>
                <div className="m score" style={{ width: 60, height: 60, background: "#fff", color: "var(--cobalt-ink)", fontSize: 20 }}>
                  {social?.predicted.score != null ? formatScore(social.predicted.score) : "?"}
                </div>
                <div>
                  <div style={{ fontWeight: 600 }}>Your predicted score</div>
                  <div style={{ fontSize: 13, color: "#dde1ff", marginTop: 2, lineHeight: 1.35 }}>
                    {social?.predicted.score != null
                      ? `From ${social.predicted.basis} reader${social.predicted.basis === 1 ? "" : "s"} whose taste matches yours`
                      : "Rank more books and we’ll learn your taste"}
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8, marginTop: 8 }}>
              <div className="card" style={{ padding: "12px 14px" }}>
                <div className="m" style={{ fontSize: 20, fontWeight: 700 }}>
                  {friends.length ? formatScore(friends.reduce((s, f) => s + f.score, 0) / friends.length) : "—"}
                </div>
                <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>Friends · {friends.length} ranked</div>
              </div>
              <div className="card" style={{ padding: "12px 14px" }}>
                <div className="m" style={{ fontSize: 20, fontWeight: 700 }}>
                  {social?.stats.avg != null ? formatScore(social.stats.avg) : "—"}
                </div>
                <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                  Everyone · {social?.stats.readers ?? 0} {social?.stats.readers === 1 ? "rank" : "ranks"}
                </div>
              </div>
            </div>

            {friends.length > 0 && (
              <>
                <h2 className="h2" style={{ margin: "20px 0 4px" }}>Friends who read it</h2>
                {friends.map((f) => {
                  const p = social?.profiles.get(f.user_id);
                  const m = social?.matches.get(f.user_id);
                  const diff = myRanked ? f.score - myRanked.score : null;
                  return (
                    <div key={f.id} className="person-row">
                      <Avatar profile={p} size={36} link />
                      <div className="person-row__body">
                        <Link href={p?.username ? `/u/${p.username}` : "#"} className="name" style={{ textDecoration: "none" }}>{displayName(p)}</Link>
                        <span className="muted" style={{ fontSize: 12 }}>
                          {[m?.match != null ? `${m.match}% taste match` : null, `#${f.overall_rank} on their shelf`,
                            diff != null && Math.abs(diff) >= 2 ? (diff > 0 ? "liked it more" : "liked it less") : null]
                            .filter(Boolean).join(" · ")}
                        </span>
                      </div>
                      <ScoreChip score={f.score} bucket={f.bucket} size={38} />
                    </div>
                  );
                })}
              </>
            )}

            <div style={{ marginTop: 22 }}>
              <BookActions bookId={id} entry={mine} onChange={loadShelf} showRemove={Boolean(mine)} />
            </div>
          </div>
        )}
      </main>
      <TabBar />
    </div>
  );
}
