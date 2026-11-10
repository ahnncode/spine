"use client";

import Link from "next/link";
import { useState } from "react";
import { Avatar, displayName } from "@/components/Avatar";
import type { Book } from "@/lib/books";
import { pollOpen, votePoll, type PickPoll, type PickVote, type Profile, type RankedEntry } from "@/lib/data";
import { Cover } from "./Cover";

function timeLeft(p: PickPoll): string {
  const h = Math.max(0, Math.round((new Date(p.closes_at).getTime() - Date.now()) / 36e5));
  return h >= 1 ? `${h}h left` : "closing soon";
}

/**
 * A friend's "help me pick" poll: tap a book to vote; once you have, the
 * totals show and you can change your vote while it's open. On the asker's
 * own poll it just shows the totals.
 */
export function PollCard({
  poll, books, people, votes, me, mine, onVoted, link = true,
}: {
  poll: PickPoll;
  books: Map<string, Book>;
  people: Map<string, Profile>;
  votes: PickVote[];
  me: string;
  /** Your ranked books, to show your own score on books you've read. */
  mine: Map<string, RankedEntry>;
  onVoted: () => void | Promise<void>;
  /** Link the header to the poll's page (off on that page itself). */
  link?: boolean;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const asker = people.get(poll.user_id);
  const first = displayName(asker).split(" ")[0];
  const own = poll.user_id === me;
  const myVote = votes.find((v) => v.voter_id === me)?.book_id ?? null;
  const open = pollOpen(poll);
  const showTotals = own || Boolean(myVote) || !open;
  const counts = new Map<string, number>();
  for (const v of votes) counts.set(v.book_id, (counts.get(v.book_id) ?? 0) + 1);
  const total = votes.length;

  async function vote(bookId: string) {
    if (own || !open || busy) return;
    setBusy(bookId);
    setError(null);
    try {
      await votePoll(poll.id, bookId);
      await onVoted();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn’t save your vote");
    } finally {
      setBusy(null);
    }
  }

  const head = (
    <span style={{ display: "flex", gap: 10, alignItems: "center", minWidth: 0 }}>
      <Avatar profile={asker ?? { id: poll.user_id, display_name: null, username: null }} size={36} />
      <span style={{ minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 15 }}>
          {own ? <strong>Your friends are picking</strong> : <><strong>Help {first} pick</strong> their next book</>}
        </span>
        <span className="muted" style={{ display: "block", fontSize: 13 }}>
          {[poll.note ? `“${poll.note}”` : null, open ? timeLeft(poll) : "Closed"].filter(Boolean).join(" · ")}
        </span>
      </span>
    </span>
  );

  return (
    <section className="card poll-card" aria-label={own ? "Your poll" : `Help ${first} pick`}>
      {link ? <Link href={`/picks/${poll.id}`} style={{ color: "inherit", textDecoration: "none" }}>{head}</Link> : head}

      {!showTotals ? (
        <>
          <div className="poll-books" role="group" aria-label="Vote for one">
            {poll.book_ids.map((id) => {
              const b = books.get(id);
              if (!b) return null;
              const r = mine.get(id);
              return (
                <button key={id} type="button" className="poll-book" disabled={busy !== null} onClick={() => vote(id)} aria-label={`Vote for ${b.title}`}>
                  <Cover book={b} width={76} />
                  <span className="poll-book__title">{b.title}</span>
                  <span className={r ? "poll-book__mine" : "muted poll-book__sub"}>{r ? `You gave it ${r.score.toFixed(1)}` : "Not read"}</span>
                </button>
              );
            })}
          </div>
          <p className="muted" style={{ margin: "12px 0 0", fontSize: 13 }}>{busy ? "Saving your vote…" : "Tap one to vote. You’ll see how others voted after."}</p>
        </>
      ) : (
        <ul className="poll-bars">
          {[...poll.book_ids].sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0)).map((id) => {
            const b = books.get(id);
            if (!b) return null;
            const n = counts.get(id) ?? 0;
            const chosen = poll.chosen_book === id;
            return (
              <li key={id}>
                <button type="button" className="poll-bar" disabled={own || !open || busy !== null} onClick={() => vote(id)} aria-label={own || !open ? `${b.title}: ${n} votes` : `Change your vote to ${b.title}`}>
                  <span className="poll-bar__label">
                    <span className="poll-bar__title">
                      {b.title}
                      {myVote === id && <span className="muted"> · your vote</span>}
                      {chosen && <span style={{ color: "var(--amber-ink)" }}> · picked</span>}
                    </span>
                    <span className="m">{n}</span>
                  </span>
                  <span className="bar"><span style={{ width: `${total ? (n / total) * 100 : 0}%`, background: myVote === id || chosen ? "var(--ink)" : "var(--muted)" }} /></span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {showTotals && open && !own && <p className="muted" style={{ margin: "10px 0 0", fontSize: 12 }}>Tap another book to change your vote.</p>}
      {error && <p className="error" role="alert">{error}</p>}
    </section>
  );
}
