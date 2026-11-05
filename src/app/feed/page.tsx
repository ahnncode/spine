"use client";

import { MentionText } from "@/components/Mentions";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { useEffect, useMemo, useState } from "react";
import { RequireAuth, useProfile } from "@/components/Auth";
import { Avatar, displayName } from "@/components/Avatar";
import { Name } from "@/components/Badge";
import { Cover } from "@/components/Cover";
import { EntryThread } from "@/components/EntryThread";
import { ArrowIcon, BellIcon, AddFriendIcon } from "@/components/icons";
import { CommentButton, HeartButton, NoteText, TagList, VibePill } from "@/components/Social";
import { WantButton } from "@/components/WantButton";
import { ScoreChip } from "@/components/ScoreChip";
import { TabBar } from "@/components/TabBar";
import { CheckInSheet } from "@/components/CheckInSheet";
import { InstallHint } from "@/components/InstallHint";
import { useShelf } from "@/components/useShelf";
import { useStreak } from "@/components/useStreak";
import {
  commentCounts, feedReadAlongs, feedUser, fetchBooks, fetchFeed, type FeedReadAlong, fetchFollowing, fetchHearts, fetchProfiles, rankEntries, tasteMatches, unreadCount,
  type Entry, type FeedItem, type HeartState, type Match, type Profile, type TargetType,
} from "@/lib/data";
import type { Book } from "@/lib/books";
import { formatScore } from "@/lib/ranking";

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

function ago(iso: string): string {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  if (s < 86400 * 7) return `${Math.round(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function Feed() {
  const { profile } = useProfile();
  const { entries, reload } = useShelf();
  const [checking, setChecking] = useState<Entry | null>(null);
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [thread, setThread] = useState<string | null>(null);
  const [unread, setUnread] = useState(0);
  // "Following" is friends' activity; "You" is everything you've posted.
  const [scope, setScope] = useState<"following" | "you">("following");
  const [cache, setCache] = useState<Partial<Record<"following" | "you", Loaded>>>({});

  useEffect(() => {
    if (cache[scope] || (scope === "you" && !profile)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setData(cache[scope] ?? null);
      return;
    }
    setData(null);
    setError(null);
    (async () => {
      const ids = scope === "you" ? [profile!.id] : await fetchFollowing();
      const [items, togetherAll] = await Promise.all([
        fetchFeed(ids, scope === "you" ? { days: 3650, limit: 150 } : {}),
        feedReadAlongs(),
      ]);
      const together = scope === "you" ? togetherAll.filter((t) => t.members.includes(profile!.id)) : togetherAll;
      const people = [...new Set([...items.map(feedUser), ...together.flatMap((t) => t.members)])];
      const targets: Array<{ type: TargetType; id: string }> = [];
      for (const i of items) {
        if (i.kind === "ranked") targets.push({ type: "entry", id: i.entry.id });
        else if (i.kind === "checkin") targets.push({ type: "checkin", id: i.checkin.id });
      }
      const [profiles, matches, hearts, comments] = await Promise.all([
        fetchProfiles(people),
        tasteMatches(people),
        fetchHearts(targets),
        commentCounts(items.filter((i) => i.kind === "ranked").map((i) => (i.kind === "ranked" ? i.entry.id : ""))),
      ]);
      const books = new Map((await fetchBooks([...new Set(together.map((t) => t.book_id))]).catch(() => [])).map((b) => [b.id, b]));
      const loaded = { items, profiles, matches, hearts, comments, following: ids.length, together, books };
      setCache((c) => ({ ...c, [scope]: loaded }));
      setData(loaded);
    })().catch((e) => setError(e instanceof Error ? e.message : "Couldn’t load your feed"));
  }, [scope, profile, cache]);

  useEffect(() => {
    unreadCount().then(setUnread).catch(() => {});
  }, []);

  const mine = useMemo(() => new Map(rankEntries(entries || []).map((e) => [e.book_id, e])), [entries]);
  const myStatus = useMemo(() => new Map((entries || []).map((e) => [e.book_id, e.status])), [entries]);
  const { streak, reloadCheckins } = useStreak(entries);
  const reading = (entries || []).filter((e) => e.status === "reading");

  return (
    <div className="app">
      <main className="screen">
        <div className="topbar">
          <Logo size={30} />
          <div style={{ display: "flex", gap: 8 }}>
            <Link href="/people" className="icon-btn" aria-label="Find friends">
              <AddFriendIcon size={21} />
            </Link>
            <Link href="/notifications" className="icon-btn" style={{ position: "relative" }} aria-label={unread ? `Notifications, ${unread} new` : "Notifications"}>
              <BellIcon size={20} />
              {unread > 0 && <span className="unread-dot" />}
            </Link>
            <Link href="/you" aria-label="Your profile" style={{ textDecoration: "none" }}>
              <Avatar profile={profile} size={44} />
            </Link>
          </div>
        </div>

        <InstallHint />

        {streak.weeks > 0 && !streak.activeThisWeek && (
          reading[0] ? (
            <button className="notice" style={{ display: "block", width: "100%", textAlign: "left", border: 0, marginTop: 14 }} onClick={() => setChecking(reading[0])}>
              <strong>Keep your {streak.weeks}-week streak.</strong> Check in on {reading[0].book.title} before Sunday.
            </button>
          ) : (
            <Link href="/add" className="notice" style={{ display: "block", marginTop: 14, textDecoration: "none" }}>
              <strong>Keep your {streak.weeks}-week streak.</strong> Start or rank a book before Sunday.
            </Link>
          )
        )}

        {reading.length > 0 && (
          <section aria-label="Your reading" style={{ marginTop: 14 }}>
            <div className="reading-strip" style={{ marginTop: 0 }}>
              {reading.map((e) => (
                <div key={e.id} className="reading-card" style={{ width: 230, flexDirection: "row", alignItems: "center", textAlign: "left" }}>
                  {/* Cover and title open the book; the progress area checks in. */}
                  <Link href={`/book/${e.book_id}`} aria-label={`${e.book.title}: book page`} style={{ flexShrink: 0 }}>
                    <Cover book={e.book} width={40} />
                  </Link>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <Link href={`/book/${e.book_id}`} className="reading-card__title" style={{ fontSize: 14, color: "inherit", textDecoration: "none", display: "block" }}>{e.book.title}</Link>
                    <button className="reading-card__checkin" onClick={() => setChecking(e)} aria-label={`Check in on ${e.book.title}`}>
                      <span className="bar" style={{ display: "block", height: 5, marginTop: 6 }}><span style={{ width: `${e.progress_pct ?? 0}%`, background: "var(--accent)" }} /></span>
                      <span className="m muted" style={{ fontSize: 11, display: "block", marginTop: 4 }}>
                        {e.progress_pct != null ? `${e.progress_pct}% · ` : ""}<span style={{ color: "var(--cobalt-ink)", fontWeight: 700 }}>Check in</span>
                      </span>
                    </button>
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="segmented" role="tablist" aria-label="Feed" style={{ marginTop: 16 }}>
          <button role="tab" aria-selected={scope === "following"} onClick={() => setScope("following")}>Following</button>
          <button role="tab" aria-selected={scope === "you"} onClick={() => setScope("you")}>You</button>
        </div>

        {error && <p className="error" role="alert">{error}</p>}
        {!data && !error && <div aria-busy="true" style={{ minHeight: 240 }} />}

        {data && data.items.length === 0 && data.together.length === 0 && scope === "you" && (
          <div className="empty">
            <p className="h2">Nothing posted yet</p>
            <p style={{ margin: "0 0 16px", fontSize: 14 }}>Rank a book or check in on what you&rsquo;re reading, and it shows up here with any hearts and comments.</p>
            <Link href="/add" className="btn">Rank a book</Link>
          </div>
        )}

        {data && data.items.length === 0 && data.together.length === 0 && scope === "following" && (
          <div className="card card--ink" style={{ marginTop: 16 }}>
            <p className="d" style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.05, margin: 0 }}>
              {data.following ? "Quiet in here." : "Reading’s better with friends."}
            </p>
            <p style={{ color: "#c9c8c2", fontSize: 14, lineHeight: 1.45, margin: "10px 0 0" }}>
              {data.following
                ? "When people you follow rank or start books, it shows up here."
                : "Follow people to see what they’re reading, how they rank it, and how your taste compares."}
            </p>
            <Link href="/people" className="btn btn--block" style={{ marginTop: 16, background: "#fff", color: "var(--ink)" }}>
              Find people to follow
            </Link>
          </div>
        )}

        {data && (data.items.length > 0 || data.together.length > 0) && (
          <div className="feed">
            {[
              ...data.items.map((item) => ({ at: item.at, item, together: null as FeedReadAlong | null })),
              ...data.together.map((t) => ({ at: t.revealed_at ?? t.created_at, item: null as FeedItem | null, together: t })),
            ].sort((a, b) => b.at.localeCompare(a.at)).map(({ item: row, together: t }) => {
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
              const verb =
                item.kind === "ranked"
                  ? "ranked a book"
                  : item.kind === "checkin"
                    ? item.checkin.progress_pct != null && item.checkin.progress_pct > 0
                      ? `is ${item.checkin.progress_pct}% through`
                      : "checked in"
                    : "started reading";
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
                  </div>
                  <Link href={`/book/${bookId}`} className="feed-card__book">
                    <Cover book={book} width={item.kind === "ranked" ? 76 : 56} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="feed-card__title">{book.title}</div>
                      <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>{book.author}</div>
                      {item.kind === "ranked" && (
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
                          <ScoreChip score={item.entry.score} bucket={item.entry.bucket} size={40} />
                          <span style={{ fontSize: 13, lineHeight: 1.3 }}>
                            #{item.entry.overall_rank} on {isMe ? "your" : "their"} shelf
                            {!isMe && myEntry && (
                              <>
                                <br />
                                <span className="muted">
                                  {Math.abs(myEntry.score - item.entry.score) >= 2
                                    ? `You disagree — your ${formatScore(myEntry.score)}`
                                    : `You agree — your ${formatScore(myEntry.score)}`}
                                </span>
                              </>
                            )}
                          </span>
                        </div>
                      )}
                      {item.kind === "checkin" && item.checkin.progress_pct != null && (
                        <div className="bar" style={{ height: 6, marginTop: 10 }}><span style={{ width: `${item.checkin.progress_pct}%`, background: "var(--accent)" }} /></div>
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
                      <span style={{ flex: 1 }} />
                      {/* Stays visible as "Saved" once added, instead of vanishing when your shelf updates. */}
                      {(!status || status === "want") && <WantButton key={`${bookId}-${status ?? "none"}`} bookId={bookId} initialSaved={status === "want"} />}
                    </div>
                  )}
                </article>
              );
            })}
            {scope === "following" && (
              <Link href="/people" className="card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", textDecoration: "none", padding: "16px 18px" }}>
                <span style={{ fontWeight: 600 }}>Find more people</span>
                <ArrowIcon size={18} />
              </Link>
            )}
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
