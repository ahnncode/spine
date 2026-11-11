"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ClubTile } from "@/components/ClubBits";
import { ArrowIcon } from "@/components/icons";
import type { Book } from "@/lib/books";
import { booksFor, fetchClubCards, fetchMyClubs, type ClubCard } from "@/lib/clubs";

/**
 * The way into book clubs. On the You page it lists your clubs (or invites you
 * to find one); on Discover it's a single card that leads to the clubs page.
 */
export function YourClubs({ where }: { where: "you" | "discover" }) {
  const [clubs, setClubs] = useState<ClubCard[] | null>(null);
  const [books, setBooks] = useState<Map<string, Book>>(new Map());

  useEffect(() => {
    let live = true;
    fetchMyClubs()
      .then((mine) => (mine.length ? fetchClubCards({ ids: mine.map((m) => m.club_id) }) : []))
      .then(async (c) => {
        if (!live) return;
        setClubs(c);
        if (where === "you" && c.length) {
          const b = await booksFor(c.map((x) => x.current_book ?? "").filter(Boolean));
          if (live) setBooks(b);
        }
      })
      .catch(() => live && setClubs([]));
    return () => {
      live = false;
    };
  }, [where]);

  if (clubs === null) return null;

  if (where === "discover") {
    return (
      <Link href="/clubs" className="club-row" style={{ marginTop: 20 }}>
        <span aria-hidden="true" style={{ display: "flex" }}>
          {(clubs.length ? clubs.slice(0, 2) : [{ id: "a", name: "B", color: "ember" as const }, { id: "b", name: "C", color: "cobalt" as const }]).map((c, i) => (
            <span key={c.id} style={{ marginLeft: i ? -14 : 0, borderRadius: 14, boxShadow: i ? "0 0 0 2px var(--surface)" : undefined, display: "flex" }}>
              <ClubTile name={c.name} color={c.color} size={40} />
            </span>
          ))}
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span className="club-row__name">Book clubs</span>
          <span className="muted club-row__sub">
            {clubs.length ? `You’re in ${clubs.length}. Find more to join` : "Read one book together, a week at a time"}
          </span>
        </span>
        <ArrowIcon size={18} />
      </Link>
    );
  }

  return (
    <section style={{ marginTop: 32 }} aria-labelledby="your-clubs">
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <h2 id="your-clubs" className="section-title">Book clubs</h2>
        <Link href="/clubs" className="link-btn" style={{ fontSize: 13 }}>{clubs.length ? "See all" : "Find one"}</Link>
      </div>
      {clubs.length === 0 ? (
        <Link href="/clubs" className="club-row" style={{ marginTop: 8 }}>
          <ClubTile name="B" color="ember" size={40} />
          <span style={{ flex: 1, minWidth: 0 }}>
            <span className="club-row__name">Join or start a club</span>
            <span className="muted club-row__sub">One book a month, a room for each week</span>
          </span>
          <ArrowIcon size={18} />
        </Link>
      ) : (
        <div className="stack" style={{ marginTop: 8, gap: 8 }}>
          {clubs.slice(0, 4).map((c) => (
            <Link key={c.id} href={`/clubs/${c.id}`} className="club-row">
              <ClubTile name={c.name} color={c.color} size={40} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span className="club-row__name">{c.name}</span>
                <span className="muted club-row__sub">{c.current_book ? (books.get(c.current_book) ? `Reading ${books.get(c.current_book)!.title}` : "Reading now") : "Between books"}</span>
              </span>
              <ArrowIcon size={18} />
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
