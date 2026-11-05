"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { RequireAuth, useProfile } from "@/components/Auth";
import { Avatar } from "@/components/Avatar";
import { Name } from "@/components/Badge";
import { FollowButton } from "@/components/FollowButton";
import { BackIcon, LockIcon } from "@/components/icons";
import { TabBar } from "@/components/TabBar";
import { fetchProfileByUsername, followList, type FollowPerson, type Profile } from "@/lib/data";
import { RowsSkeleton } from "@/components/Skeleton";

type Kind = "followers" | "following";

export function FollowsPage() {
  return (
    <RequireAuth>
      <Inner />
    </RequireAuth>
  );
}

function Inner() {
  const { username } = useParams<{ username: string }>();
  const { profile: me } = useProfile();
  const router = useRouter();
  const [kind, setKind] = useState<Kind>("followers");
  const [owner, setOwner] = useState<Profile | null | undefined>(undefined);
  const [lists, setLists] = useState<Partial<Record<Kind, FollowPerson[] | null>>>({});

  // ?tab=following opens that tab.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of the URL
    if (new URLSearchParams(window.location.search).get("tab") === "following") setKind("following");
  }, []);

  useEffect(() => {
    fetchProfileByUsername(username).then(setOwner).catch(() => setOwner(null));
  }, [username]);

  useEffect(() => {
    if (!owner) return;
    let live = true;
    Promise.all([followList(owner.id, "followers"), followList(owner.id, "following")])
      .then(([followers, following]) => live && setLists({ followers, following }))
      .catch(() => live && setLists({ followers: null, following: null }));
    return () => {
      live = false;
    };
  }, [owner]);

  const isMe = owner?.id === me?.id;
  const people = lists[kind];

  return (
    <div className="app">
      <main className="screen">
        <div className="topbar">
          <button className="icon-btn" aria-label="Back" onClick={() => router.back()}><BackIcon size={20} /></button>
        </div>
        {owner === null ? (
          <div className="empty"><p className="h2">No reader called @{username}</p></div>
        ) : !owner ? (
          <RowsSkeleton avatar count={6} label="Loading" />
        ) : (
          <>
            <h1 className="h1" style={{ marginTop: 12 }}>{isMe ? "Your people" : <Name profile={owner} markSize={18} />}</h1>
            <div className="segmented" role="tablist" style={{ marginTop: 16 }}>
              {(["followers", "following"] as Kind[]).map((k) => (
                <button key={k} role="tab" aria-selected={kind === k} onClick={() => setKind(k)}>
                  {k === "followers" ? "Followers" : "Following"}
                  {Array.isArray(lists[k]) && <span className="count">{lists[k]!.length}</span>}
                </button>
              ))}
            </div>

            {people === undefined ? (
              <RowsSkeleton avatar count={6} label="Loading" />
            ) : people === null ? (
              <div className="empty" style={{ marginTop: 16 }}>
                <LockIcon size={20} />
                <p className="h2" style={{ marginTop: 8 }}>Only for mutual follows</p>
                <p style={{ margin: 0, fontSize: 14 }}>You can see who @{owner.username} follows once you follow each other.</p>
              </div>
            ) : people.length === 0 ? (
              <div className="empty" style={{ marginTop: 16 }}>
                <p className="h2">{kind === "followers" ? "No followers yet" : "Not following anyone yet"}</p>
                {isMe && <p style={{ margin: 0, fontSize: 14 }}><Link href="/people">Find friends</Link></p>}
              </div>
            ) : (
              <ul style={{ listStyle: "none", margin: "8px 0 0", padding: 0 }}>
                {people.map((p) => (
                  <li key={p.id} className="book-row" style={{ gap: 12 }}>
                    <Link href={`/u/${p.username}`} style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0, color: "inherit", textDecoration: "none" }}>
                      <Avatar profile={p} size={44} />
                      <span style={{ minWidth: 0 }}>
                        <span style={{ display: "block", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}><Name profile={p} /></span>
                        <span className="muted" style={{ display: "block", fontSize: 13 }}>
                          @{p.username}{p.id !== me?.id && p.follows_me && p.i_follow ? " · follows each other" : p.id !== me?.id && p.follows_me ? " · follows you" : ""}
                        </span>
                      </span>
                    </Link>
                    {p.id !== me?.id && <FollowButton userId={p.id} initial={p.i_follow} label={{ off: p.follows_me ? "Follow back" : "Follow", on: "Following" }} />}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </main>
      <TabBar />
    </div>
  );
}
