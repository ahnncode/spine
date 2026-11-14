"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ClubTile } from "@/components/ClubBits";
import { ArrowIcon } from "@/components/icons";
import type { Book } from "@/lib/books";
import { booksFor, fetchClubCards, fetchMyClubs, meetingCountdown, meetingWhen, myClubMeetings, type ClubCard, type RsvpAnswer } from "@/lib/clubs";

/**
 * The way into book clubs. On the You page it lists your clubs (or invites you
 * to find one); on Discover it's a single card that leads to the clubs page;
 * on the feed it only appears when one of your clubs meets within a week.
 */
export function YourClubs({ where }: { where: "you" | "discover" | "feed" }) {
  const [clubs, setClubs] = useState<ClubCard[] | null>(null);
  const [books, setBooks] = useState<Map<string, Book>>(new Map());
  const [meetings, setMeetings] = useState<Map<string, { read_id: string; starts_at: string; answer: RsvpAnswer | null }>>(new Map());
  const [nextMeeting, setNextMeeting] = useState<{ club: ClubCard; m: { read_id: string; starts_at: string; answer: RsvpAnswer | null } } | null>(null);

  // The soonest meeting within a week, for the feed.
  useEffect(() => {
    if (where !== "feed" || !clubs) return;
    const now = Date.now();
    const soon = clubs
      .map((c) => ({ club: c, m: meetings.get(c.id) }))
      .filter((x): x is { club: ClubCard; m: { read_id: string; starts_at: string; answer: RsvpAnswer | null } } =>
        Boolean(x.m && meetingCountdown(x.m.starts_at) && new Date(x.m.starts_at).getTime() - now < 7 * 864e5))
      .sort((a, b) => a.m.starts_at.localeCompare(b.m.starts_at))[0] ?? null;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- derived from the clock, so worked out after render
    setNextMeeting(soon);
  }, [where, clubs, meetings]);

  useEffect(() => {
    let live = true;
    fetchMyClubs()
      .then((mine) => (mine.length ? fetchClubCards({ ids: mine.map((m) => m.club_id) }) : []))
      .then(async (c) => {
        if (!live) return;
        setClubs(c);
        if (where !== "discover" && c.length) myClubMeetings().then((m) => live && setMeetings(m));
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

  if (where === "feed") {
    const soon = nextMeeting;
    if (!soon) return null;
    const when = meetingCountdown(soon.m.starts_at)!;
    const answer = soon.m.answer === "going" ? "You’re going" : soon.m.answer === "maybe" ? "You said maybe" : soon.m.answer === "no" ? "You can’t make it" : "Are you coming?";
    return (
      <Link href={`/clubs/${soon.club.id}`} className="club-row" style={{ marginTop: 12 }}>
        <ClubTile name={soon.club.name} color={soon.club.color} size={40} />
        <span style={{ flex: 1, minWidth: 0 }}>
          <span className="club-row__name">{soon.club.name} meets {when === "now" ? "now" : when}</span>
          <span className="muted club-row__sub">{meetingWhen(soon.m.starts_at)} · {answer}</span>
        </span>
        <ArrowIcon size={18} />
      </Link>
    );
  }

  if (where === "discover") {
    return (
      <Link href="/clubs" className="club-row" style={{ marginTop: 20 }}>
        <span aria-hidden="true" style={{ display: "flex" }}>
          {(clubs.length ? clubs.slice(0, 2) : [{ id: "a", name: "B", color: "ember" as const }, { id: "b", name: "C", color: "cobalt" as const }]).map((c, i) => (
            <span key={c.id} style={{ marginLeft: i ? -14 : 0, borderRadius: 16, boxShadow: i ? "0 0 0 2px var(--surface)" : undefined, display: "flex" }}>
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
                <span className="muted club-row__sub">
                  {meetings.get(c.id) && meetingCountdown(meetings.get(c.id)!.starts_at)
                    ? `Meets ${meetingWhen(meetings.get(c.id)!.starts_at)}`
                    : c.current_book ? (books.get(c.current_book) ? `Reading ${books.get(c.current_book)!.title}` : "Reading now") : "Between books"}
                </span>
              </span>
              <ArrowIcon size={18} />
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
