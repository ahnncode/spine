"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { RequireAuth, useProfile } from "@/components/Auth";
import { Avatar, displayName } from "@/components/Avatar";
import { Cover } from "@/components/Cover";
import { BackIcon } from "@/components/icons";
import { PollCard } from "@/components/PollCard";
import { CardSkeleton } from "@/components/Skeleton";
import { useShelf } from "@/components/useShelf";
import type { Book } from "@/lib/books";
import {
  closeMyPoll, fetchBooks, fetchPoll, fetchPollVotes, fetchProfiles, pollOpen, rankEntries, startReading, tasteMatches,
  type PickPoll, type PickVote, type Profile,
} from "@/lib/data";

export function PickPage() {
  return (
    <RequireAuth>
      <Inner />
    </RequireAuth>
  );
}

interface Loaded {
  poll: PickPoll;
  votes: PickVote[];
  books: Map<string, Book>;
  people: Map<string, Profile>;
  matches: Map<string, number>;
}

/**
 * One "help me pick" poll. For the asker: what friends voted, who your reading
 * twin picked, and buttons to start the winner (which closes the poll). For a
 * friend: the vote, then the totals.
 */
function Inner() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { profile } = useProfile();
  const { entries, reload } = useShelf();
  const [data, setData] = useState<Loaded | null | undefined>(undefined);
  const [busy, setBusy] = useState<string | null>(null);
  const [choosing, setChoosing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const poll = await fetchPoll(id);
    if (!poll) return setData(null);
    const votes = await fetchPollVotes([poll.id]);
    const ids = [...new Set([poll.user_id, ...votes.map((v) => v.voter_id)])];
    const [books, people, matches] = await Promise.all([
      fetchBooks(poll.book_ids),
      fetchProfiles(ids),
      tasteMatches(votes.map((v) => v.voter_id)).catch(() => new Map()),
    ]);
    setData({
      poll, votes, people,
      books: new Map(books.map((b) => [b.id, b])),
      matches: new Map([...matches.entries()].map(([k, m]) => [k, (m as { match?: number | null }).match ?? 0])),
    });
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loads after an await
    load().catch(() => setData(null));
  }, [load]);

  const mine = useMemo(() => new Map(rankEntries(entries ?? []).map((e) => [e.book_id, e])), [entries]);

  const back = (
    <div className="topbar">
      <button className="icon-btn" aria-label="Back" onClick={() => (window.history.length > 1 ? router.back() : router.push("/feed"))}><BackIcon size={20} /></button>
    </div>
  );
  if (data === undefined || !profile) return <div className="app"><main className="screen screen--flow" style={{ paddingTop: 16 }}>{back}<CardSkeleton height={360} /></main></div>;
  if (data === null) {
    return (
      <div className="app"><main className="screen screen--flow" style={{ paddingTop: 16 }}>{back}
        <div className="empty"><p className="h2">This poll isn&rsquo;t available</p><p style={{ margin: 0, fontSize: 14 }}>It may have been from someone you don&rsquo;t follow.</p></div>
      </main></div>
    );
  }

  const { poll, votes, books, people, matches } = data;
  const own = poll.user_id === profile.id;
  const open = pollOpen(poll);
  const counts = new Map<string, number>();
  for (const v of votes) counts.set(v.book_id, (counts.get(v.book_id) ?? 0) + 1);
  const ranked = [...poll.book_ids].sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0));
  const leader = votes.length ? ranked[0] : null;
  const tie = leader != null && ranked.length > 1 && (counts.get(ranked[1]) ?? 0) === (counts.get(leader) ?? 0);
  const leaderVoters = leader ? votes.filter((v) => v.book_id === leader).map((v) => v.voter_id) : [];
  const twin = leaderVoters.map((v) => ({ v, m: matches.get(v) ?? 0 })).sort((a, b) => b.m - a.m)[0];
  const chosen = poll.chosen_book ? books.get(poll.chosen_book) : null;
  const reasons = votes.filter((v) => v.reason);

  async function start(bookId: string) {
    setBusy(bookId);
    setError(null);
    try {
      await startReading(bookId);
      await closeMyPoll(poll.id, bookId).catch(() => {});
      await Promise.all([reload(), load()]);
      router.push(`/book/${bookId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn’t start that book");
      setBusy(null);
    }
  }

  async function closeIt() {
    setBusy("close");
    await closeMyPoll(poll.id).catch(() => {});
    await load();
    setBusy(null);
  }

  return (
    <div className="app">
      <main className="screen screen--flow" style={{ paddingTop: 16 }}>
        {back}
        {own && (
          <>
            <p className="eyebrow" style={{ color: "var(--amber-ink)", marginTop: 8 }}>
              {votes.length ? `${votes.length} friend${votes.length === 1 ? "" : "s"} voted` : open ? "Waiting for votes" : "Closed"}
            </p>
            <h1 className="g" style={{ margin: "4px 0 0", fontSize: 32, lineHeight: 1.1, fontWeight: 400 }}>
              {chosen ? `You went with ${chosen.title}` : !votes.length ? "Your friends are picking" : tie ? "It’s a tie so far" : `Your friends picked ${books.get(leader!)?.title ?? "one"}`}
            </h1>
            {leader && !tie && !chosen && (
              <section className="card pick-winner">
                {books.get(leader) && <Cover book={books.get(leader)!} width={72} />}
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 15 }}><strong>{counts.get(leader)} of {votes.length} votes</strong></p>
                  <div className="pick-faces" aria-hidden="true">
                    {leaderVoters.slice(0, 5).map((v) => <Avatar key={v} profile={people.get(v) ?? { id: v, display_name: null, username: null }} size={28} ring={false} />)}
                  </div>
                  {twin && twin.m >= 80 && (
                    <p style={{ margin: "6px 0 0", fontSize: 13, fontWeight: 600, color: "var(--accent-ink)" }}>
                      Including {displayName(people.get(twin.v)).split(" ")[0]}, your {twin.m}% reading twin
                    </p>
                  )}
                </div>
              </section>
            )}
          </>
        )}

        <div style={{ marginTop: 16 }}>
          <PollCard poll={poll} books={books} people={people} votes={votes} me={profile.id} mine={mine} onVoted={load} link={false} />
        </div>

        {reasons.length > 0 && (
          <section style={{ marginTop: 16 }}>
            <h2 className="eyebrow">Why they picked</h2>
            {reasons.map((v) => (
              <p key={v.voter_id} style={{ margin: "8px 0 0", fontSize: 14 }}>
                <strong>{displayName(people.get(v.voter_id)).split(" ")[0]}</strong> on {books.get(v.book_id)?.title}: &ldquo;{v.reason}&rdquo;
              </p>
            ))}
          </section>
        )}

        {own && !chosen && (
          <div className="stack" style={{ marginTop: 24 }}>
            {leader && !tie && (
              <button className="btn btn--block" disabled={busy !== null} onClick={() => start(leader)}>
                {busy === leader ? "Starting…" : `Start ${books.get(leader)?.title ?? "it"}`}
              </button>
            )}
            {!choosing ? (
              <button className="btn btn--outline btn--block" disabled={busy !== null} onClick={() => setChoosing(true)}>{leader && !tie ? "Pick a different one" : "Start one of them"}</button>
            ) : (
              <div className="stack" style={{ gap: 8 }}>
                {poll.book_ids.filter((b) => b !== (tie ? null : leader)).map((b) => (
                  <button key={b} className="btn btn--outline btn--block" disabled={busy !== null} onClick={() => start(b)}>
                    {busy === b ? "Starting…" : `Start ${books.get(b)?.title ?? "this one"}`}
                  </button>
                ))}
              </div>
            )}
            {open && <button className="link-btn" style={{ minHeight: 44 }} disabled={busy !== null} onClick={closeIt}>Close the poll</button>}
            {error && <p className="error" role="alert">{error}</p>}
          </div>
        )}
        {own && chosen && poll.chosen_book && (
          <Link href={`/book/${poll.chosen_book}`} className="btn btn--block" style={{ marginTop: 24 }}>Go to {chosen.title}</Link>
        )}
      </main>
    </div>
  );
}
