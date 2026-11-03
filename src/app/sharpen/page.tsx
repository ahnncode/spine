"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { RequireAuth } from "@/components/Auth";
import { Cover } from "@/components/Cover";
import { CloseIcon } from "@/components/icons";
import { ScoreChip } from "@/components/ScoreChip";
import { useShelf } from "@/components/useShelf";
import { countHeadToHeads, logMatchup, rankEntries, recordMatchup, type Entry, type RankedEntry } from "@/lib/data";
import { formatScore } from "@/lib/ranking";

const ROUNDS = 10;

export default function SharpenPage() {
  return (
    <RequireAuth>
      <Sharpen />
    </RequireAuth>
  );
}

/** Neighbouring books in the same bucket where at least one is still rough. */
function nextPair(ranked: RankedEntry[], lastKey: string | null): [RankedEntry, RankedEntry] | null {
  const pairs: Array<[RankedEntry, RankedEntry]> = [];
  for (let i = 0; i < ranked.length - 1; i++) {
    const a = ranked[i];
    const b = ranked[i + 1];
    if (a.bucket !== b.bucket || !(a.needs_sort || b.needs_sort)) continue;
    if (`${a.id}:${b.id}` === lastKey) continue;
    pairs.push([a, b]);
  }
  if (!pairs.length) return null;
  const least = Math.min(...pairs.map(([a, b]) => a.compare_count + b.compare_count));
  const fewest = pairs.filter(([a, b]) => a.compare_count + b.compare_count === least);
  // Favour the top of the shelf, where order matters most.
  return fewest[Math.floor(Math.random() * Math.min(fewest.length, 6))];
}

function Sharpen() {
  const { entries, setEntries } = useShelf();
  const [round, setRound] = useState(0);
  const [pair, setPair] = useState<[RankedEntry, RankedEntry] | null>(null);
  const [lastKey, setLastKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ranked = useMemo(() => rankEntries(entries || []), [entries]);
  const rough = ranked.filter((e) => e.needs_sort).length;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (entries && !pair && round < ROUNDS) setPair(nextPair(ranked, lastKey));
  }, [entries, pair, round, ranked, lastKey]);

  async function choose(winner: RankedEntry, loser: RankedEntry) {
    if (!entries) return;
    setSaving(true);
    setError(null);
    try {
      await recordMatchup(winner, loser);
      countHeadToHeads(1);
      logMatchup(winner.book_id, loser.book_id, { context: "sharpen" });
      const swap = winner.sort_key < loser.sort_key;
      const next: Entry[] = entries.map((e) => {
        if (e.id === winner.id)
          return { ...e, sort_key: swap ? loser.sort_key : winner.sort_key, compare_count: e.compare_count + 1, needs_sort: e.compare_count + 1 < 2, manual_score: swap ? null : e.manual_score };
        if (e.id === loser.id)
          return { ...e, sort_key: swap ? winner.sort_key : loser.sort_key, compare_count: e.compare_count + 1, needs_sort: e.compare_count + 1 < 2, manual_score: swap ? null : e.manual_score };
        return e;
      });
      // After the matchup the winner sits directly above the loser.
      setLastKey(`${winner.id}:${loser.id}`);
      setEntries(next);
      setRound((r) => r + 1);
      setPair(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn’t save that");
    } finally {
      setSaving(false);
    }
  }

  const candidatesLeft = useMemo(() => nextPair(ranked, lastKey) !== null, [ranked, lastKey]);
  const finished = Boolean(entries) && (round >= ROUNDS || (round > 0 && !pair && !candidatesLeft));

  return (
    <div className="app">
      <main className="screen screen--flow" style={{ paddingTop: 16 }}>
        <div className="topbar">
          <Link href="/shelf" className="icon-btn" aria-label="Close">
            <CloseIcon size={18} />
          </Link>
          <div className="dots" aria-label={`Matchup ${Math.min(round + 1, ROUNDS)} of ${ROUNDS}`}>
            {Array.from({ length: ROUNDS }, (_, i) => (
              <span key={i} style={{ width: i === round && !finished ? 20 : 10 }} data-state={i < round ? "done" : i === round && !finished ? "current" : undefined} />
            ))}
          </div>
          <span style={{ width: 44 }} />
        </div>

        {!entries && <div aria-busy="true" className="spacer" />}

        {entries && !finished && !candidatesLeft && round === 0 && (
          <div className="empty">
            <p className="h2">Nothing to sort</p>
            <p style={{ margin: "0 0 16px", fontSize: 14 }}>Every book on your shelf has been placed by you.</p>
            <Link href="/shelf" className="btn">Back to your shelf</Link>
          </div>
        )}

        {entries && !finished && pair && (
          <>
            <p className="eyebrow" style={{ marginTop: 12 }}>Quick matchup · {rough} still rough</p>
            <h1 className="h1" style={{ fontSize: 34, marginTop: 8, lineHeight: 1.02, letterSpacing: "-0.03em" }}>
              Which did you like more?
            </h1>
            <div className="versus">
              {pair.map((e, i) => (
                <button key={e.id} className="versus__card" disabled={saving} onClick={() => choose(e, pair[1 - i])}>
                  <Cover book={e.book} width={128} />
                  <div style={{ minWidth: 0 }}>
                    <div className="versus__title">{e.book.title}</div>
                    <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>{e.book.author}</div>
                  </div>
                  <span className="pill pill--ink">#{e.rank} · {formatScore(e.score)}</span>
                </button>
              ))}
              <div className="versus__or" aria-hidden="true">OR</div>
            </div>
            {error && <p className="error" role="alert">{error}</p>}
            <div className="spacer" style={{ minHeight: 24 }} />
            <button className="btn btn--quiet btn--block" disabled={saving} onClick={() => choose(pair[0], pair[1])}>
              Too close to call
            </button>
          </>
        )}

        {finished && (
          <>
            <p className="eyebrow" style={{ marginTop: 8 }}>{round} matchups done</p>
            <h1 className="h1 h1--xl" style={{ marginTop: 8 }}>Your top ten, sharper.</h1>
            <ol className="mini-list" style={{ listStyle: "none", margin: "20px 0 0" }}>
              {ranked.slice(0, 10).map((e) => (
                <li key={e.id} className="mini-row" style={{ padding: "6px 12px" }}>
                  <span className="m muted" style={{ width: 22, fontSize: 13, fontWeight: 700 }}>{e.rank}</span>
                  <Cover book={e.book} width={28} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="book-row__title" style={{ fontSize: 15 }}>{e.book.title}</div>
                  </div>
                  <ScoreChip score={e.score} bucket={e.bucket} size={36} />
                </li>
              ))}
            </ol>
            <div className="spacer" style={{ minHeight: 24 }} />
            {rough > 0 && (
              <button className="btn btn--block" onClick={() => { setRound(0); setPair(null); }}>
                Keep going · {rough} rough
              </button>
            )}
            <Link href="/shelf" className={`btn btn--block ${rough > 0 ? "btn--ghost" : ""}`} style={{ marginTop: 6 }}>
              See your shelf
            </Link>
          </>
        )}
      </main>
    </div>
  );
}
