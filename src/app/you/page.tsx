"use client";

import { DroppedRow } from "@/components/PutAside";
import { RecentlyFinished } from "@/components/RecentlyFinished";
import { ShareCardButton } from "@/components/ShareCard";
import { useReadAlongs } from "@/components/useReadAlongs";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { RequireAuth, useProfile } from "@/components/Auth";
import { Avatar, displayName } from "@/components/Avatar";
import { Blurb } from "@/components/Blurb";
import { EarlyPill, Name } from "@/components/Badge";
import { AvatarPicker } from "@/components/AvatarPicker";
import { CheckInSheet } from "@/components/CheckInSheet";
import { BadgeCase } from "@/components/BadgeCase";
import { NewBadges } from "@/components/NewBadges";
import { InviteCard } from "@/components/InviteCard";
import { Cover } from "@/components/Cover";
import { ArrowIcon, LockIcon } from "@/components/icons";
import { ScoreChip } from "@/components/ScoreChip";
import { TabBar } from "@/components/TabBar";
import { useAuthorFix } from "@/components/useAuthorFix";
import { useCoverBackfill } from "@/components/useCoverBackfill";
import { useEnrichment } from "@/components/useEnrichment";
import { useShelf } from "@/components/useShelf";
import { useStreak } from "@/components/useStreak";
import { isEarlyAdopter, type BadgeStatus } from "@/lib/badges";
import type { Entry } from "@/lib/data";
import { deleteMyAccount, fetchAbandonedCount, followCounts, rankEntries, myInvites, refreshBadges, setBookGenre, today, updateMyProfile, isListened } from "@/lib/data";
import { buildReaderType, MIN_BOOKS, readerInputFromShelf } from "@/lib/readerType";
import { useSyncMyReaderType } from "@/components/useReaderTypes";
import { GENRES } from "@/lib/genres";
import { passport, readInYear, TASTE_UNLOCK } from "@/lib/stats";
import { supabase } from "@/lib/supabase";

export default function YouPage() {
  return (
    <RequireAuth>
      <You />
    </RequireAuth>
  );
}

function You() {
  const router = useRouter();
  const { profile, reloadProfile } = useProfile();
  const { entries, reload } = useShelf();
  const { active: lookingUp } = useEnrichment(entries, reload);
  useCoverBackfill(entries, reload);
  useAuthorFix(entries, reload);
  const [counts, setCounts] = useState<{ followers: number; following: number } | null>(null);
  const [editing, setEditing] = useState(false);
  const [picking, setPicking] = useState(false);

  useEffect(() => {
    if (profile) followCounts(profile.id).then(setCounts).catch(() => {});
  }, [profile]);

  const ranked = useMemo(() => rankEntries(entries || []), [entries]);
  const dropped = useMemo(
    () => (entries || []).filter((e) => e.status === "dropped").sort((a, b) => (b.stopped_at ?? "").localeCompare(a.stopped_at ?? "")),
    [entries],
  );
  const year = new Date().getFullYear();
  const thisYear = readInYear(ranked, year).length;
  const goal = profile?.yearly_goal ?? null;
  const { streak, reloadCheckins } = useStreak(entries);
  const { list: readAlongs, people: raPeople } = useReadAlongs();
  const [checking, setChecking] = useState<Entry | null>(null);
  const stamps = useMemo(() => passport(ranked), [ranked]);
  const earnedStamps = stamps.filter((s) => s.count > 0).length;
  // Earned stamps plus the next three to unlock, not a wall of padlocks.
  const [allStamps, setAllStamps] = useState(false);
  const shownStamps = allStamps ? stamps : [...stamps.filter((s) => s.count > 0), ...stamps.filter((s) => s.count === 0).slice(0, 3)];
  const hiddenStamps = stamps.length - shownStamps.length;
  const [stamp, setStamp] = useState<string | null>(null);
  const openStamp = stamps.find((s) => s.key === stamp);
  const liveStampBooks = stamp ? ranked.filter((e) => e.book.genres?.includes(stamp)) : [];
  const [fixing, setFixing] = useState<typeof ranked | null>(null);
  const [fixNote, setFixNote] = useState<Record<string, string>>({});
  const stampBooks = fixing ?? liveStampBooks;
  function closeStamp() {
    setStamp(null);
    setFixNote({});
    if (fixing) {
      setFixing(null);
      if (Object.keys(picked).length) reload();
    }
  }
  async function fixGenre(bookId: string, genre: string) {
    const ok = await pickGenre(bookId, genre);
    setFixNote((n) => ({ ...n, [bookId]: ok ? "Moved" : "Other readers have this book, so its genre can’t be changed here." }));
  }
  const pendingGenres = lookingUp ? ranked.filter((e) => !e.book.enriched).length : 0;
  // Anything still without a genre once lookups finish can be sorted by hand.
  const noGenre = ranked.filter((e) => !e.book.genres?.length && (e.book.enriched || !lookingUp));
  const sortedByMe = ranked.filter((e) => e.book.genre_set_by && e.book.genre_set_by === profile?.id && e.book.genres?.length);
  // The list stays put while the sheet is open, even as picks move books out of "no genre".
  const [sortList, setSortList] = useState<typeof ranked>([]);
  function openSorting() {
    setSortList([...noGenre, ...sortedByMe]);
    setSorting(true);
  }
  const [sorting, setSorting] = useState(false);
  const [picked, setPicked] = useState<Record<string, string>>({});
  async function pickGenre(bookId: string, genre: string): Promise<boolean> {
    const before = picked[bookId];
    setPicked((p) => ({ ...p, [bookId]: genre }));
    const ok = await setBookGenre(bookId, genre).catch(() => false);
    if (!ok) setPicked((p) => { const n = { ...p }; if (before) n[bookId] = before; else delete n[bookId]; return n; });
    return ok;
  }
  const [badges, setBadges] = useState<BadgeStatus[] | null>(null);
  // Reader type, worked out the same way as on its own page so the two always agree.
  const [abandoned, setAbandoned] = useState<number | null | undefined>(undefined);
  useEffect(() => {
    fetchAbandonedCount().then(setAbandoned).catch(() => setAbandoned(null));
  }, []);
  const readerType = useMemo(
    () => (entries && abandoned !== undefined ? buildReaderType(readerInputFromShelf(ranked, entries, abandoned, today())) : undefined),
    [entries, ranked, abandoned],
  );
  useSyncMyReaderType(profile?.id, readerType);
  // Re-check badges whenever the shelf or profile changes (a new goal can earn one).
  const shelfSize = entries?.length ?? -1;
  useEffect(() => {
    if (!profile) return;
    refreshBadges().then(setBadges).catch(() => setBadges((b) => b ?? []));
  }, [profile, shelfSize]);
  const connector = badges?.find((b) => b.key === "connector");
  const [invites, setInvites] = useState<{ joined: number; qualified: number } | null>(null);
  useEffect(() => {
    if (profile) myInvites().then(setInvites).catch(() => {});
  }, [profile]);

  async function signOut() {
    await supabase().auth.signOut();
    router.replace("/");
  }

  const pct = goal ? Math.min(1, thisYear / goal) : 0;
  const C = 2 * Math.PI * 34;

  return (
    <div className="app">
      <main className="screen">
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <button className="avatar-edit" onClick={() => setPicking(true)} aria-label="Change profile picture">
            <Avatar profile={profile} size={60} />
            <span className="avatar-edit__dot" aria-hidden="true">+</span>
          </button>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h1 className="h1" style={{ fontSize: 28, letterSpacing: "-0.04em", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ minWidth: 0 }}><Name profile={profile} markSize={20} /></span>
              {profile?.is_private && <LockIcon size={16} aria-label="Private" />}
            </h1>
            <div className="muted" style={{ fontSize: 13 }}>
              @{profile?.username}
              {counts && (
                <>
                  {" · "}<Link href={`/u/${profile?.username}/follows`} className="count-link">{counts.followers} {counts.followers === 1 ? "follower" : "followers"}</Link>
                  {" · "}<Link href={`/u/${profile?.username}/follows?tab=following`} className="count-link">{counts.following} following</Link>
                </>
              )}
            </div>
            {isEarlyAdopter(profile?.created_at) && <div style={{ marginTop: 8 }}><EarlyPill /></div>}
          </div>
          <button className="btn btn--quiet" style={{ minHeight: 40, fontSize: 14, padding: "0 14px" }} onClick={() => setEditing(true)}>
            Edit
          </button>
        </div>

        {readerType !== undefined && (readerType ? (
          <Link href="/you/type" className="rt-teaser rt-teaser--top" style={{ background: readerType.color.bg, color: readerType.color.fg }}>
            <span className="rt-teaser__code">{readerType.code}</span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span className="eyebrow" style={{ display: "block", color: "inherit", opacity: 0.8 }}>Your reader type <span className="new-pill">New</span></span>
              <span className="g" style={{ display: "block", fontSize: 22, lineHeight: 1.1, marginTop: 4 }}>{readerType.copy.name}</span>
            </span>
            <ArrowIcon size={18} />
          </Link>
        ) : (
          <Link href="/you/type" className="rt-teaser rt-teaser--top card" style={{ color: "inherit" }}>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span className="eyebrow" style={{ display: "block" }}>Your reader type <span className="new-pill">New</span></span>
              <span style={{ display: "block", fontWeight: 600, fontSize: 15, marginTop: 4 }}>
                What kind of reader are you? Rank {Math.max(1, MIN_BOOKS - ranked.length)} more book{MIN_BOOKS - ranked.length === 1 ? "" : "s"} to find out.
              </span>
            </span>
            <ArrowIcon size={18} />
          </Link>
        ))}

        {profile?.bio ? (
          <Blurb text={profile.bio} name={displayName(profile)} onEdit={() => setEditing(true)} />
        ) : (
          <button className="blurb blurb--empty" onClick={() => setEditing(true)}>
            + Add a line about you as a reader
            <span className="blurb__example">Like &ldquo;Sci-fi lifer, will read anything with a map in the front.&rdquo;</span>
          </button>
        )}

        {ranked.length > 0 && (
          <section aria-label="Your top three" style={{ marginTop: 28 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <h2 className="section-title">Your top three</h2>
              {ranked.length >= 3 && (
                <ShareCardButton query="kind=top" label="Share top 10" filename="readread-top-10" className="link-btn" style={{ fontSize: 13 }} />
              )}
            </div>
            <div className="top3-open">
              {ranked.slice(0, 3).map((e) => (
                <Link key={e.id} href={`/book/${e.book_id}`} className="top3-open__item" aria-label={`#${e.rank} ${e.book.title}`}>
                  <span className="top3-open__rank">{e.rank}</span>
                  <Cover book={e.book} width={e.rank === 1 ? 112 : 92} listened={isListened(e.format)} />
                </Link>
              ))}
            </div>
          </section>
        )}

        {ranked.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8, marginTop: 28 }}>
            <div className="stat"><div className="stat__n">{ranked.length}</div><div className="stat__l">ranked</div></div>
            <div className="stat"><div className="stat__n">{thisYear}</div><div className="stat__l">this year</div></div>
            <div className="stat"><div className="stat__n">{stamps.filter((st) => st.count > 0).length}</div><div className="stat__l">genre stamps</div></div>
          </div>
        )}

        <RecentlyFinished ranked={ranked} mine />

        <div className="stats-pair">
          <button className="card stats-goal" onClick={() => setEditing(true)} aria-label={goal ? `${thisYear} of ${goal} books this year. Edit goal` : "Set a yearly goal"}>
            <svg width="64" height="64" viewBox="0 0 80 80" aria-hidden="true">
              <circle cx="40" cy="40" r="34" fill="none" stroke="var(--line-2)" strokeWidth="8" />
              <circle cx="40" cy="40" r="34" fill="none" stroke="var(--accent)" strokeWidth="8" strokeLinecap="round"
                strokeDasharray={`${C * pct} ${C}`} transform="rotate(-90 40 40)" />
              <text x="40" y="48" textAnchor="middle" fill="var(--ink)" fontFamily="var(--font-book)" fontSize="26" fontWeight="700">{thisYear}</text>
            </svg>
            <span>
              <span style={{ display: "block", fontSize: 14, fontWeight: 600 }}>{goal ? `${year} goal` : `In ${year}`}</span>
              <span className="muted" style={{ display: "block", fontSize: 12, marginTop: 2 }}>
                {goal ? (thisYear >= goal ? "Goal reached" : `${goal - thisYear} to go`) : "Set a goal"}
              </span>
            </span>
          </button>
          <div className="card card--ink stats-streak">
            <span style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
              <span className="d" style={{ fontSize: 30, fontWeight: 800, lineHeight: 1 }}>{streak.weeks}</span>
              <span style={{ fontSize: 13, fontWeight: 600 }}>week streak</span>
            </span>
            <span className="streak-grid" aria-hidden="true">
              {streak.recent.map((on, i) => <span key={i} data-on={on} data-now={i === 11} />)}
            </span>
            <span style={{ fontSize: 12, color: "#c9c8c2" }}>
              {streak.activeThisWeek ? "Safe this week" : streak.weeks ? "Check in this week to keep it" : "Check in to start one"}
            </span>
          </div>
        </div>

        <DroppedRow items={dropped} mine />

        {ranked.length < TASTE_UNLOCK && (
          <Link href="/add" className="unlock-row">
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 14, fontWeight: 600 }}>Rank {TASTE_UNLOCK - ranked.length} more to find your reading twin</span>
              <span className="bar" style={{ display: "block", marginTop: 8 }}><span style={{ width: `${(ranked.length / TASTE_UNLOCK) * 100}%`, background: "var(--cobalt)" }} /></span>
            </span>
            <ArrowIcon size={18} />
          </Link>
        )}

        <section style={{ marginTop: 32 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <h2 className="section-title">Genre passport</h2>
            <span className="m muted" style={{ fontSize: 12 }}>{earnedStamps} of {stamps.length} stamps</span>
          </div>
          <div className="stamp-grid">
            {shownStamps.map((s) =>
              s.count > 0 ? (
                <button key={s.key} className="stamp" style={{ background: s.bg, color: s.fg }} onClick={() => setStamp(s.key)}
                  aria-label={`${s.label}: ${s.count} book${s.count === 1 ? "" : "s"}`}>
                  <span className="m" style={{ fontWeight: 700 }}>{s.count}</span>
                  <span>{s.short}</span>
                </button>
              ) : (
                <button key={s.key} className="stamp stamp--locked" onClick={() => setStamp(s.key)} aria-label={`${s.label}: not earned yet`}>
                  <LockIcon size={14} />
                  <span>{s.short}</span>
                </button>
              ),
            )}
          </div>
          {hiddenStamps > 0 && (
            <button className="link-btn" style={{ marginTop: 12, fontSize: 13, display: "block", minHeight: 32 }} onClick={() => setAllStamps(true)}>
              See all {stamps.length} genres
            </button>
          )}
          {pendingGenres > 0 && (
            <p className="muted" style={{ fontSize: 13, margin: "10px 0 0" }}>Looking up genres for {pendingGenres} book{pendingGenres === 1 ? "" : "s"}… stamps fill in as you browse.</p>
          )}
          {noGenre.length > 0 ? (
            <button className="link-btn" style={{ marginTop: 12, fontSize: 13, display: "block" }} onClick={openSorting}>
              {noGenre.length} book{noGenre.length === 1 ? "" : "s"} without a genre. Sort {noGenre.length === 1 ? "it" : "them"}
            </button>
          ) : sortedByMe.length > 0 ? (
            <button className="link-btn" style={{ marginTop: 12, fontSize: 13, display: "block" }} onClick={openSorting}>
              Change genres you picked
            </button>
          ) : null}
          {ranked.length > 0 && (
            <p className="muted" style={{ fontSize: 12, margin: "8px 0 0" }}>Wrong genre? Tap a stamp, then Fix genres.</p>
          )}
        </section>

        {readAlongs.length > 0 && (
          <section style={{ marginTop: 32 }}>
            <h2 className="section-title">Reading together</h2>
            {readAlongs.slice(0, 6).map((ra) => {
              const mineState = ra.members.find((m) => m.user_id === profile?.id)?.state;
              const others = ra.members.filter((m) => m.state === "joined" && m.user_id !== profile?.id);
              return (
                <Link key={ra.id} href={`/together/${ra.id}`} className="book-row">
                  <Cover book={ra.book} width={36} />
                  <span className="book-row__body">
                    <span className="book-row__title" style={{ display: "block", fontSize: 15 }}>{ra.book.title}</span>
                    <span className="book-row__sub" style={{ display: "block" }}>
                      {mineState === "invited"
                        ? "You’re invited"
                        : ra.revealed_at
                          ? "Finished · see the verdict"
                          : `With ${others.map((m) => displayName(raPeople.get(m.user_id)).split(" ")[0]).join(", ") || "friends"}`}
                    </span>
                  </span>
                  <span className="avatar-stack">
                    {others.slice(0, 3).map((m) => <Avatar key={m.user_id} profile={raPeople.get(m.user_id)} size={26} />)}
                  </span>
                </Link>
              );
            })}
          </section>
        )}

        <BadgeCase statuses={badges} />
        <NewBadges statuses={badges} />

        {profile?.username && (
          <InviteCard username={profile.username} joined={invites?.joined ?? 0} qualified={invites?.qualified ?? connector?.progress ?? 0} earned={Boolean(connector?.earned)} />
        )}

        <nav className="link-group" aria-label="More">
          {[
            ...(profile?.username ? [{ href: `/u/${profile.username}/shelf`, label: "Your whole library" }] : []),
            { href: `/wrap/${year}`, label: `Your ${year} in books` },
          ].map((l) => (
            <Link key={l.href} href={l.href} className="link-group__row">
              <span>{l.label}</span>
              <ArrowIcon size={18} />
            </Link>
          ))}
          {[
            { href: "/people", label: "Find friends" },
            { href: "/import", label: "Import from Goodreads or StoryGraph" },
            { href: "/sharpen", label: "Sharpen your ranking" },
          ].map((l) => (
            <Link key={l.href} href={l.href} className="link-group__row">
              <span>{l.label}</span>
              <ArrowIcon size={18} />
            </Link>
          ))}
        </nav>

        <button className="btn btn--ghost btn--block" style={{ marginTop: 20 }} onClick={signOut}>
          Sign out
        </button>
        <p className="muted" style={{ textAlign: "center", fontSize: 13, margin: "8px 0 0" }}>
          <Link href="/privacy">Privacy</Link> · <Link href="/terms">Terms</Link>
        </p>
      </main>

      {openStamp && (
        <div className="sheet-backdrop" onClick={closeStamp}>
          <div className="sheet" role="dialog" aria-modal="true" aria-label={`${openStamp.label} books`} onClick={(e) => e.stopPropagation()}>
            <div className="sheet__grab" />
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span className="stamp" style={{ background: openStamp.count ? openStamp.bg : "var(--well)", color: openStamp.count ? openStamp.fg : "var(--muted)", width: 64, minHeight: 64, flexShrink: 0 }}>
                <span className="m" style={{ fontWeight: 700, fontSize: 18 }}>{openStamp.count}</span>
              </span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <h2 className="g" style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: "-0.01em" }}>{openStamp.label}</h2>
                <p className="muted" style={{ margin: "2px 0 0", fontSize: 13 }}>
                  {openStamp.count ? `${openStamp.count} ranked · best first` : "No stamp yet"}
                </p>
              </div>
              {stampBooks.length > 0 && (
                <button className="btn btn--quiet" style={{ minHeight: 36, fontSize: 13, padding: "0 12px" }}
                  onClick={() => (fixing ? closeStamp() : setFixing(liveStampBooks))}>
                  {fixing ? "Done" : "Fix genres"}
                </button>
              )}
            </div>
            {fixing && <p className="muted" style={{ fontSize: 13, margin: "10px 0 0" }}>Pick the right genre for any book that doesn&rsquo;t belong here.</p>}
            {stampBooks.length === 0 ? (
              <div style={{ marginTop: 20 }}>
                <p style={{ margin: 0, fontSize: 15, color: "var(--ink-2)" }}>Rank a {openStamp.label.toLowerCase()} book to earn this stamp.</p>
                <Link href="/add" className="btn btn--block" style={{ marginTop: 16 }}>Rank a book</Link>
              </div>
            ) : (
              <ol style={{ listStyle: "none", margin: "12px 0 0", padding: 0, maxHeight: "60vh", overflowY: "auto" }}>
                {stampBooks.map((e, i) => (
                  <li key={e.id}>
                    {fixing ? (
                      <div className="book-row" style={{ gap: 12, flexWrap: "wrap" }}>
                        <Cover book={e.book} width={36} />
                        <span className="book-row__body">
                          <span className="book-row__title" style={{ display: "block", fontSize: 15 }}>{e.book.title}</span>
                          <span className="book-row__sub" style={{ display: "block" }}>{fixNote[e.book_id] ?? e.book.author}</span>
                        </span>
                        <label className="sort-select">
                          <span className="visually-hidden">Genre for {e.book.title}</span>
                          <select value={picked[e.book_id] ?? stamp ?? ""} onChange={(ev) => fixGenre(e.book_id, ev.target.value)}>
                            {GENRES.map((g) => <option key={g.key} value={g.key}>{g.label}</option>)}
                          </select>
                        </label>
                      </div>
                    ) : (
                    <Link href={`/book/${e.book_id}`} className="book-row">
                      <span className={`book-row__rank ${i < 3 ? "book-row__rank--top" : ""}`}>{i + 1}</span>
                      <Cover book={e.book} width={40} />
                      <span className="book-row__body">
                        <span className="book-row__title" style={{ display: "block" }}>{e.book.title}</span>
                        <span className="book-row__sub" style={{ display: "block" }}>{e.book.author} · #{e.rank} overall</span>
                      </span>
                      <ScoreChip score={e.score} bucket={e.bucket} />
                    </Link>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      )}

      {sorting && (
        <div className="sheet-backdrop" onClick={() => { setSorting(false); if (Object.keys(picked).length) reload(); }}>
          <div className="sheet" role="dialog" aria-modal="true" aria-label="Pick genres" onClick={(e) => e.stopPropagation()}>
            <div className="sheet__grab" />
            <h2 className="g" style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: "-0.01em" }}>Pick a genre</h2>
            <p className="muted" style={{ margin: "4px 0 0", fontSize: 13 }}>We couldn&rsquo;t find these in the catalogue. Your pick counts toward your passport, and you can change it anytime.</p>
            <ul style={{ listStyle: "none", margin: "12px 0 0", padding: 0, maxHeight: "60vh", overflowY: "auto" }}>
              {sortList.map((e) => (
                <li key={e.id} className="book-row" style={{ gap: 12 }}>
                  <Cover book={e.book} width={36} />
                  <span className="book-row__body">
                    <span className="book-row__title" style={{ display: "block", fontSize: 15 }}>{e.book.title}</span>
                    <span className="book-row__sub" style={{ display: "block" }}>{e.book.author}</span>
                  </span>
                  <label className="sort-select">
                    <span className="visually-hidden">Genre for {e.book.title}</span>
                    <select value={picked[e.book_id] ?? e.book.genres?.[0] ?? ""} onChange={(ev) => pickGenre(e.book_id, ev.target.value)}>
                      <option value="" disabled>Genre</option>
                      {GENRES.map((g) => <option key={g.key} value={g.key}>{g.label}</option>)}
                    </select>
                  </label>
                </li>
              ))}
            </ul>
            <button className="btn btn--block" style={{ marginTop: 16 }} onClick={() => { setSorting(false); if (Object.keys(picked).length) reload(); }}>Done</button>
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


      {picking && profile && (
        <AvatarPicker
          profile={profile}
          earned={new Set((badges ?? []).filter((b) => b.earned).map((b) => b.key))}
          onClose={() => setPicking(false)}
          onSaved={async () => { await reloadProfile(); setPicking(false); }}
        />
      )}

      {editing && profile && (
        <EditProfile
          initial={{ name: profile.display_name ?? "", bio: profile.bio ?? "", goal: profile.yearly_goal, isPrivate: profile.is_private, isPublic: Boolean(profile.public_profile) }}
          username={profile.username ?? ""}
          onDeleted={() => router.replace("/")}
          onClose={() => setEditing(false)}
          onSaved={async () => { await reloadProfile(); setEditing(false); }}
        />
      )}
      <TabBar />
    </div>
  );
}

function EditProfile({
  initial, username, onClose, onSaved, onDeleted,
}: {
  initial: { name: string; bio: string; goal: number | null; isPrivate: boolean; isPublic: boolean };
  username: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
  onDeleted: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [typed, setTyped] = useState("");
  const [name, setName] = useState(initial.name);
  const [bio, setBio] = useState(initial.bio);
  const [goal, setGoal] = useState(initial.goal ? String(initial.goal) : "");
  const [isPrivate, setPrivate] = useState(initial.isPrivate);
  const [isPublic, setPublic] = useState(initial.isPublic);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      await deleteMyAccount();
      onDeleted();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn’t delete your account");
      setBusy(false);
    }
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const g = parseInt(goal, 10);
      await updateMyProfile({
        display_name: name.trim() || null,
        bio: bio.replace(/\s*\n\s*\n+/g, "\n").trim().slice(0, 160) || null,
        yearly_goal: Number.isFinite(g) && g > 0 ? Math.min(g, 1000) : null,
        is_private: isPrivate,
        public_profile: isPublic && !isPrivate,
      });
      await onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn’t save");
      setBusy(false);
    }
  }

  return (
    <div className="sheet-backdrop" onClick={() => !busy && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Edit profile" onClick={(e) => e.stopPropagation()}>
        <div className="sheet__grab" />
        <h2 className="g" style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: "-0.01em" }}>Edit profile</h2>
        <div className="field" style={{ marginTop: 16 }}>
          <label htmlFor="pname">Name</label>
          <input id="pname" className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
        </div>
        <div className="field" style={{ marginTop: 16 }}>
          <label htmlFor="pbio" style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Blurb</span>
            <span className="m muted" style={{ fontWeight: 400 }}>{bio.length}/160</span>
          </label>
          <textarea id="pbio" className="input" rows={3} value={bio} maxLength={160} onChange={(e) => setBio(e.target.value)}
            placeholder="Sci-fi lifer slowly converting to literary fiction. Will read anything with a map in the front." style={{ resize: "none", paddingTop: 12, lineHeight: 1.4, height: "auto" }} />
          <span className="muted" style={{ fontSize: 12 }}>Shows under your name. Everyone can see it, even if your shelf is private.</span>
        </div>
        <div className="field" style={{ marginTop: 16 }}>
          <label htmlFor="pgoal">Books to read in {new Date().getFullYear()}</label>
          <input id="pgoal" className="input" inputMode="numeric" value={goal} onChange={(e) => setGoal(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="e.g. 30" />
        </div>
        <label style={{ display: "flex", alignItems: "flex-start", gap: 12, marginTop: 16, cursor: "pointer" }}>
          <input type="checkbox" checked={isPrivate} onChange={(e) => setPrivate(e.target.checked)} style={{ width: 22, height: 22, marginTop: 2, accentColor: "var(--ink)" }} />
          <span>
            <span style={{ fontWeight: 600, display: "block" }}>Private shelf</span>
            <span className="muted" style={{ fontSize: 13 }}>Only you see your shelf and rankings. You won&rsquo;t appear in friends&rsquo; feeds, and your scores aren&rsquo;t used for anyone&rsquo;s community or predicted scores.</span>
          </span>
        </label>
        <label style={{ display: "flex", alignItems: "flex-start", gap: 12, marginTop: 16, cursor: isPrivate ? "default" : "pointer", opacity: isPrivate ? 0.5 : 1 }}>
          <input type="checkbox" checked={isPublic && !isPrivate} disabled={isPrivate} onChange={(e) => setPublic(e.target.checked)} style={{ width: 22, height: 22, marginTop: 2, accentColor: "var(--ink)" }} />
          <span>
            <span style={{ fontWeight: 600, display: "block" }}>Show my profile on the web</span>
            <span className="muted" style={{ fontSize: 13 }}>
              Anyone with your link can see your name, picture, blurb, top 10, what you&rsquo;re reading and badges. So can search engines.
            </span>
          </span>
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn btn--block" style={{ marginTop: 20 }} disabled={busy} onClick={save}>{busy ? "Saving…" : "Save"}</button>
        {!confirmDelete ? (
          <button className="btn btn--ghost btn--block" style={{ marginTop: 8, color: "#b42318" }} disabled={busy} onClick={() => setConfirmDelete(true)}>
            Delete account
          </button>
        ) : (
          <div style={{ marginTop: 16, padding: 14, borderRadius: 16, background: "#fdecea" }}>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.45, color: "#7a1a12" }}>
              This permanently deletes your account, shelf, rankings and follows. It can&rsquo;t be undone. Type <strong>{username}</strong> to confirm.
            </p>
            <label htmlFor="confirm-del" className="visually-hidden">Type your username to confirm</label>
            <input id="confirm-del" className="input" style={{ width: "100%", marginTop: 12 }} value={typed} onChange={(e) => setTyped(e.target.value)} autoCapitalize="none" autoComplete="off" />
            <button className="btn btn--block" style={{ marginTop: 12, background: "#b42318" }} disabled={busy || typed !== username} onClick={remove}>
              Delete forever
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
