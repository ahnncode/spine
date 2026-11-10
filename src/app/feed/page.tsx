"use client";

import { progressLabel } from "@/lib/progress";
import { STOP_REASON_LABEL } from "@/lib/stopReasons";
import { MentionText } from "@/components/Mentions";
import { timeAgo } from "@/lib/time";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { useEffect, useMemo, useState } from "react";
import { RequireAuth, useProfile } from "@/components/Auth";
import { Avatar, displayName } from "@/components/Avatar";
import { Name } from "@/components/Badge";
import { Cover } from "@/components/Cover";
import { EntryThread } from "@/components/EntryThread";
import { BellIcon } from "@/components/icons";
import { FollowButton } from "@/components/FollowButton";
import { FriendsMonth, SplitCard, WeekCard } from "@/components/FeedExtras";
import { CommentButton, HeartButton, NoteText, TagList, VibePill } from "@/components/Social";
import { WantButton } from "@/components/WantButton";
import { ScoreChip } from "@/components/ScoreChip";
import { TabBar } from "@/components/TabBar";
import { CheckInSheet } from "@/components/CheckInSheet";
import { InstallHint } from "@/components/InstallHint";
import { useShelf } from "@/components/useShelf";
import { useStreak } from "@/components/useStreak";
import {
  commentCounts, feedReadAlongs, feedUser, fetchBooks, fetchFeed, type FeedReadAlong, fetchFollowing, fetchHearts, fetchProfiles, rankEntries, tasteMatches,
  type Entry, type FeedItem, type HeartState, type Match, type Profile, type TargetType, isListened, poke } from "@/lib/data";
import type { Book } from "@/lib/books";
import { formatScore } from "@/lib/ranking";
import { FeedSkeleton } from "@/components/Skeleton";
import { useUnread } from "@/components/useUnread";
import { PickBooks } from "@/components/PickBooks";

export default function FeedPage() {
  return (
    <RequireAuth>
      <Feed />
    </RequireAuth>
  );
}

interface Loaded {
  items: FeedItem[];
  profiles: Map<string, Profile>;
  matches: Map<string, Match>;
  hearts: Map<string, HeartState>;
  comments: Map<string, number>;
  following: number;
  together: FeedReadAlong[];
  books: Map<string, Book>;
}

const ago = timeAgo;

function Feed() {
  const { profile } = useProfile();
  const { entries, reload } = useShelf();
  const [checking, setChecking] = useState<Entry | null>(null);
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [thread, setThread] = useState<string | null>(null);
  const unread = useUnread();
  // "Following" is friends' activity; "Everyone" is public activity across readread,
  // which is also what someone who follows nobody yet sees first.
  const [scope, setScope] = useState<"following" | "everyone">("following");
  const [cache, setCache] = useState<Partial<Record<"following" | "everyone", Loaded & { at: number }>>>({});
  // Screens stay alive in the background; effects re-run each time this one is
  // shown again, so this marks when. Older caches still show at once, then
  // refresh quietly, so a book you just ranked or checked in on appears.
  const [shownAt, setShownAt] = useState(0);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- runs on each show
    setShownAt(Date.now());
  }, []);
  const [followingIds, setFollowingIds] = useState<string[] | null>(null);
  const [picked, setPicked] = useState(false);
  const [openedAt] = useState(() => Date.now());

  useEffect(() => {
    fetchFollowing()
      .then((ids) => {
        setFollowingIds(ids);
        // Follows nobody yet: start on Everyone instead of an empty page.
        if (!ids.length && !picked) setScope("everyone");
      })
      .catch(() => setFollowingIds([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per visit
  }, []);

  useEffect(() => {
    if (followingIds === null || !shownAt) return;
    const cached = cache[scope];
    if (scope === "everyone" && !profile) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setData(null);
      return;
    }
    if (cached) {
      setData(cached);
      if (cached.at >= shownAt) return;
    } else {
      setData(null);
    }
    setError(null);
    let live = true;
    (async () => {
      const ids = followingIds;
      const [items, togetherAll] = await Promise.all([
        // Following is only people you follow; Everyone is all public activity, yours included.
        scope === "everyone" ? fetchFeed("everyone", { days: 21 }) : fetchFeed(ids),
        scope === "everyone" ? Promise.resolve([]) : feedReadAlongs(),
      ]);
      const together = togetherAll;
      const people = [...new Set([...items.map(feedUser), ...together.flatMap((t) => t.members)])];
      const targets: Array<{ type: TargetType; id: string }> = [];
      for (const i of items) {
        if (i.kind === "ranked" || i.kind === "dropped") targets.push({ type: "entry", id: i.entry.id });
        else if (i.kind === "checkin") targets.push({ type: "checkin", id: i.checkin.id });
      }
      const [profiles, matches, hearts, comments] = await Promise.all([
        fetchProfiles(people),
        tasteMatches(people),
        fetchHearts(targets),
        commentCounts(items.flatMap((i) => (i.kind === "ranked" || i.kind === "dropped" ? [i.entry.id] : []))),
      ]);
      const books = new Map((await fetchBooks([...new Set(together.map((t) => t.book_id))]).catch(() => [])).map((b) => [b.id, b]));
      const loaded = { items, profiles, matches, hearts, comments, following: ids.length, together, books, at: Date.now() };
      if (!live) return;
      setCache((c) => ({ ...c, [scope]: loaded }));
      setData(loaded);
    })().catch((e) => {
      // A quiet refresh that fails keeps what's already on screen.
      if (live && !cached) setError(e instanceof Error ? e.message : "Couldn’t load your feed");
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cache is read, not watched: watching it would refetch after every load
  }, [scope, profile, followingIds, shownAt]);
  const followSet = useMemo(() => new Set(followingIds ?? []), [followingIds]);


  const mine = useMemo(() => new Map(rankEntries(entries || []).map((e) => [e.book_id, e])), [entries]);
  const myStatus = useMemo(() => new Map((entries || []).map((e) => [e.book_id, e.status])), [entries]);
  const { streak, reloadCheckins } = useStreak(entries);
  const reading = (entries || []).filter((e) => e.status === "reading");
  // Recap for the week card: friends who finished books in the last seven days.
  const weekAgo = new Date(openedAt - 7 * 864e5).toISOString();
  const weekRanked = scope === "following" && data ? data.items.filter((i) => i.kind === "ranked" && i.at >= weekAgo && feedUser(i) !== profile?.id) : [];
  const weekFinishers = [...new Set(weekRanked.map(feedUser))].map((u) => displayName(data?.profiles.get(u)).split(" ")[0]);
  // Signed up but hasn't ranked or queued anything yet.
  const newReader = entries !== null && entries !== undefined && !entries.some((e) => e.status === "ranked" || e.status === "unsorted");

  return (
    <div className="app">
      <main className="screen">
        <div className="topbar">
          <Logo size={30} />
          <div style={{ display: "flex", gap: 8 }}>
            <Link href="/notifications" className="icon-btn" style={{ position: "relative" }} aria-label={unread ? `Notifications, ${unread} new` : "Notifications"}>
              <BellIcon size={20} />
              {unread > 0 && <span className="unread-dot" />}
            </Link>
          </div>
        </div>

        <InstallHint />

        {streak.weeks > 0 && !streak.activeThisWeek && (
          reading[0] ? (
            <button className="notice" style={{ display: "block", width: "100%", textAlign: "left", border: 0, marginTop: 16 }} onClick={() => setChecking(reading[0])}>
              <strong>Keep your {streak.weeks}-week streak.</strong> Check in on {reading[0].book.title} before Sunday.
            </button>
          ) : (
            <Link href="/add" className="notice" style={{ display: "block", marginTop: 16, textDecoration: "none" }}>
              <strong>Keep your {streak.weeks}-week streak.</strong> Start or rank a book before Sunday.
            </Link>
          )
        )}

        {/* Nothing ranked yet: start with books, not an empty feed. */}
        {newReader && <PickBooks embedded />}

        <div className="segmented" role="tablist" aria-label="Feed" style={{ marginTop: newReader ? 32 : 16 }}>
          <button role="tab" aria-selected={scope === "following"} onClick={() => { setPicked(true); setScope("following"); }}>Following</button>
          <button role="tab" aria-selected={scope === "everyone"} onClick={() => { setPicked(true); setScope("everyone"); }}>Everyone</button>
        </div>

        {scope === "everyone" && followingIds !== null && followingIds.length < 3 && !newReader && (
          <div className="card" style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 12 }}>
            <p style={{ margin: 0, flex: 1, fontSize: 14, lineHeight: 1.4 }}>
              {followingIds.length ? "Follow a few more readers to fill your own feed." : "This is everyone on readread. Follow readers you like and they’ll show up under Following."}
            </p>
            <Link href="/people" className="btn" style={{ flexShrink: 0, minHeight: 40 }}>Find people</Link>
          </div>
        )}

        {scope === "following" && data && <WeekCard finished={weekRanked.length} finishers={weekFinishers} streakWeeks={streak.weeks} />}

        {error && <p className="error" role="alert">{error}</p>}
        {!data && !error && <FeedSkeleton />}

        {data && data.items.length === 0 && scope === "everyone" && (
          <div className="empty">
            <p className="h2">Quiet on readread</p>
            <p style={{ margin: "0 0 16px", fontSize: 14 }}>Nobody with a public shelf has ranked anything in the last few weeks. Invite a friend to get things going.</p>
            <Link href="/people" className="btn">Invite friends</Link>
          </div>
        )}

        {data && !newReader && data.items.length === 0 && data.together.length === 0 && scope === "following" && (
          <div className="card" style={{ marginTop: 16 }}>
            <p className="g" style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.01em", lineHeight: 1.05, margin: 0 }}>
              {data.following ? "Quiet in here." : "Your feed needs friends."}
            </p>
            <p className="muted" style={{ fontSize: 14, lineHeight: 1.45, margin: "10px 0 0" }}>
              {data.following
                ? "When people you follow rank or start books, it shows up here."
                : "Follow a few people and you’ll see what they’re reading and how they rank it."}
            </p>
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <Link href="/people" className="btn" style={{ flex: 1 }}>Find people to follow</Link>
              <button className="btn btn--quiet" onClick={() => { setPicked(true); setScope("everyone"); }}>See everyone</button>
            </div>
          </div>
        )}

        {data && (data.items.length > 0 || data.together.length > 0) && (
          <div className="feed">
            {[
              ...data.items.map((item) => ({ at: item.at, item, together: null as FeedReadAlong | null })),
              ...data.together.map((t) => ({ at: t.revealed_at ?? t.created_at, item: null as FeedItem | null, together: t })),
            ].sort((a, b) => b.at.localeCompare(a.at)).flatMap(({ item: row, together: t }, idx, all) => {
              // A disagreement after the third post, the month's board after the eighth (or at the end).
              const extras = scope !== "following" ? [] : [
                idx === Math.min(2, all.length - 1) && <SplitCard key="split" friends={followingIds ?? []} mine={mine} me={profile?.id} />,
                idx === Math.min(7, all.length - 1) && <FriendsMonth key="month" friends={followingIds ?? []} me={profile?.id} />,
              ].filter(Boolean);
              const post = (() => {
              if (t) return <TogetherCard key={`t-${t.id}`} t={t} book={data.books.get(t.book_id)} people={data.profiles} me={profile?.id} />;
              const item = row!;
              const uid = feedUser(item);
              const p = data.profiles.get(uid);
              const m = data.matches.get(uid);
              const book = item.kind === "checkin" ? item.checkin.book : item.entry.book;
              const bookId = item.kind === "checkin" ? item.checkin.book_id : item.entry.book_id;
              const myEntry = mine.get(bookId);
              const status = myStatus.get(bookId);
              const key = item.kind === "checkin" ? `c-${item.checkin.id}` : `${item.kind}-${item.entry.id}`;
              const isMe = uid === profile?.id;
              const heard = item.kind !== "checkin" && isListened(item.entry.format);
              const verb =
                item.kind === "ranked"
                  ? heard ? "listened to and ranked a book" : "ranked a book"
                  : item.kind === "checkin"
                    ? item.checkin.chapter != null && item.checkin.chapter > 0
                      ? `finished chapter ${item.checkin.chapter}${item.checkin.chapter_total ? ` of ${item.checkin.chapter_total}` : ""}`
                      : item.checkin.progress_pct != null && item.checkin.progress_pct > 0
                      ? `is ${item.checkin.progress_pct}% through`
                      : "checked in"
                    : item.kind === "dropped"
                      ? "didn’t finish a book"
                      : item.entry.retrying
                        ? "is giving a book another go"
                        : heard ? "started listening to" : "started reading";
              const stoppedAt = item.kind === "dropped" ? progressLabel(item.entry) : null;
              return (
                <article key={key} className="feed-card">
                  <div className="feed-card__head">
                    <Avatar profile={p} size={40} link />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Link href={p?.username ? `/u/${p.username}` : "#"} style={{ fontWeight: 700, textDecoration: "none" }}><Name profile={p} /></Link>{" "}
                      {verb}
                      <div className="when">{ago(item.at)}</div>
                    </div>
                    {!isMe && m?.match != null && <span className="pill pill--cobalt m" style={{ fontWeight: 700 }}>{m.match}% match</span>}
                    {!isMe && scope === "everyone" && !followSet.has(uid) && (
                      <FollowButton userId={uid} initial={false} onChange={(on) => setFollowingIds((f) => (f ? (on ? [...f, uid] : f.filter((x) => x !== uid)) : f))} />
                    )}
                  </div>
                  <Link href={`/book/${bookId}`} className="feed-card__book">
                    <Cover book={book} width={item.kind === "ranked" ? 76 : 56} listened={heard} state={item.kind === "dropped" ? "dropped" : null} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="feed-card__title">{book.title}</div>
                      <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>{book.author}</div>
                      {item.kind === "ranked" && (
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12 }}>
                          <ScoreChip score={item.entry.score} bucket={item.entry.bucket} size={40} />
                          <span style={{ fontSize: 13, lineHeight: 1.3 }}>
                            #{item.entry.overall_rank} on {isMe ? "your" : "their"} shelf
                            {!isMe && myEntry && (
                              <>
                                <br />
                                <span className="muted">
                                  {Math.abs(myEntry.score - item.entry.score) >= 2
                                    ? `You disagree. You gave it ${formatScore(myEntry.score)}`
                                    : `You agree. You gave it ${formatScore(myEntry.score)}`}
                                </span>
                              </>
                            )}
                          </span>
                        </div>
                      )}
                      {item.kind === "dropped" && (
                        <div style={{ marginTop: 8, fontSize: 13, lineHeight: 1.35 }}>
                          <span className="state-pill state-pill--dropped" style={{ marginRight: 8 }}>DNF</span>
                          <span className="muted">
                            {[stoppedAt && stoppedAt !== "Not started" ? `Got to ${stoppedAt.replace(/^Chapter/, "chapter")}` : null, item.entry.stop_reason ? STOP_REASON_LABEL[item.entry.stop_reason] : null].filter(Boolean).join(" · ")}
                          </span>
                          {!isMe && myEntry && (
                            <span className="muted" style={{ display: "block", marginTop: 4 }}>
                              You ranked it {formatScore(myEntry.score)}.{myEntry.score >= 6.7 ? " You two disagree." : ""}
                            </span>
                          )}
                        </div>
                      )}
                      {item.kind === "reading" && item.entry.retrying && progressLabel(item.entry) && (
                        <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>Carrying on from {progressLabel(item.entry)!.replace(/^Chapter/, "chapter")}</div>
                      )}
                      {item.kind === "checkin" && item.checkin.progress_pct != null && (
                        <div className="bar" style={{ height: 6, marginTop: 12 }}><span style={{ width: `${item.checkin.progress_pct}%`, background: "var(--accent)" }} /></div>
                      )}
                    </div>
                  </Link>

                  {item.kind === "ranked" && (item.entry.tags?.length > 0 || item.entry.note) && (
                    <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                      <TagList tags={item.entry.tags} max={3} />
                      {item.entry.note && (
                        <button style={{ background: "none", border: 0, padding: 0, textAlign: "left" }} onClick={() => setThread(item.entry.id)} aria-label="Read the full note and comments">
                          <NoteText note={item.entry.note} spoiler={item.entry.note_spoiler} clamp={4} links={false} />
                        </button>
                      )}
                    </div>
                  )}
                  {item.kind === "dropped" && item.entry.stop_note && (
                    <div style={{ marginTop: 12 }}>
                      <button style={{ background: "none", border: 0, padding: 0, textAlign: "left" }} onClick={() => setThread(item.entry.id)} aria-label="Read the full note and comments">
                        <NoteText note={item.entry.stop_note} spoiler={Boolean(item.entry.stop_note_spoiler)} clamp={4} links={false} />
                      </button>
                    </div>
                  )}
                  {item.kind === "checkin" && (item.checkin.note || item.checkin.vibe) && (
                    <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-start" }}>
                      <VibePill vibe={item.checkin.vibe} />
                      {item.checkin.note && <p className="note"><MentionText text={item.checkin.note} /></p>}
                    </div>
                  )}

                  {(item.kind !== "reading" || !status || status === "want") && (
                    <div className="actions">
                      {item.kind === "ranked" && (
                        <>
                          <HeartButton type="entry" id={item.entry.id} initial={data.hearts.get(`entry:${item.entry.id}`)} />
                          <CommentButton count={data.comments.get(item.entry.id) ?? 0} onClick={() => setThread(item.entry.id)} />
                        </>
                      )}
                      {item.kind === "checkin" && (
                        <HeartButton type="checkin" id={item.checkin.id} initial={data.hearts.get(`checkin:${item.checkin.id}`)} />
                      )}
                      {item.kind === "dropped" && (
                        <>
                          <HeartButton type="entry" id={item.entry.id} initial={data.hearts.get(`entry:${item.entry.id}`)} />
                          <CommentButton count={data.comments.get(item.entry.id) ?? 0} onClick={() => setThread(item.entry.id)} />
                          {!isMe && <KeepGoingButton userId={uid} />}
                        </>
                      )}
                      <span style={{ flex: 1 }} />
                      {/* Stays visible as "Saved" once added, instead of vanishing when your shelf updates. */}
                      {(!status || status === "want") && <WantButton key={`${bookId}-${status ?? "none"}`} bookId={bookId} initialSaved={status === "want"} />}
                    </div>
                  )}
                </article>
              );
              })();
              return [post, ...extras];
            })}
          </div>
        )}
      </main>
      {thread && (
        <EntryThread
          entryId={thread}
          onClose={() => setThread(null)}
          onCountChange={(n) => setData((d) => (d ? { ...d, comments: new Map(d.comments).set(thread, n) } : d))}
        />
      )}
      {checking && (
        <CheckInSheet
          entry={checking}
          onClose={() => setChecking(null)}
          onDone={async () => { await Promise.all([reload(), reloadCheckins()]); setChecking(null); }}
        />
      )}
      <TabBar />
    </div>
  );
}

function names(ids: string[], people: Map<string, Profile>, me?: string): string {
  const n = ids.map((id) => (id === me ? "You" : displayName(people.get(id)).split(" ")[0]));
  if (n.length <= 2) return n.join(" and ");
  return `${n.slice(0, -1).join(", ")} and ${n[n.length - 1]}`;
}

/** "Paul, Maya and Pete are reading X together" / "...finished X together". */
function TogetherCard({ t, book, people, me }: { t: FeedReadAlong; book?: Book; people: Map<string, Profile>; me?: string }) {
  if (!book) return null;
  const inIt = Boolean(me && t.members.includes(me));
  const who = names(t.members, people, me);
  const plural = t.members.length > 1 || t.members[0] === me;
  const line = t.revealed_at ? `finished ${book.title} together` : `${plural ? "are" : "is"} reading ${book.title} together`;
  return (
    <article className="feed-card">
      <div className="feed-card__head">
        <span className="avatar-stack">
          {t.members.slice(0, 4).map((u) => <Avatar key={u} profile={people.get(u)} size={32} />)}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontWeight: 700 }}>{who}</span> {line}
          <div className="when">{ago(t.revealed_at ?? t.created_at)}</div>
        </div>
      </div>
      <Link href={inIt ? `/together/${t.id}` : `/book/${t.book_id}`} className="feed-card__book">
        <Cover book={book} width={56} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="feed-card__title">{book.title}</div>
          <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>{book.author}</div>
          <div style={{ fontSize: 13, marginTop: 8, color: "var(--cobalt-ink)", fontWeight: 600 }}>
            {inIt ? (t.revealed_at ? "See the verdict →" : "Open the read-along →") : "See the book →"}
          </div>
        </div>
      </Link>
    </article>
  );
}

/** On someone's "didn't finish" post: a one-tap nudge (a poke) to give it another go. */
function KeepGoingButton({ userId }: { userId: string }) {
  const [state, setState] = useState<"idle" | "sent" | "already">("idle");
  return (
    <button
      className="small-btn"
      disabled={state !== "idle"}
      onClick={() => poke(userId).then((r) => setState(r === "ok" ? "sent" : "already")).catch(() => setState("already"))}
    >
      {state === "idle" ? "Push them to keep going" : state === "sent" ? "Nudged" : "Nudged today"}
    </button>
  );
}
