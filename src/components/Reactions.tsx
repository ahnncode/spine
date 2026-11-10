"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Avatar, displayName } from "@/components/Avatar";
import { CloseIcon } from "@/components/icons";
import { refreshUnread } from "@/components/useUnread";
import {
  fetchCheckinsById, fetchProfiles, fetchUnreadReactions, markNotificationsRead,
  type Checkin, type Entry, type Notification, type Profile,
} from "@/lib/data";

export interface ReactionGroup {
  key: string;
  type: "entry" | "checkin";
  targetId: string;
  title: string | null;
  bookId: string | null;
  hearts: string[];
  comments: string[];
  latest: string;
}

/** Group reaction notifications by the post they're on, newest post first. */
export function groupReactions(items: Notification[], entries: Entry[], checkins: Map<string, Checkin>): ReactionGroup[] {
  const byEntry = new Map(entries.map((e) => [e.id, e]));
  const groups = new Map<string, ReactionGroup>();
  for (const n of items) {
    if (!n.target_id || (n.target_type !== "entry" && n.target_type !== "checkin")) continue;
    const key = `${n.target_type}:${n.target_id}`;
    let g = groups.get(key);
    if (!g) {
      const entry = n.target_type === "entry" ? byEntry.get(n.target_id) : undefined;
      const checkin = n.target_type === "checkin" ? checkins.get(n.target_id) : undefined;
      g = {
        key, type: n.target_type, targetId: n.target_id,
        title: entry?.book.title ?? checkin?.book.title ?? null,
        bookId: entry?.book_id ?? checkin?.book_id ?? null,
        hearts: [], comments: [], latest: n.created_at,
      };
      groups.set(key, g);
    }
    const list = n.kind === "comment" ? g.comments : g.hearts;
    if (!list.includes(n.actor_id)) list.push(n.actor_id);
    if (n.created_at > g.latest) g.latest = n.created_at;
  }
  return [...groups.values()].sort((a, b) => b.latest.localeCompare(a.latest));
}

/** "Stephen", "Stephen and Maya", "Stephen, Maya and 2 others". */
export function namesLine(ids: string[], people: Map<string, Profile>): string {
  const first = (id: string) => displayName(people.get(id)).split(" ")[0];
  if (ids.length === 0) return "";
  if (ids.length === 1) return first(ids[0]);
  if (ids.length === 2) return `${first(ids[0])} and ${first(ids[1])}`;
  const rest = ids.length - 2;
  return `${first(ids[0])}, ${first(ids[1])} and ${rest} other${rest === 1 ? "" : "s"}`;
}

/**
 * Top of the feed: who responded to what you shared since you last looked.
 * Built from your unread heart and comment notifications; opening the list
 * or dismissing the card marks them read.
 */
export function ReactionsCard({ entries }: { entries: Entry[] | null }) {
  const [items, setItems] = useState<Notification[] | null>(null);
  const [people, setPeople] = useState<Map<string, Profile>>(new Map());
  const [checkins, setCheckins] = useState<Map<string, Checkin>>(new Map());
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let live = true;
    // Runs again each time the feed is shown: start clean so a read card doesn't flash.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setItems(null);
    (async () => {
      const list = await fetchUnreadReactions();
      if (!live) return;
      const checkinIds = [...new Set(list.filter((n) => n.target_type === "checkin" && n.target_id).map((n) => n.target_id!))];
      const [ps, cs] = await Promise.all([fetchProfiles([...new Set(list.map((n) => n.actor_id))]), fetchCheckinsById(checkinIds).catch(() => new Map())]);
      if (!live) return;
      setPeople(ps);
      setCheckins(cs);
      setItems(list);
    })().catch(() => setItems([]));
    return () => {
      live = false;
    };
  }, []);

  if (hidden || !items || !entries) return null;
  const groups = groupReactions(items, entries, checkins);
  const voteItems = items.filter((n) => n.kind === "ask" && n.detail === "voted");
  if (!groups.length && !voteItems.length) return null;
  const voters = [...new Set(voteItems.map((n) => n.actor_id))];
  const pollId = voteItems[0]?.target_id;

  async function dismissAll() {
    setHidden(true);
    await markNotificationsRead(items!.map((n) => n.id)).catch(() => {});
    refreshUnread();
  }

  // Only votes so far: say so, and open the poll.
  if (!groups.length) {
    return (
      <section className="reactions-card" aria-label="Since you were last here">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <span className="eyebrow" style={{ color: "#c9c8c2" }}>Since you were last here</span>
          <button className="icon-btn reactions-card__close" aria-label="Dismiss" onClick={dismissAll}><CloseIcon size={16} /></button>
        </div>
        <Link href={pollId ? `/picks/${pollId}` : "/activity"} className="reactions-card__body" onClick={() => markNotificationsRead(voteItems.map((n) => n.id)).then(refreshUnread).catch(() => {})}>
          <span className="reactions-card__faces" aria-hidden="true">
            {voters.slice(0, 3).map((id) => <Avatar key={id} profile={people.get(id) ?? { id, display_name: null, username: null }} size={34} ring={false} />)}
          </span>
          <span style={{ fontSize: 15, lineHeight: 1.4 }}><strong>{namesLine(voters, people)}</strong> voted on what you should read next.</span>
        </Link>
      </section>
    );
  }

  const top = groups[0];
  const actors = [...new Set(groups.flatMap((g) => [...g.hearts, ...g.comments]))];
  const hearts = items.filter((n) => n.kind === "reaction" && (n.target_type === "entry" || n.target_type === "checkin")).length;
  const comments = items.filter((n) => n.kind === "comment" && (n.target_type === "entry" || n.target_type === "checkin")).length;
  const what = top.title ? `your ${top.title} ${top.type === "checkin" ? "check-in" : "ranking"}` : `your ${top.type === "checkin" ? "check-in" : "ranking"}`;
  const reactors = [...new Set([...top.hearts, ...top.comments])];
  const commenter = top.comments[0];
  const others = groups.length - 1;

  return (
    <section className="reactions-card" aria-label="Since you were last here">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span className="eyebrow" style={{ color: "#c9c8c2" }}>Since you were last here</span>
        <button className="icon-btn reactions-card__close" aria-label="Dismiss" onClick={dismissAll}><CloseIcon size={16} /></button>
      </div>
      <Link href="/activity" className="reactions-card__body">
        <span className="reactions-card__faces" aria-hidden="true">
          {actors.slice(0, 3).map((id) => <Avatar key={id} profile={people.get(id) ?? { id, display_name: null, username: null }} size={34} ring={false} />)}
        </span>
        <span style={{ fontSize: 15, lineHeight: 1.4 }}>
          <strong>{namesLine(reactors, people)}</strong> {top.hearts.length ? "reacted to" : "commented on"} {what}.
          {commenter && top.hearts.length ? ` ${displayName(people.get(commenter)).split(" ")[0]} commented.` : ""}
          {others > 0 ? ` And ${others} more post${others === 1 ? "" : "s"}.` : ""}
        </span>
      </Link>
      <div className="reactions-card__chips">
        {hearts > 0 && <span>♥ {hearts} heart{hearts === 1 ? "" : "s"}</span>}
        {comments > 0 && <span>{comments} comment{comments === 1 ? "" : "s"}</span>}
        {voters.length > 0 && pollId && <Link href={`/picks/${pollId}`} className="reactions-card__chip">{voters.length} vote{voters.length === 1 ? "" : "s"} on your pick</Link>}
        <Link href="/activity" style={{ marginLeft: "auto", color: "#fff", fontWeight: 600, fontSize: 13 }}>See all</Link>
      </div>
    </section>
  );
}
