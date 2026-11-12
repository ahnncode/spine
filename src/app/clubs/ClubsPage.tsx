"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { RequireAuth } from "@/components/Auth";
import { ClubTile } from "@/components/ClubBits";
import { LockIcon } from "@/components/icons";
import { RowsSkeleton } from "@/components/Skeleton";
import { TabBar } from "@/components/TabBar";
import type { Book } from "@/lib/books";
import { booksFor, fetchClubCards, fetchMyClubs, friendsInClubs, type ClubCard } from "@/lib/clubs";
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
  const [debounced, setDebounced] = useState("");
  const [base, setBase] = useState<{ myIds: string[]; following: string[] } | null>(null);

  // Wait for a pause in typing before searching.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  // Your clubs and who you follow: once.
  useEffect(() => {
    let live = true;
    (async () => {
      const [mineRows, following] = await Promise.all([fetchMyClubs(), fetchFollowing().catch(() => [] as string[])]);
      const myIds = mineRows.map((m) => m.club_id);
      const myCards = await fetchClubCards({ ids: myIds });
      if (!live) return;
      setBase({ myIds, following });
      setMine(myCards);
      const bookMap = await booksFor(myCards.map((c) => c.current_book ?? "").filter(Boolean));
      if (live) setBooks((prev) => new Map([...prev, ...bookMap]));
    })().catch(() => {
      if (!live) return;
      setBase({ myIds: [], following: [] });
      setMine([]);
    });
    return () => {
      live = false;
    };
  }, []);

  // Clubs to join, with friends in them (one query for all of them).
  useEffect(() => {
    if (!base) return;
    let live = true;
    (async () => {
      const all = await fetchClubCards({ query: debounced || undefined, limit: 40 });
      const rest = all.filter((c) => !base.myIds.includes(c.id));
      const [bookMap, friendMap] = await Promise.all([
        booksFor(rest.map((c) => c.current_book ?? "").filter(Boolean)),
        friendsInClubs(rest.map((c) => c.id), base.following).catch(() => new Map<string, string[]>()),
      ]);
      const ps = await fetchProfiles([...new Set([...friendMap.values()].flat())]);
      if (!live) return;
      setOthers(rest);
      setBooks((prev) => new Map([...prev, ...bookMap]));
      setFriendsIn(friendMap);
      setPeople(ps);
    })().catch(() => live && setOthers([]));
    return () => {
      live = false;
    };
  }, [base, debounced]);

  const searching = useMemo(() => query.trim().length > 0, [query]);

  function renderRow(c: ClubCard, member: boolean) {
    const book = c.current_book ? books.get(c.current_book) : undefined;
    const friends = friendsIn.get(c.id) ?? [];
    return (
      <Link key={c.id} href={`/clubs/${c.id}`} className="club-row">
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
          <h1 className="g" style={{ margin: 0, fontSize: 28, fontWeight: 400 }}>Book clubs</h1>
          <Link href="/clubs/new" className="small-btn" style={{ background: "var(--ink)", color: "var(--on-ink)" }}>Start a club</Link>
        </div>

        {mine === null ? (
          <RowsSkeleton count={3} />
        ) : (
          <>
            {mine.length > 0 && !searching && (
              <section aria-label="Your clubs" style={{ marginTop: 20 }}>
                <h2 className="eyebrow">Your clubs</h2>
                <div className="stack" style={{ marginTop: 10, gap: 10 }}>{mine.map((c) => renderRow(c, true))}</div>
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
                  <p style={{ margin: 0, fontSize: 14 }}>Start one: pick a reading list, send friends the invite link, and read together.</p>
                  <Link href="/clubs/new" className="btn" style={{ marginTop: 12 }}>Start a club</Link>
                </div>
              ) : (
                <div className="stack" style={{ marginTop: 12, gap: 10 }}>{others.map((c) => renderRow(c, false))}</div>
              )}
            </section>
          </>
        )}
      </main>
      <TabBar />
    </div>
  );
}
