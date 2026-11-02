"use client";

import Link from "next/link";
import { Logo } from "@/components/Logo";
import { useEffect, useMemo, useState } from "react";
import { RequireAuth, useProfile } from "@/components/Auth";
import { Avatar, displayName } from "@/components/Avatar";
import { Cover } from "@/components/Cover";
import { ArrowIcon } from "@/components/icons";
import { ScoreChip } from "@/components/ScoreChip";
import { TabBar } from "@/components/TabBar";
import { CheckInSheet } from "@/components/CheckInSheet";
import { useShelf } from "@/components/useShelf";
import { useStreak } from "@/components/useStreak";
import {
  fetchFeed, fetchFollowing, fetchProfiles, rankEntries, tasteMatches,
  type Entry, type FeedItem, type Match, type Profile,
} from "@/lib/data";
import { formatScore } from "@/lib/ranking";

export default function FeedPage() {
  return (
    <RequireAuth>
      <Feed />
    </RequireAuth>
  );
}

interface Loaded {
  items: FeedItem[];
  profiles: Map<string, Profile>;
  matches: Map<string, Match>;
  following: number;
}

function ago(iso: string): string {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  if (s < 86400 * 7) return `${Math.round(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function Feed() {
  const { profile } = useProfile();
  const { entries, reload } = useShelf();
  const [checking, setChecking] = useState<Entry | null>(null);
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const ids = await fetchFollowing();
      const items = await fetchFeed(ids);
      const people = [...new Set(items.map((i) => i.entry.user_id))];
      const [profiles, matches] = await Promise.all([fetchProfiles(people), tasteMatches(people)]);
      setData({ items, profiles, matches, following: ids.length });
    })().catch((e) => setError(e instanceof Error ? e.message : "Couldn’t load your feed"));
  }, []);

  const mine = useMemo(() => new Map(rankEntries(entries || []).map((e) => [e.book_id, e])), [entries]);
  const myStatus = useMemo(() => new Map((entries || []).map((e) => [e.book_id, e.status])), [entries]);
  const { streak, reloadCheckins } = useStreak(entries);
  const reading = (entries || []).filter((e) => e.status === "reading");

  return (
    <div className="app">
      <main className="screen">
        <div className="topbar">
          <Logo size={30} />
          <Link href="/you" aria-label="Your profile" style={{ textDecoration: "none" }}>
            <Avatar profile={profile} size={40} />
          </Link>
        </div>

        {streak.weeks > 0 && !streak.activeThisWeek && (
          reading[0] ? (
            <button className="notice" style={{ display: "block", width: "100%", textAlign: "left", border: 0, marginTop: 14 }} onClick={() => setChecking(reading[0])}>
              <strong>Keep your {streak.weeks}-week streak.</strong> Check in on {reading[0].book.title} before Sunday.
            </button>
          ) : (
            <Link href="/add" className="notice" style={{ display: "block", marginTop: 14, textDecoration: "none" }}>
              <strong>Keep your {streak.weeks}-week streak.</strong> Start or rank a book before Sunday.
            </Link>
          )
        )}

        {reading.length > 0 && (
          <section aria-label="Your reading" style={{ marginTop: 14 }}>
            <div className="reading-strip" style={{ marginTop: 0 }}>
              {reading.map((e) => (
                <button key={e.id} className="reading-card" style={{ width: 230, flexDirection: "row", alignItems: "center", textAlign: "left" }} onClick={() => setChecking(e)} aria-label={`Check in on ${e.book.title}`}>
                  <Cover book={e.book} width={40} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span className="reading-card__title" style={{ fontSize: 14 }}>{e.book.title}</span>
                    <span className="bar" style={{ display: "block", height: 5, marginTop: 6 }}><span style={{ width: `${e.progress_pct ?? 0}%`, background: "var(--accent)" }} /></span>
                    <span className="m muted" style={{ fontSize: 11, display: "block", marginTop: 4 }}>
                      {e.progress_pct != null ? `${e.progress_pct}% · ` : ""}Check in
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        {error && <p className="error" role="alert">{error}</p>}
        {!data && !error && <div aria-busy="true" style={{ minHeight: 240 }} />}

        {data && data.items.length === 0 && (
          <div className="card card--ink" style={{ marginTop: 16 }}>
            <p className="d" style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.05, margin: 0 }}>
              {data.following ? "Quiet in here." : "Reading’s better with friends."}
            </p>
            <p style={{ color: "#c9c8c2", fontSize: 14, lineHeight: 1.45, margin: "10px 0 0" }}>
              {data.following
                ? "When people you follow rank or start books, it shows up here."
                : "Follow people to see what they’re reading, how they rank it, and how your taste compares."}
            </p>
            <Link href="/people" className="btn btn--block" style={{ marginTop: 16, background: "#fff", color: "var(--ink)" }}>
              Find people to follow
            </Link>
          </div>
        )}

        {data && data.items.length > 0 && (
          <div className="feed">
            {data.items.map((item) => {
              const p = data.profiles.get(item.entry.user_id);
              const m = data.matches.get(item.entry.user_id);
              const book = item.entry.book;
              const myEntry = mine.get(item.entry.book_id);
              const status = myStatus.get(item.entry.book_id);
              return (
                <article key={`${item.kind}-${item.entry.id}`} className="feed-card">
                  <div className="feed-card__head">
                    <Avatar profile={p} size={40} link />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Link href={p?.username ? `/u/${p.username}` : "#"} style={{ fontWeight: 700, textDecoration: "none" }}>{displayName(p)}</Link>{" "}
                      {item.kind === "ranked"
                        ? "ranked a book"
                        : item.entry.progress_pct != null && item.entry.progress_pct > 0
                          ? `is ${item.entry.progress_pct}% through`
                          : "started reading"}
                      <div className="when">{ago(item.at)}</div>
                    </div>
                    {m?.match != null && <span className="pill pill--cobalt m" style={{ fontWeight: 700 }}>{m.match}% match</span>}
                  </div>
                  <Link href={`/book/${item.entry.book_id}`} className="feed-card__book">
                    <Cover book={book} width={76} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="feed-card__title">{book.title}</div>
                      <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>{book.author}</div>
                      {item.kind === "ranked" && (
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
                          <ScoreChip score={item.entry.score} bucket={item.entry.bucket} size={40} />
                          <span style={{ fontSize: 13, lineHeight: 1.3 }}>
                            #{item.entry.overall_rank} on their shelf
                            {myEntry && (
                              <>
                                <br />
                                <span className="muted">
                                  {Math.abs(myEntry.score - item.entry.score) >= 2
                                    ? `You disagree — your ${formatScore(myEntry.score)}`
                                    : `You agree — your ${formatScore(myEntry.score)}`}
                                </span>
                              </>
                            )}
                          </span>
                        </div>
                      )}
                    </div>
                  </Link>
                  {!status && (
                    <Link href={`/book/${item.entry.book_id}`} className="btn btn--outline btn--block" style={{ minHeight: 44, marginTop: 14, fontSize: 14 }}>
                      Want to read · see scores
                    </Link>
                  )}
                </article>
              );
            })}
            <Link href="/people" className="card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", textDecoration: "none", padding: "16px 18px" }}>
              <span style={{ fontWeight: 600 }}>Find more people</span>
              <ArrowIcon size={18} />
            </Link>
          </div>
        )}
      </main>
      {checking && (
        <CheckInSheet
          entry={checking}
          onClose={() => setChecking(null)}
          onDone={async () => { await Promise.all([reload(), reloadCheckins()]); setChecking(null); }}
        />
      )}
      <TabBar />
    </div>
  );
}
