"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { RequireAuth, useProfile } from "@/components/Auth";
import { Avatar } from "@/components/Avatar";
import { EarlyPill, Name } from "@/components/Badge";
import { BadgeStrip } from "@/components/BadgeCase";
import { isEarlyAdopter } from "@/lib/badges";
import { Cover } from "@/components/Cover";
import { FollowButton } from "@/components/FollowButton";
import { WantButton } from "@/components/WantButton";
import { BackIcon, LockIcon, MoreIcon } from "@/components/icons";
import { ScoreChip } from "@/components/ScoreChip";
import { TabBar } from "@/components/TabBar";
import {
  block, fetchBadges, fetchFollowing, fetchMyBlocks, fetchProfileByUsername, fetchShelf, followCounts, rankEntries, report, tasteMatches, unblock,
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
  blocked: boolean;
  badges: { key: string; earned_at: string }[];
}

function Inner() {
  const { username } = useParams<{ username: string }>();
  const { profile: me } = useProfile();
  const router = useRouter();
  const [data, setData] = useState<Loaded | null | undefined>(undefined);
  const [showAll, setShowAll] = useState(false);
  const [menu, setMenu] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function toggleBlock() {
    if (!data) return;
    setMenu(false);
    if (data.blocked) {
      await unblock(data.profile.id);
      setData({ ...data, blocked: false });
      setNotice(`Unblocked @${data.profile.username}.`);
    } else {
      if (!window.confirm(`Block @${data.profile.username}? You won't see each other's shelves, posts or comments, and any follows between you end.`)) return;
      await block(data.profile.id);
      setData({ ...data, blocked: true, following: false, theirs: [] });
      setNotice(`Blocked @${data.profile.username}.`);
    }
  }

  async function flag() {
    if (!data) return;
    setMenu(false);
    const reason = window.prompt("What’s wrong with this profile? (optional)") ?? undefined;
    await report("profile", data.profile.id, reason).catch(() => {});
    setNotice("Thanks — we’ll take a look.");
  }

  useEffect(() => {
    (async () => {
      const profile = await fetchProfileByUsername(username);
      if (!profile) return setData(null);
      if (profile.id === me?.id) return router.replace("/you");
      const [theirs, mine, followingIds, counts, matches, blocks, badges] = await Promise.all([
        fetchShelf(profile.id), fetchShelf(), fetchFollowing(), followCounts(profile.id), tasteMatches([profile.id]), fetchMyBlocks(),
        fetchBadges(profile.id).catch(() => []),
      ]);
      setData({ profile, theirs, mine, following: followingIds.includes(profile.id), counts, match: matches.get(profile.id), blocked: blocks.has(profile.id), badges });
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
  // Your status for each book: ranked/reading ones need no button; want-to-read shows as Saved.
  const myStatus = useMemo(() => new Map((data?.mine ?? []).map((e) => [e.book_id, e.status])), [data]);
  const wantable = (bookId: string) => !myStatus.has(bookId) || myStatus.get(bookId) === "want";

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
                <h1 className="h1" style={{ fontSize: 28 }}><Name profile={data.profile} markSize={20} /></h1>
                <div className="muted" style={{ fontSize: 13 }}>@{data.profile.username} · {data.counts.followers} followers</div>
                {isEarlyAdopter(data.profile.created_at) && <div style={{ marginTop: 6 }}><EarlyPill /></div>}
              </div>
              {!data.blocked && <FollowButton userId={data.profile.id} initial={data.following} />}
              <div style={{ position: "relative" }}>
                <button className="icon-btn" aria-label="More options" aria-expanded={menu} onClick={() => setMenu(!menu)}>
                  <MoreIcon size={20} />
                </button>
                {menu && (
                  <div className="menu" role="menu">
                    <button role="menuitem" onClick={toggleBlock}>{data.blocked ? "Unblock" : "Block"}</button>
                    <button role="menuitem" onClick={flag}>Report</button>
                  </div>
                )}
              </div>
            </div>
            {notice && <p className="notice" role="status" style={{ marginTop: 12 }}>{notice}</p>}

            {data.blocked ? (
              <div className="empty"><p className="h2">You blocked this reader</p><p style={{ margin: 0, fontSize: 14 }}>Unblock them from the menu to see their shelf again.</p></div>
            ) : data.profile.is_private ? (
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

                <BadgeStrip earned={data.badges} />

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
                        <div key={e.id} className="reading-card">
                          <Link href={`/book/${e.book_id}`} style={{ textDecoration: "none", display: "flex", flexDirection: "column", gap: 10 }}>
                            <Cover book={e.book} width={64} />
                            <span className="reading-card__title">{e.book.title}</span>
                          </Link>
                          {wantable(e.book_id) && <WantButton bookId={e.book_id} initialSaved={myStatus.get(e.book_id) === "want"} />}
                        </div>
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
                        <li key={e.id} style={{ display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid var(--line)" }}>
                          <Link href={`/book/${e.book_id}`} className="book-row" style={{ flex: 1, minWidth: 0, borderBottom: 0 }}>
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
                          {wantable(e.book_id) && <WantButton bookId={e.book_id} compact initialSaved={myStatus.get(e.book_id) === "want"} />}
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
