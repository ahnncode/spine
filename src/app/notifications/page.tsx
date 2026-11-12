"use client";

import Link from "next/link";
import { timeAgo } from "@/lib/time";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/Auth";
import { Avatar } from "@/components/Avatar";
import { Medallion, Name } from "@/components/Badge";
import { BADGE } from "@/lib/badges";
import { EntryThread } from "@/components/EntryThread";
import { FollowButton } from "@/components/FollowButton";
import { BackIcon } from "@/components/icons";
import { TabBar } from "@/components/TabBar";
import { RowsSkeleton } from "@/components/Skeleton";
import { clearUnread } from "@/components/useUnread";
import { useShelf } from "@/components/useShelf";
import { CheckInSheet } from "@/components/CheckInSheet";
import { Cover } from "@/components/Cover";
import type { Entry } from "@/lib/data";
import { fetchClubLinks, type ClubLink } from "@/lib/clubs";
import {
  fetchCheckinsById, fetchFollowing, fetchNotifications, fetchProfiles, markAllRead,
  fetchMyReadAlongs, fetchRoomCommentsById, type Checkin, type Notification, type Profile, type ReadAlong, type RoomComment,
} from "@/lib/data";

export default function NotificationsPage() {
  return (
    <RequireAuth>
      <Inner />
    </RequireAuth>
  );
}

const ago = timeAgo;

interface Loaded {
  items: Notification[];
  people: Map<string, Profile>;
  checkins: Map<string, Checkin>;
  following: Set<string>;
  readAlongs: Map<string, ReadAlong>;
  rooms: Map<string, RoomComment>;
  clubs: Map<string, ClubLink>;
}

function Inner() {
  const [data, setData] = useState<Loaded | null>(null);
  const [thread, setThread] = useState<string | null>(null);
  // A poke isn't about one book: check in on your current read, or pick one.
  const { entries, reload } = useShelf();
  const reading = (entries || []).filter((e) => e.status === "reading");
  const [checking, setChecking] = useState<Entry | null>(null);
  const [choosing, setChoosing] = useState(false);

  useEffect(() => {
    (async () => {
      const items = await fetchNotifications();
      const roomIds = items.filter((n) => n.target_type === "chapter_comment" && n.target_id).map((n) => n.target_id!);
      const clubReads = items.filter((n) => n.target_type === "club_read" && n.target_id).map((n) => n.target_id!);
      const clubComments = items.filter((n) => n.target_type === "club_comment" && n.target_id).map((n) => n.target_id!);
      const clubIds = items.filter((n) => n.target_type === "club" && n.target_id).map((n) => n.target_id!);
      const [people, checkins, following, readAlongs, rooms, clubs] = await Promise.all([
        fetchProfiles([...new Set(items.map((n) => n.actor_id))]),
        fetchCheckinsById(items.filter((n) => n.target_type === "checkin" && n.target_id).map((n) => n.target_id!)),
        fetchFollowing(),
        items.some((n) => n.kind === "read_along") ? fetchMyReadAlongs().catch(() => []) : Promise.resolve([] as ReadAlong[]),
        fetchRoomCommentsById([...new Set(roomIds)]).catch(() => new Map<string, RoomComment>()),
        fetchClubLinks([...new Set(clubReads)], [...new Set(clubComments)], [...new Set(clubIds)]).catch(() => new Map<string, ClubLink>()),
      ]);
      setData({ items, people, checkins, following: new Set(following), readAlongs: new Map(readAlongs.map((r) => [r.id, r])), rooms, clubs });
      // Opening the list counts as reading it.
      if (items.some((n) => !n.read_at)) markAllRead().then(clearUnread).catch(() => {});
    })().catch(() => setData({ items: [], people: new Map(), checkins: new Map(), following: new Set(), readAlongs: new Map(), rooms: new Map(), clubs: new Map() }));
  }, []);

  function describe(n: Notification): string {
    if (n.kind === "follow") return "started following you";
    if (n.kind === "poke") return "poked you. How’s the book going?";
    if (n.kind === "read_along") {
      const title = data?.readAlongs.get(n.target_id ?? "")?.book.title;
      const on = title ? ` ${title}` : " a book";
      if (n.detail === "invite") return `invited you to read${on} together`;
      if (n.detail === "joined") return `joined your read-along of${on}`;
      if (n.detail === "message") return `posted in your read-along of${on}`;
      if (n.detail === "verdict") return `finished${on}. The verdict is in`;
      if (n.detail === "paused") return `put${on} aside for now`;
      if (n.detail === "dropped") return `didn’t finish${on}`;
      return `updated your read-along of${on}`;
    }
    if (n.kind === "mention") {
      if (n.target_type === "checkin") {
        const c = data?.checkins.get(n.target_id ?? "");
        return c ? `mentioned you in a check-in on ${c.book.title}` : "mentioned you in a check-in";
      }
      return "mentioned you";
    }
    if (n.kind === "ask") {
      if (n.detail === "voted") return "voted on what you should read next";
      if (n.detail === "called") return "started the book you voted for. You called it";
      return "wants help picking their next book";
    }
    if (n.kind === "room") {
      const c = data?.rooms.get(n.target_id ?? "");
      return c ? `replied to you in ${c.chapter === 0 ? "the whole-book room" : `the chapter ${c.chapter} room`}` : "replied to you in a chapter room";
    }
    if (n.kind === "club") {
      const c = data?.clubs.get(n.target_id ?? "");
      if (n.detail === "joined") return `joined ${c?.club ?? "your club"}`;
      if (n.detail === "finished") return c ? `wrapped up ${c.where} in ${c.club}. Rank it to add to the verdict` : "wrapped up your club’s book";
      if (n.detail === "new_read") return c ? `picked ${c.where} for ${c.club}` : "picked your club’s next book";
      return c ? `replied to you in ${c.club}, ${c.where}` : "replied to you in your club";
    }
    if (n.target_type === "club_comment") {
      const c = data?.clubs.get(n.target_id ?? "");
      return c ? `hearted your comment in ${c.club}, ${c.where}` : "hearted your comment in your club";
    }
    if (n.target_type === "chapter_comment") {
      const c = data?.rooms.get(n.target_id ?? "");
      return c ? `hearted your comment in ${c.chapter === 0 ? "the whole-book room" : `the chapter ${c.chapter} room`}` : "hearted your comment in a chapter room";
    }
    if (n.kind === "comment") return "commented on your ranking";
    if (n.target_type === "checkin") {
      const c = data?.checkins.get(n.target_id ?? "");
      return c ? `hearted your check-in on ${c.book.title}` : "hearted your check-in";
    }
    return "hearted your ranking";
  }

  return (
    <div className="app">
      <main className="screen">
        <div className="topbar">
          <Link href="/feed" className="icon-btn" aria-label="Back to feed"><BackIcon size={20} /></Link>
        </div>
        <h1 className="h1" style={{ marginTop: 12 }}>Notifications</h1>

        {!data && <RowsSkeleton avatar count={6} label="Loading notifications" />}
        {data && data.items.length === 0 && (
          <div className="empty">
            <p className="h2">Nothing yet</p>
            <p style={{ margin: "0 0 16px", fontSize: 14 }}>When a friend hearts, comments or pokes you, it lands here.</p>
            <Link href="/feed" className="btn">See what friends are reading</Link>
          </div>
        )}
        {data && data.items.length > 0 && (
          <ul style={{ listStyle: "none", margin: "12px 0 0", padding: 0 }}>
            {data.items.map((n) => {
              const p = data.people.get(n.actor_id);
              const opensThread = n.target_type === "entry" && n.target_id;
              const checkin = n.target_type === "checkin" ? data.checkins.get(n.target_id ?? "") : undefined;
              const badge = n.kind === "badge" && n.badge ? BADGE[n.badge] : undefined;
              const picks = n.kind === "picks";
              const body = picks ? (
                <>
                  <span aria-hidden="true" style={{ width: 40, height: 40, borderRadius: 999, background: "var(--panel)", color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 20, flexShrink: 0 }}>?</span>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 14, lineHeight: 1.4 }}>
                    <strong>Your weekly picks are here</strong>
                    <span className="muted" style={{ display: "block", fontSize: 13 }}>A mystery book to reveal, and a wildcard</span>
                    <span className="when" style={{ display: "block" }}>{ago(n.created_at)}</span>
                  </span>
                  {!n.read_at && <span aria-label="New" style={{ width: 8, height: 8, borderRadius: 4, background: "var(--accent)", flexShrink: 0 }} />}
                </>
              ) : badge ? (
                <>
                  <span style={{ width: 40, display: "flex", justifyContent: "center", flexShrink: 0 }}><Medallion badge={badge.key} earned size={40} /></span>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 14, lineHeight: 1.4 }}>
                    You earned <strong>{badge.name}</strong>
                    <span className="muted" style={{ display: "block", fontSize: 13 }}>{badge.how}</span>
                    <span className="when" style={{ display: "block" }}>{ago(n.created_at)}</span>
                  </span>
                  {!n.read_at && <span aria-label="New" style={{ width: 8, height: 8, borderRadius: 4, background: "var(--accent)", flexShrink: 0 }} />}
                </>
              ) : (
                <>
                  <Avatar profile={p} size={40} />
                  <span style={{ flex: 1, minWidth: 0, fontSize: 14, lineHeight: 1.4 }}>
                    <strong><Name profile={p} /></strong> {describe(n)}
                    <span className="when" style={{ display: "block" }}>{ago(n.created_at)}</span>
                  </span>
                  {!n.read_at && <span aria-label="New" style={{ width: 8, height: 8, borderRadius: 4, background: "var(--accent)", flexShrink: 0 }} />}
                </>
              );
              const rowStyle = {
                display: "flex", alignItems: "center", gap: 12, padding: "12px 0", width: "100%",
                textAlign: "left" as const, background: "none", border: 0, borderBottom: "1px solid var(--line)",
                color: "inherit", textDecoration: "none",
              };
              return (
                <li key={n.id}>
                  {picks ? (
                    <Link href="/search#picks" style={rowStyle}>{body}</Link>
                  ) : n.kind === "ask" && n.target_id ? (
                    <Link href={`/picks/${n.target_id}`} style={rowStyle}>{body}</Link>
                  ) : (n.target_type === "club_read" || n.target_type === "club_comment" || n.target_type === "club") && data.clubs.get(n.target_id ?? "") ? (
                    <Link href={data.clubs.get(n.target_id!)!.href + (n.detail === "finished" ? "/shelf" : "")} style={rowStyle}>{body}</Link>
                  ) : n.target_type === "chapter_comment" && data.rooms.get(n.target_id ?? "") ? (
                    <Link href={`/book/${data.rooms.get(n.target_id!)!.book_id}/room/${data.rooms.get(n.target_id!)!.chapter}`} style={rowStyle}>{body}</Link>
                  ) : n.kind === "read_along" && n.target_id ? (
                    <Link href={`/together/${n.target_id}`} style={rowStyle}>{body}</Link>
                  ) : badge ? (
                    <Link href={`/badges/${badge.key}`} style={rowStyle}>{body}</Link>
                  ) : opensThread ? (
                    <button style={rowStyle} onClick={() => setThread(n.target_id)}>{body}</button>
                  ) : n.kind === "poke" ? (
                    <div style={{ ...rowStyle, gap: 10 }}>
                      <Link href={p?.username ? `/u/${p.username}` : "#"} style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0, color: "inherit", textDecoration: "none" }}>{body}</Link>
                      {reading.length ? (
                        <button className="follow-btn" onClick={() => (reading.length === 1 ? setChecking(reading[0]) : setChoosing(true))}>Check in</button>
                      ) : (
                        <Link href="/add" className="follow-btn" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center" }}>Start a book</Link>
                      )}
                    </div>
                  ) : n.kind === "follow" && p?.username ? (
                    <div style={{ ...rowStyle, gap: 10 }}>
                      <Link href={`/u/${p.username}`} style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0, color: "inherit", textDecoration: "none" }}>{body}</Link>
                      <FollowButton
                        userId={n.actor_id}
                        initial={data.following.has(n.actor_id)}
                        label={{ off: "Follow back", on: "Following" }}
                      />
                    </div>
                  ) : checkin ? (
                    <Link href={`/book/${checkin.book_id}`} style={rowStyle}>{body}</Link>
                  ) : (
                    <div style={rowStyle}>{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </main>
      {thread && <EntryThread entryId={thread} onClose={() => setThread(null)} />}
      {choosing && (
        <div className="sheet-backdrop" onClick={() => setChoosing(false)}>
          <div className="sheet" role="dialog" aria-modal="true" aria-label="Which book?" onClick={(e) => e.stopPropagation()}>
            <div className="sheet__grab" />
            <h2 className="h2" style={{ margin: 0 }}>Which book?</h2>
            <ul style={{ listStyle: "none", margin: "8px 0 0", padding: 0 }}>
              {reading.map((e) => (
                <li key={e.id}>
                  <button className="book-row" style={{ width: "100%", background: "none", border: 0, borderBottom: "1px solid var(--line)", textAlign: "left", font: "inherit", color: "inherit", cursor: "pointer" }}
                    onClick={() => { setChoosing(false); setChecking(e); }}>
                    <Cover book={e.book} width={40} />
                    <span className="book-row__body">
                      <span className="book-row__title" style={{ display: "block" }}>{e.book.title}</span>
                      <span className="book-row__sub" style={{ display: "block" }}>{e.book.author}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
      {checking && (
        <CheckInSheet entry={checking} onClose={() => setChecking(null)} onDone={async () => { await reload(); setChecking(null); }} />
      )}
      <TabBar />
    </div>
  );
}
