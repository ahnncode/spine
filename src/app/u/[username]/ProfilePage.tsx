"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { RequireAuth, useProfile } from "@/components/Auth";
import { Avatar, displayName } from "@/components/Avatar";
import { Cover } from "@/components/Cover";
import { FollowButton } from "@/components/FollowButton";
import { BackIcon, LockIcon } from "@/components/icons";
import { ScoreChip } from "@/components/ScoreChip";
import { TabBar } from "@/components/TabBar";
import {
  fetchFollowing, fetchProfileByUsername, fetchShelf, followCounts, rankEntries, tasteMatches,
  type Entry, type Match, type Profile,
} from "@/lib/data";
import { formatScore } from "@/lib/ranking";
import { passport, readInYear } from "@/lib/stats";

export function ProfilePage() {
  return (
    <RequireAuth>
      <Inner />
    </RequireAuth>
  );
}

interface Loaded {
  profile: Profile;
  theirs: Entry[];
  mine: Entry[];
  following: boolean;
  counts: { followers: number; following: number };
  match: Match | undefined;
}

function Inner() {
  const { username } = useParams<{ username: string }>();
  const { profile: me } = useProfile();
  const router = useRouter();
  const [data, setData] = useState<Loaded | null | undefined>(undefined);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    (async () => {
      const profile = await fetchProfileByUsername(username);
      if (!profile) return setData(null);
      if (profile.id === me?.id) return router.replace("/you");
      const [theirs, mine, followingIds, counts, matches] = await Promise.all([
        fetchShelf(profile.id), fetchShelf(), fetchFollowing(), followCounts(profile.id), tasteMatches([profile.id]),
      ]);
      setData({ profile, theirs, mine, following: followingIds.includes(profile.id), counts, match: matches.get(profile.id) });
    })().catch(() => setData(null));
  }, [username, me?.id, router]);

  const ranked = useMemo(() => rankEntries(data?.theirs ?? []), [data]);
  const myRanked = useMemo(() => new Map(rankEntries(data?.mine ?? []).map((e) => [e.book_id, e])), [data]);
  const shared = useMemo(
    () => ranked.filter((e) => myRanked.has(e.book_id)).map((e) => ({ e, mine: myRanked.get(e.book_id)!, diff: e.score - myRanked.get(e.book_id)!.score })),
    [ranked, myRanked],
  );
  const disagree = [...shared].sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff)).filter((s) => Math.abs(s.diff) >= 2).slice(0, 3);
  const stamps = passport(ranked).filter((s) => s.count > 0).length;
  const reading = (data?.theirs ?? []).filter((e) => e.status === "reading");

  if (data === null) {
    return (
      <div className="app">
        <main className="screen">
          <div className="empty"><p className="h2">No reader called @{username}</p><Link href="/people" className="btn" style={{ marginTop: 12 }}>Find people</Link></div>
        </main>
        <TabBar />
      </div>
    );
  }

  return (
    <div className="app">
      <main className="screen">
        <div className="topbar">
          <button className="icon-btn" aria-label="Back" onClick={() => router.back()}><BackIcon size={20} /></button>
        </div>
        {!data ? <div aria-busy="true" style={{ minHeight: 200 }} /> : (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 12 }}>
              <Avatar profile={data.profile} size={64} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <h1 className="h1" style={{ fontSize: 28 }}>{displayName(data.profile)}</h1>
                <div className="muted" style={{ fontSize: 13 }}>@{data.profile.username} · {data.counts.followers} followers</div>
              </div>
              <FollowButton userId={data.profile.id} initial={data.following} />
            </div>

            {data.profile.is_private ? (
              <div className="empty"><LockIcon size={22} /><p className="h2" style={{ marginTop: 8 }}>This shelf is private</p></div>
            ) : (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8, marginTop: 18 }}>
                  <div className="stat"><div className="stat__n">{ranked.length}</div><div className="stat__l">ranked</div></div>
                  <div className="stat"><div className="stat__n">{readInYear(ranked, new Date().getFullYear()).length}</div><div className="stat__l">this year</div></div>
                  <div className="stat"><div className="stat__n">{stamps}</div><div className="stat__l">genre stamps</div></div>
                </div>

                <div className="card" style={{ marginTop: 10, background: "var(--cobalt)", borderColor: "var(--cobalt)", color: "#fff", display: "flex", alignItems: "center", gap: 14 }}>
                  <div className="d stat-big" style={{ fontSize: 44 }}>{data.match?.match != null ? `${data.match.match}%` : "—"}</div>
                  <div style={{ fontSize: 14, lineHeight: 1.35 }}>
                    <strong>Taste match</strong>
                    <div style={{ color: "#dde1ff", fontSize: 13 }}>
                      {data.match?.match != null
                        ? `From ${data.match.overlap} books you’ve both ranked`
                        : `You’ve ranked ${shared.length} of the same books — 3 needed`}
                    </div>
                  </div>
                </div>

                {disagree.length > 0 && (
                  <section className="card" style={{ marginTop: 10 }}>
                    <h2 className="h2">Where you disagree</h2>
                    {disagree.map(({ e, mine, diff }) => (
                      <Link key={e.id} href={`/book/${e.book_id}`} className="book-row" style={{ borderBottom: 0 }}>
                        <Cover book={e.book} width={34} />
                        <span className="book-row__body">
                          <span className="book-row__title" style={{ display: "block", fontSize: 15 }}>{e.book.title}</span>
                          <span className="book-row__sub" style={{ display: "block" }}>
                            {diff > 0 ? "They liked it more" : "You liked it more"} · you {formatScore(mine.score)}
                          </span>
                        </span>
                        <ScoreChip score={e.score} bucket={e.bucket} size={38} />
                      </Link>
                    ))}
                  </section>
                )}

                {reading.length > 0 && (
                  <>
                    <h2 className="eyebrow" style={{ marginTop: 20 }}>Reading now</h2>
                    <div className="reading-strip">
                      {reading.map((e) => (
                        <Link key={e.id} href={`/book/${e.book_id}`} className="reading-card" style={{ textDecoration: "none" }}>
                          <Cover book={e.book} width={64} />
                          <div className="reading-card__title">{e.book.title}</div>
                        </Link>
                      ))}
                    </div>
                  </>
                )}

                <h2 className="h2" style={{ marginTop: 20 }}>Their ranking</h2>
                {ranked.length === 0 ? <p className="muted" style={{ fontSize: 14 }}>Nothing ranked yet.</p> : (
                  <ol style={{ listStyle: "none", margin: "4px 0 0", padding: 0 }}>
                    {(showAll ? ranked : ranked.slice(0, 15)).map((e) => {
                      const mineE = myRanked.get(e.book_id);
                      return (
                        <li key={e.id}>
                          <Link href={`/book/${e.book_id}`} className="book-row">
                            <span className={`book-row__rank ${e.rank <= 3 ? "book-row__rank--top" : ""}`}>{e.rank}</span>
                            <Cover book={e.book} width={44} />
                            <span className="book-row__body">
                              <span className="book-row__title" style={{ display: "block" }}>{e.book.title}</span>
                              <span className="book-row__sub" style={{ display: "block" }}>
                                {mineE ? `You: ${formatScore(mineE.score)}` : e.book.author}
                              </span>
                            </span>
                            <ScoreChip score={e.score} bucket={e.bucket} />
                          </Link>
                        </li>
                      );
                    })}
                  </ol>
                )}
                {ranked.length > 15 && !showAll && (
                  <button className="btn btn--quiet btn--block" style={{ marginTop: 12 }} onClick={() => setShowAll(true)}>Show all {ranked.length}</button>
                )}
              </>
            )}
          </>
        )}
      </main>
      <TabBar />
    </div>
  );
}
