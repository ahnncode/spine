"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { RequireAuth } from "@/components/Auth";
import { ClubTile } from "@/components/ClubBits";
import { LockIcon } from "@/components/icons";
import { RowsSkeleton } from "@/components/Skeleton";
import { TabBar } from "@/components/TabBar";
import type { Book } from "@/lib/books";
import { booksFor, fetchClubCards, fetchClubMembers, fetchMyClubs, type ClubCard } from "@/lib/clubs";
import { fetchFollowing, fetchProfiles, type Profile } from "@/lib/data";

export function ClubsPage() {
  return (
    <RequireAuth>
      <Inner />
    </RequireAuth>
  );
}

/** Your clubs, then clubs to join (search, and which friends are in each). */
function Inner() {
  const [mine, setMine] = useState<ClubCard[] | null>(null);
  const [others, setOthers] = useState<ClubCard[] | null>(null);
  const [books, setBooks] = useState<Map<string, Book>>(new Map());
  const [friendsIn, setFriendsIn] = useState<Map<string, string[]>>(new Map());
  const [people, setPeople] = useState<Map<string, Profile>>(new Map());
  const [query, setQuery] = useState("");

  useEffect(() => {
    let live = true;
    (async () => {
      const myIds = (await fetchMyClubs()).map((m) => m.club_id);
      const [myCards, all, following] = await Promise.all([
        fetchClubCards({ ids: myIds }),
        fetchClubCards({ query: query || undefined, limit: 40 }),
        fetchFollowing().catch(() => [] as string[]),
      ]);
      const rest = all.filter((c) => !myIds.includes(c.id));
      const bookMap = await booksFor([...myCards, ...rest].map((c) => c.current_book ?? "").filter(Boolean));
      // Friends in clubs you could join.
      const follow = new Set(following);
      const pairs = await Promise.all(rest.slice(0, 20).map(async (c) => [c.id, (await fetchClubMembers(c.id).catch(() => [])).map((m) => m.user_id).filter((u) => follow.has(u))] as const));
      const friendMap = new Map(pairs.filter(([, f]) => f.length));
      const ps = await fetchProfiles([...new Set([...friendMap.values()].flat())]);
      if (!live) return;
      setMine(myCards);
      setOthers(rest);
      setBooks(bookMap);
      setFriendsIn(friendMap);
      setPeople(ps);
    })().catch(() => {
      if (live) {
        setMine([]);
        setOthers([]);
      }
    });
    return () => {
      live = false;
    };
  }, [query]);

  const searching = useMemo(() => query.trim().length > 0, [query]);

  function Row({ c, member }: { c: ClubCard; member: boolean }) {
    const book = c.current_book ? books.get(c.current_book) : undefined;
    const friends = friendsIn.get(c.id) ?? [];
    return (
      <Link href={`/clubs/${c.id}`} className="club-row">
        <ClubTile name={c.name} color={c.color} size={member ? 52 : 48} />
        <span style={{ minWidth: 0, flex: 1 }}>
          <span className="club-row__name">
            {c.name}
            {c.has_password && !member && <LockIcon size={13} aria-label="Needs a password" />}
          </span>
          <span className="muted club-row__sub">{book ? `Reading ${book.title}` : "Between books"} · {c.members} member{c.members === 1 ? "" : "s"}</span>
          {friends.length > 0 && (
            <span className="club-row__friends">{friends.slice(0, 2).map((f) => (people.get(f)?.display_name ?? "A friend").split(" ")[0]).join(" and ")}{friends.length > 2 ? ` and ${friends.length - 2} more` : ""} {friends.length === 1 ? "is a" : "are"} member{friends.length === 1 ? "" : "s"}</span>
          )}
        </span>
      </Link>
    );
  }

  return (
    <div className="app">
      <main className="screen screen--flow" style={{ paddingTop: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <h1 className="g" style={{ margin: 0, fontSize: 32, fontWeight: 400 }}>Book clubs</h1>
          <Link href="/clubs/new" className="small-btn" style={{ background: "var(--ink)", color: "var(--on-ink)" }}>Start a club</Link>
        </div>

        {mine === null ? (
          <RowsSkeleton count={3} />
        ) : (
          <>
            {mine.length > 0 && !searching && (
              <section aria-label="Your clubs" style={{ marginTop: 20 }}>
                <h2 className="eyebrow">Your clubs</h2>
                <div className="stack" style={{ marginTop: 10, gap: 10 }}>{mine.map((c) => <Row key={c.id} c={c} member />)}</div>
              </section>
            )}

            <section aria-label="Clubs to join" style={{ marginTop: 24 }}>
              <h2 className="eyebrow">{mine.length ? "Clubs to join" : "Find a club"}</h2>
              <label htmlFor="club-search" className="visually-hidden">Search clubs</label>
              <input id="club-search" className="input" type="search" style={{ marginTop: 10, borderRadius: 22 }} placeholder="Search clubs by name" value={query} onChange={(e) => setQuery(e.target.value)} />
              {others === null ? (
                <RowsSkeleton count={3} />
              ) : others.length === 0 ? (
                <div className="empty" style={{ marginTop: 12 }}>
                  <p className="h2">{searching ? "No clubs by that name" : "No other clubs yet"}</p>
                  <p style={{ margin: 0, fontSize: 14 }}>Start one: pick a reading list, invite friends, and read together.</p>
                  <Link href="/clubs/new" className="btn" style={{ marginTop: 12 }}>Start a club</Link>
                </div>
              ) : (
                <div className="stack" style={{ marginTop: 12, gap: 10 }}>{others.map((c) => <Row key={c.id} c={c} member={false} />)}</div>
              )}
            </section>
          </>
        )}
      </main>
      <TabBar />
    </div>
  );
}
