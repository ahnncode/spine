"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Avatar, displayName } from "@/components/Avatar";
import { Cover } from "@/components/Cover";
import { formatScore } from "@/lib/ranking";
import { fetchProfiles, friendsRankedOn, rankedThisMonth, type Profile, type RankedEntry, type ScoredEntry } from "@/lib/data";

/**
 * "You and Maya split on Lonesome Dove: 9.1 vs 4.0". The biggest gap between
 * your score and a friend's on a book you've both ranked. Rotates weekly
 * among the top few so it isn't the same fight every day.
 */
export function SplitCard({ friends, mine, me }: { friends: string[]; mine: Map<string, RankedEntry>; me?: string }) {
  const [split, setSplit] = useState<{ theirs: ScoredEntry; ours: RankedEntry; who: Profile | undefined } | null>(null);

  useEffect(() => {
    if (!friends.length || !mine.size) return;
    let live = true;
    friendsRankedOn([...mine.keys()], friends)
      .then(async (rows) => {
        const gaps = rows
          .filter((r) => r.user_id !== me && mine.has(r.book_id))
          .map((r) => ({ r, gap: Math.abs(mine.get(r.book_id)!.score - r.score) }))
          .filter((x) => x.gap >= 3)
          .sort((a, b) => b.gap - a.gap)
          .slice(0, 3);
        if (!gaps.length) return;
        const week = Math.floor(Date.now() / (7 * 864e5));
        const pick = gaps.at(week % gaps.length)!.r;
        const people = await fetchProfiles([pick.user_id]);
        if (live) setSplit({ theirs: pick, ours: mine.get(pick.book_id)!, who: people.get(pick.user_id) });
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [friends, mine, me]);

  if (!split) return null;
  const name = displayName(split.who).split(" ")[0];
  return (
    <Link href={`/book/${split.theirs.book_id}`} className="card split-card">
      <Cover book={split.theirs.book} width={56} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p className="eyebrow" style={{ margin: 0 }}>You two disagree</p>
        <p className="d" style={{ margin: "4px 0 0", fontSize: 18, fontWeight: 700, lineHeight: 1.15 }}>
          You and {name} split on {split.theirs.book.title}
        </p>
        <p className="m" style={{ margin: "6px 0 0", fontSize: 14 }}>
          You {formatScore(split.ours.score)} · {name} {formatScore(split.theirs.score)}
        </p>
      </div>
    </Link>
  );
}

/** Who among you and the people you follow has ranked the most books this month. */
export function FriendsMonth({ friends, me }: { friends: string[]; me?: string }) {
  const [rows, setRows] = useState<Array<{ p: Profile | undefined; id: string; n: number }> | null>(null);

  useEffect(() => {
    if (friends.length < 2 || !me) return;
    let live = true;
    const ids = [...new Set([...friends, me])];
    rankedThisMonth(ids)
      .then(async (counts) => {
        const top = [...counts.entries()].filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]).slice(0, 5);
        if (top.length < 2) return;
        const people = await fetchProfiles(top.map(([id]) => id));
        if (live) setRows(top.map(([id, n]) => ({ id, n, p: people.get(id) })));
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [friends, me]);

  if (!rows) return null;
  const month = new Date().toLocaleDateString("en-US", { month: "long" });
  return (
    <section className="card" aria-label={`Most books ranked in ${month}`}>
      <p className="eyebrow" style={{ margin: 0 }}>{month} among friends</p>
      <ol className="month-board">
        {rows.map((r, i) => (
          <li key={r.id} data-me={r.id === me || undefined}>
            <span className="m month-board__place">{i + 1}</span>
            <Avatar profile={r.p} size={32} />
            <span className="month-board__name">{r.id === me ? "You" : displayName(r.p)}</span>
            <span className="m month-board__n">{r.n} {r.n === 1 ? "book" : "books"}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/**
 * A start-of-week recap at the top of the feed (Sunday and Monday only):
 * what friends finished in the last seven days and where your streak stands.
 */
export function WeekCard({ finished, finishers, streakWeeks }: { finished: number; finishers: string[]; streakWeeks: number }) {
  const day = new Date().getDay();
  if (day !== 0 && day !== 1) return null;
  if (!finished && !streakWeeks) return null;
  const who =
    finishers.length === 0 ? null : finishers.length === 1 ? finishers[0] : `${finishers[0]} and ${finishers.length - 1} other${finishers.length > 2 ? "s" : ""}`;
  return (
    <section className="card week-card" aria-label="Your week in books">
      <p className="eyebrow" style={{ margin: 0 }}>Your week in books</p>
      <p className="d" style={{ margin: "6px 0 0", fontSize: 20, fontWeight: 700, lineHeight: 1.2 }}>
        {who ? `${who} finished ${finished} book${finished === 1 ? "" : "s"} this week.` : "A quiet week among friends."}
      </p>
      <p className="muted" style={{ margin: "6px 0 0", fontSize: 14 }}>
        {streakWeeks > 0 ? `Your streak: ${streakWeeks} week${streakWeeks === 1 ? "" : "s"}. ` : ""}
        <Link href="/search" style={{ fontWeight: 600 }}>This week&rsquo;s picks →</Link>
      </p>
    </section>
  );
}
