"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { RequireAuth, useProfile } from "@/components/Auth";
import { Avatar, displayName } from "@/components/Avatar";
import { EarlyPill, Name } from "@/components/Badge";
import { Blurb } from "@/components/Blurb";
import { BadgeStrip } from "@/components/BadgeCase";
import { isEarlyAdopter } from "@/lib/badges";
import { Cover } from "@/components/Cover";
import { FollowButton } from "@/components/FollowButton";
import { PokeButton } from "@/components/PokeButton";
import { WantButton } from "@/components/WantButton";
import { ArrowIcon, BackIcon, LockIcon, MoreIcon } from "@/components/icons";
import { ScoreChip } from "@/components/ScoreChip";
import { TabBar } from "@/components/TabBar";
import {
  block, fetchBadges, fetchFollowing, fetchMyBlocks, fetchProfileByUsername, fetchShelf, followCounts, rankEntries, report, tasteMatches, unblock,
  type Entry, type Match, type Profile,
} from "@/lib/data";
import { formatScore } from "@/lib/ranking";
import { passport, readInYear } from "@/lib/stats";

/** " · today", " · 3d ago" — when they last touched a book they're reading. */
function since(day: string | null): string {
  if (!day) return "";
  const days = Math.round((Date.now() - new Date(`${day}T12:00:00`).getTime()) / 86400000);
  if (days <= 0) return " · today";
  if (days === 1) return " · yesterday";
  if (days < 30) return ` · ${days}d ago`;
  return "";
}

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
  const bothLoved = shared
    .filter(({ e, mine }) => e.bucket === "loved" && mine.bucket === "loved")
    .sort((a, b) => b.e.score + b.mine.score - (a.e.score + a.mine.score))
    .slice(0, 8);
  const stamps = passport(ranked).filter((s) => s.count > 0).length;
  const reading = (data?.theirs ?? []).filter((e) => e.status === "reading");
  const want = (data?.theirs ?? []).filter((e) => e.status === "want");
  // Your status for each book: ranked/reading ones need no button; want-to-read shows as Saved.
  const myStatus = useMemo(() => new Map((data?.mine ?? []).map((e) => [e.book_id, e.status])), [data]);
  const wantable = (bookId: string) => !myStatus.has(bookId) || myStatus.get(bookId) === "want";
  // Their loved books you haven't ranked or started (saved ones still show, as Saved).
  const picks = ranked.filter((e) => e.bucket === "loved" && wantable(e.book_id)).slice(0, 8);

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
            {!data.blocked && data.profile.bio && <Blurb text={data.profile.bio} name={displayName(data.profile)} />}
            {!data.blocked && data.following && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14 }}>
                <PokeButton userId={data.profile.id} name={displayName(data.profile)} />
                <span className="muted" style={{ fontSize: 12, lineHeight: 1.3 }}>
                  {reading.length ? `See how ${displayName(data.profile).split(" ")[0]} is doing with ${reading[0].book.title}` : "Give them a nudge to pick up a book"} · once a day
                </span>
              </div>
            )}
            {notice && <p className="notice" role="status" style={{ marginTop: 12 }}>{notice}</p>}

            {data.blocked ? (
              <div className="empty"><p className="h2">You blocked this reader</p><p style={{ margin: 0, fontSize: 14 }}>Unblock them from the menu to see their shelf again.</p></div>
            ) : data.profile.is_private ? (
              <div className="empty"><LockIcon size={22} /><p className="h2" style={{ marginTop: 8 }}>This shelf is private</p></div>
            ) : (
              <>
                {ranked.length >= 3 && (
                  <div className="top3" aria-label="Their top three">
                    {ranked.slice(0, 3).map((e) => (
                      <Link key={e.id} href={`/book/${e.book_id}`} className="top3__item" aria-label={`#${e.rank} ${e.book.title}`}>
                        <Cover book={e.book} width={96} />
                        <span className="top3__rank m">#{e.rank}</span>
                      </Link>
                    ))}
                  </div>
                )}

                {reading.length > 0 && (
                  <>
                    <h2 className="h2" style={{ marginTop: 20 }}>Reading now</h2>
                    <div className="reading-strip">
                      {reading.map((e) => (
                        <div key={e.id} className="reading-card">
                          <Link href={`/book/${e.book_id}`} style={{ textDecoration: "none", display: "flex", flexDirection: "column", gap: 10 }}>
                            <Cover book={e.book} width={64} />
                            <span className="reading-card__title">{e.book.title}</span>
                          </Link>
                          <span style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            {e.progress_pct != null && (
                              <span className="reading-card__bar" aria-label={`${e.progress_pct}% read`}><span style={{ width: `${e.progress_pct}%` }} /></span>
                            )}
                            <span className="m muted" style={{ fontSize: 11 }}>
                              {e.progress_pct != null ? `${e.progress_pct}%` : "Started"}{since(e.last_checkin_on ?? e.started_on)}
                            </span>
                          </span>
                          {wantable(e.book_id) && <WantButton bookId={e.book_id} initialSaved={myStatus.get(e.book_id) === "want"} />}
                        </div>
                      ))}
                    </div>
                  </>
                )}

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

                {bothLoved.length > 0 && (
                  <section style={{ marginTop: 20 }}>
                    <h2 className="h2">You both loved</h2>
                    <div className="cover-strip">
                      {bothLoved.map(({ e, mine }) => (
                        <Link key={e.id} href={`/book/${e.book_id}`} className="cover-strip__item">
                          <Cover book={e.book} width={76} />
                          <span className="cover-strip__title">{e.book.title}</span>
                          <span className="m muted" style={{ fontSize: 11 }}>them {formatScore(e.score)} · you {formatScore(mine.score)}</span>
                        </Link>
                      ))}
                    </div>
                  </section>
                )}

                {picks.length > 0 && (
                  <section style={{ marginTop: 20 }}>
                    <h2 className="h2">Their favorites you haven&rsquo;t read</h2>
                    <p className="muted" style={{ fontSize: 13, margin: "2px 0 0" }}>
                      {data.match?.match != null && data.match.match >= 70
                        ? `You match ${data.match.match}% — these are good bets.`
                        : "Their highest-ranked books that aren’t on your shelf yet."}
                    </p>
                    <div className="cover-strip">
                      {picks.map((e) => (
                        <div key={e.id} className="cover-strip__item">
                          <Link href={`/book/${e.book_id}`} style={{ textDecoration: "none", display: "flex", flexDirection: "column", gap: 6 }}>
                            <span style={{ position: "relative", display: "block" }}>
                              <Cover book={e.book} width={76} />
                              <span style={{ position: "absolute", right: -6, bottom: -6 }}><ScoreChip score={e.score} bucket={e.bucket} size={30} /></span>
                            </span>
                            <span className="cover-strip__title">{e.book.title}</span>
                          </Link>
                          <WantButton bookId={e.book_id} compact initialSaved={myStatus.get(e.book_id) === "want"} />
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                <BadgeStrip earned={data.badges} />

                <Link href={`/u/${data.profile.username}/shelf`} className="card card--ink shelf-cta">
                  <span className="shelf-cta__covers" aria-hidden="true">
                    {ranked.slice(0, 3).map((e) => <Cover key={e.id} book={e.book} width={34} />)}
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontWeight: 700 }}>See their whole library</span>
                    <span style={{ display: "block", fontSize: 13, color: "#c9c8c2", marginTop: 2 }}>
                      {ranked.length} ranked{want.length ? ` · ${want.length} want to read` : ""} · search, filter &amp; sort
                    </span>
                  </span>
                  <ArrowIcon size={18} />
                </Link>
              </>
            )}
          </>
        )}
      </main>
      <TabBar />
    </div>
  );
}
