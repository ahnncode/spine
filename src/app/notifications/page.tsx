"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/Auth";
import { Avatar } from "@/components/Avatar";
import { Medallion, Name } from "@/components/Badge";
import { BADGE } from "@/lib/badges";
import { EntryThread } from "@/components/EntryThread";
import { FollowButton } from "@/components/FollowButton";
import { BackIcon } from "@/components/icons";
import { TabBar } from "@/components/TabBar";
import {
  fetchCheckinsById, fetchFollowing, fetchNotifications, fetchProfiles, markAllRead,
  fetchMyReadAlongs, type Checkin, type Notification, type Profile, type ReadAlong,
} from "@/lib/data";

export default function NotificationsPage() {
  return (
    <RequireAuth>
      <Inner />
    </RequireAuth>
  );
}

function ago(iso: string): string {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m`;
  if (s < 86400) return `${Math.round(s / 3600)}h`;
  if (s < 86400 * 7) return `${Math.round(s / 86400)}d`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

interface Loaded {
  items: Notification[];
  people: Map<string, Profile>;
  checkins: Map<string, Checkin>;
  following: Set<string>;
  readAlongs: Map<string, ReadAlong>;
}

function Inner() {
  const [data, setData] = useState<Loaded | null>(null);
  const [thread, setThread] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const items = await fetchNotifications();
      const [people, checkins, following, readAlongs] = await Promise.all([
        fetchProfiles([...new Set(items.map((n) => n.actor_id))]),
        fetchCheckinsById(items.filter((n) => n.target_type === "checkin" && n.target_id).map((n) => n.target_id!)),
        fetchFollowing(),
        items.some((n) => n.kind === "read_along") ? fetchMyReadAlongs().catch(() => []) : Promise.resolve([] as ReadAlong[]),
      ]);
      setData({ items, people, checkins, following: new Set(following), readAlongs: new Map(readAlongs.map((r) => [r.id, r])) });
      // Opening the list counts as reading it.
      if (items.some((n) => !n.read_at)) markAllRead().catch(() => {});
    })().catch(() => setData({ items: [], people: new Map(), checkins: new Map(), following: new Set(), readAlongs: new Map() }));
  }, []);

  function describe(n: Notification): string {
    if (n.kind === "follow") return "started following you";
    if (n.kind === "poke") return "poked you — how’s your reading going?";
    if (n.kind === "read_along") {
      const title = data?.readAlongs.get(n.target_id ?? "")?.book.title;
      const on = title ? ` ${title}` : " a book";
      if (n.detail === "invite") return `invited you to read${on} together`;
      if (n.detail === "joined") return `joined your read-along of${on}`;
      if (n.detail === "message") return `posted in your read-along of${on}`;
      if (n.detail === "verdict") return `finished${on} — the verdict is in`;
      return `updated your read-along of${on}`;
    }
    if (n.kind === "mention") {
      if (n.target_type === "checkin") {
        const c = data?.checkins.get(n.target_id ?? "");
        return c ? `mentioned you in a check-in on ${c.book.title}` : "mentioned you in a check-in";
      }
      return "mentioned you";
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

        {!data && <div aria-busy="true" style={{ minHeight: 200 }} />}
        {data && data.items.length === 0 && (
          <div className="empty">
            <p className="h2">Nothing yet</p>
            <p style={{ margin: 0, fontSize: 14 }}>Hearts, comments, mentions, pokes, new followers and badges show up here.</p>
          </div>
        )}
        {data && data.items.length > 0 && (
          <ul style={{ listStyle: "none", margin: "12px 0 0", padding: 0 }}>
            {data.items.map((n) => {
              const p = data.people.get(n.actor_id);
              const opensThread = n.target_type === "entry" && n.target_id;
              const checkin = n.target_type === "checkin" ? data.checkins.get(n.target_id ?? "") : undefined;
              const badge = n.kind === "badge" && n.badge ? BADGE[n.badge] : undefined;
              const body = badge ? (
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
                  {n.kind === "read_along" && n.target_id ? (
                    <Link href={`/together/${n.target_id}`} style={rowStyle}>{body}</Link>
                  ) : badge ? (
                    <Link href="/you#badges" style={rowStyle}>{body}</Link>
                  ) : opensThread ? (
                    <button style={rowStyle} onClick={() => setThread(n.target_id)}>{body}</button>
                  ) : n.kind === "poke" ? (
                    <div style={{ ...rowStyle, gap: 10 }}>
                      <Link href={p?.username ? `/u/${p.username}` : "#"} style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0, color: "inherit", textDecoration: "none" }}>{body}</Link>
                      <Link href="/you" className="follow-btn" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center" }}>Check in</Link>
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
      <TabBar />
    </div>
  );
}
