"use client";

import { useCallback, useEffect, useState } from "react";
import { useProfile } from "@/components/Auth";
import type { Book } from "@/lib/books";
import { fetchBooks, fetchFriendsOpenPolls, fetchPollVotes, fetchProfiles, type PickPoll, type PickVote, type Profile, type RankedEntry } from "@/lib/data";
import { PollCard } from "./PollCard";

/** Top of the feed: friends asking for help picking their next book. */
export function FriendPolls({ mine }: { mine: Map<string, RankedEntry> }) {
  const { profile } = useProfile();
  const [polls, setPolls] = useState<PickPoll[] | null>(null);
  const [votes, setVotes] = useState<PickVote[]>([]);
  const [books, setBooks] = useState<Map<string, Book>>(new Map());
  const [people, setPeople] = useState<Map<string, Profile>>(new Map());

  const load = useCallback(async () => {
    const ps = await fetchFriendsOpenPolls();
    const [vs, bs, pp] = await Promise.all([
      fetchPollVotes(ps.map((p) => p.id)),
      fetchBooks([...new Set(ps.flatMap((p) => p.book_ids))]),
      fetchProfiles([...new Set(ps.map((p) => p.user_id))]),
    ]);
    setVotes(vs);
    setBooks(new Map(bs.map((b) => [b.id, b])));
    setPeople(pp);
    setPolls(ps);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loads after an await
    load().catch(() => setPolls([]));
  }, [load]);

  if (!polls?.length || !profile) return null;
  // Ones you haven't voted on first.
  const sorted = [...polls].sort((a, b) => Number(votes.some((v) => v.poll_id === a.id && v.voter_id === profile.id)) - Number(votes.some((v) => v.poll_id === b.id && v.voter_id === profile.id)));
  return (
    <div className="stack" style={{ marginTop: 16, gap: 12 }}>
      {sorted.slice(0, 3).map((p) => (
        <PollCard key={p.id} poll={p} books={books} people={people} votes={votes.filter((v) => v.poll_id === p.id)} me={profile.id} mine={mine} onVoted={load} />
      ))}
    </div>
  );
}
