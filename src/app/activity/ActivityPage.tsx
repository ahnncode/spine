"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { RequireAuth, useProfile } from "@/components/Auth";
import { Avatar, displayName } from "@/components/Avatar";
import { Cover } from "@/components/Cover";
import { EntryThread } from "@/components/EntryThread";
import { BackIcon } from "@/components/icons";
import { groupReactions, namesLine, type ReactionGroup } from "@/components/Reactions";
import { RowsSkeleton } from "@/components/Skeleton";
import { refreshUnread } from "@/components/useUnread";
import { useShelf } from "@/components/useShelf";
import {
  fetchCheckinsById, fetchCommentsOnMe, fetchNotifications, fetchProfiles, markNotificationsRead,
  type Checkin, type Comment, type Notification, type Profile,
} from "@/lib/data";
import { timeAgo } from "@/lib/time";

export function ActivityPage() {
  return (
    <RequireAuth>
      <Inner />
    </RequireAuth>
  );
}

interface Loaded {
  fresh: Notification[];
  earlier: Notification[];
  people: Map<string, Profile>;
  checkins: Map<string, Checkin>;
  comments: Array<Comment & { target_id: string }>;
}

/**
 * Everything people did on your posts since you last looked: hearts, then
 * comments you can reply to, grouped by post. Opening it marks them seen.
 */
function Inner() {
  const router = useRouter();
  const { entries } = useShelf();
  const { profile } = useProfile();
  const [data, setData] = useState<Loaded | null>(null);
  const [thread, setThread] = useState<string | null>(null);

  useEffect(() => {
    if (!profile?.id) return;
    (async () => {
      const all = (await fetchNotifications()).filter((n) => (n.kind === "reaction" || n.kind === "comment") && n.actor_id !== profile?.id);
      const fresh = all.filter((n) => !n.read_at);
      const earlier = fresh.length ? [] : all.slice(0, 30);
      const shown = fresh.length ? fresh : earlier;
      const oldest = shown.length ? shown[shown.length - 1].created_at : new Date().toISOString();
      const checkinIds = [...new Set(shown.filter((n) => n.target_type === "checkin" && n.target_id).map((n) => n.target_id!))];
      const [people, checkins, comments] = await Promise.all([
        fetchProfiles([...new Set(shown.map((n) => n.actor_id))]),
        fetchCheckinsById(checkinIds).catch(() => new Map<string, Checkin>()),
        fetchCommentsOnMe(oldest).catch(() => []),
      ]);
      setData({ fresh, earlier, people, checkins, comments });
      if (fresh.length) markNotificationsRead(fresh.map((n) => n.id)).then(refreshUnread).catch(() => {});
    })().catch(() => setData({ fresh: [], earlier: [], people: new Map(), checkins: new Map(), comments: [] }));
  }, [profile?.id]);

  const groups: ReactionGroup[] = data && entries ? groupReactions(data.fresh.length ? data.fresh : data.earlier, entries, data.checkins) : [];

  return (
    <div className="app">
      <main className="screen screen--flow" style={{ paddingTop: 16 }}>
        <div className="topbar" style={{ gap: 12, justifyContent: "flex-start" }}>
          <button className="icon-btn" aria-label="Back" onClick={() => (window.history.length > 1 ? router.back() : router.push("/feed"))}><BackIcon size={20} /></button>
          <h1 className="g" style={{ margin: 0, fontSize: 24, fontWeight: 400 }}>{data && !data.fresh.length ? "Recent reactions" : "Since you were last here"}</h1>
        </div>

        {!data || !entries ? (
          <RowsSkeleton />
        ) : groups.length === 0 ? (
          <div className="empty">
            <p className="h2">Nothing yet</p>
            <p style={{ margin: 0, fontSize: 14 }}>When friends heart or comment on your rankings and check-ins, it shows up here.</p>
          </div>
        ) : (
          <div className="stack" style={{ marginTop: 16 }}>
            {groups.map((g) => {
              const comments = data.comments.filter((c) => c.target_id === g.targetId).reverse();
              const entry = g.type === "entry" ? entries.find((e) => e.id === g.targetId) : undefined;
              const book = entry?.book ?? data.checkins.get(g.targetId)?.book;
              return (
                <section key={g.key} className="card activity-group">
                  <Link href={g.bookId ? `/book/${g.bookId}` : "/you"} className="activity-group__head">
                    {book && <Cover book={book} width={40} />}
                    <span style={{ minWidth: 0 }}>
                      <span className="muted" style={{ display: "block", fontSize: 12 }}>Your {g.type === "checkin" ? "check-in" : "ranking"} · {timeAgo(g.latest)}</span>
                      <span style={{ display: "block", fontSize: 15, fontWeight: 600 }}>{g.title ?? "A post of yours"}</span>
                    </span>
                  </Link>
                  {g.hearts.length > 0 && <p style={{ margin: "12px 0 0", fontSize: 14 }}><strong>♥ {namesLine(g.hearts, data.people)}</strong></p>}
                  {comments.map((c) => (
                    <div key={c.id} className="activity-comment">
                      <Avatar profile={data.people.get(c.user_id) ?? { id: c.user_id, display_name: null, username: null }} size={28} />
                      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.45 }}><strong>{displayName(data.people.get(c.user_id)).split(" ")[0]}</strong> {c.body}</p>
                    </div>
                  ))}
                  {g.type === "entry" && (g.comments.length > 0 || comments.length > 0) && (
                    <button className="link-btn" style={{ minHeight: 40, marginTop: 4 }} onClick={() => setThread(g.targetId)}>Reply</button>
                  )}
                </section>
              );
            })}
            {data.fresh.length > 0 && <p className="muted" style={{ textAlign: "center", fontSize: 13, margin: "8px 0 0" }}>You&rsquo;re all caught up</p>}
          </div>
        )}
      </main>
      {thread && <EntryThread entryId={thread} onClose={() => setThread(null)} />}
    </div>
  );
}
