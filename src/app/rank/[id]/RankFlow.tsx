"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { RequireAuth } from "@/components/Auth";
import { Cover } from "@/components/Cover";
import { BoltIcon, CloseIcon, SparkIcon } from "@/components/icons";
import { ScoreChip } from "@/components/ScoreChip";
import type { Book } from "@/lib/books";
import { bucketList, fetchBook, fetchCheckinDays, fetchShelf, placeBook, rankEntries, type Entry, type RankedEntry } from "@/lib/data";
import {
  answer, BUCKET_ORDER, BUCKETS, formatScore, isDone, maxSteps, midpoint, startSearch,
  type Bucket, type SearchState,
} from "@/lib/ranking";
import { activityDates, readInYear, weeklyStreak } from "@/lib/stats";

export function RankFlow() {
  return (
    <RequireAuth>
      <Flow />
    </RequireAuth>
  );
}

type Phase = "loading" | "bucket" | "compare" | "saving" | "done" | "error";

interface Moment {
  text: string;
  tone: "hot" | "cobalt" | "plain";
}

interface Result {
  me: RankedEntry;
  bucketCount: number;
  bucketPos: number;
  above: RankedEntry | null;
  below: RankedEntry | null;
  moments: Moment[];
}

const COUNT_MILESTONES = [10, 25, 50, 100, 250, 500, 1000];

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/** The little celebrations after a placement, best first. */
function momentsFor(before: Entry[], after: Entry[], bookId: string, checkinDays: string[]): Moment[] {
  const prev = rankEntries(before);
  const next = rankEntries(after);
  const me = next.find((e) => e.book_id === bookId);
  if (!me) return [];
  const out: Moment[] = [];
  const prevMe = prev.find((e) => e.book_id === bookId);

  if (me.rank === 1 && prev[0]?.book_id !== bookId && next.length > 1) {
    out.push({ text: `New #1 — dethroned ${prev[0]?.book.title ?? "your old favorite"}`, tone: "hot" });
  } else if (me.rank <= 10 && next.length > 10 && (!prevMe || prevMe.rank > 10)) {
    const nextTop = new Set(next.slice(0, 10).map((e) => e.book_id));
    const out10 = prev.slice(0, 10).find((e) => !nextTop.has(e.book_id));
    out.push({ text: out10 ? `Top 10 — knocked out ${out10.book.title}` : "Straight into your top 10", tone: "hot" });
  } else if (prevMe && prevMe.rank !== me.rank) {
    const diff = prevMe.rank - me.rank;
    out.push({ text: diff > 0 ? `Up ${diff} from #${prevMe.rank}` : `Down ${-diff} from #${prevMe.rank}`, tone: "plain" });
  }

  if (!prevMe) {
    const count = next.length;
    if (COUNT_MILESTONES.includes(count)) out.push({ text: `Your ${ordinal(count)} book ranked`, tone: "cobalt" });
    const year = new Date().getFullYear();
    const thisYear = readInYear(next, year).length;
    if (thisYear > 0) out.push({ text: `Book ${thisYear} of ${year}`, tone: "plain" });
    const streak = weeklyStreak(activityDates(after, checkinDays));
    if (streak.weeks >= 2) out.push({ text: `${streak.weeks}-week streak`, tone: "cobalt" });
  }
  return out.slice(0, 3);
}

function Flow() {
  const { id } = useParams<{ id: string }>();
  const [phase, setPhase] = useState<Phase>("loading");
  const [book, setBook] = useState<Book | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [bucket, setBucket] = useState<Bucket | null>(null);
  const [list, setList] = useState<RankedEntry[]>([]);
  const [search, setSearch] = useState<SearchState>(startSearch(0));
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    Promise.all([fetchBook(id), fetchShelf()])
      .then(([b, e]) => {
        if (!live) return;
        if (!b) {
          setError("We couldn’t find that book.");
          setPhase("error");
          return;
        }
        setBook(b);
        setEntries(e);
        setPhase("bucket");
      })
      .catch((e) => {
        if (!live) return;
        setError(e instanceof Error ? e.message : "Something went wrong");
        setPhase("error");
      });
    return () => {
      live = false;
    };
  }, [id]);

  const existing = useMemo(() => entries.find((e) => e.book_id === id) ?? null, [entries, id]);
  const current = useMemo(
    () => (existing?.status === "ranked" ? rankEntries(entries).find((e) => e.book_id === id) : undefined),
    [entries, existing, id],
  );

  async function finish(b: Bucket, index: number, sorted: RankedEntry[]) {
    setPhase("saving");
    try {
      await placeBook({ bookId: id, bucket: b, index, list: sorted, existing });
      const [fresh, checkinDays] = await Promise.all([fetchShelf(), fetchCheckinDays().catch(() => [])]);
      const ranked = rankEntries(fresh);
      const meIdx = ranked.findIndex((e) => e.book_id === id);
      const inBucket = ranked.filter((e) => e.bucket === b);
      setResult({
        me: ranked[meIdx],
        bucketCount: inBucket.length,
        bucketPos: inBucket.findIndex((e) => e.book_id === id),
        above: meIdx > 0 ? ranked[meIdx - 1] : null,
        below: meIdx < ranked.length - 1 ? ranked[meIdx + 1] : null,
        moments: momentsFor(entries, fresh, id, checkinDays),
      });
      setEntries(fresh);
      setPhase("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn’t save your ranking");
      setPhase("error");
    }
  }

  function chooseBucket(b: Bucket) {
    const sorted = bucketList(entries, b, id);
    setBucket(b);
    setList(sorted);
    const s = startSearch(sorted.length);
    setSearch(s);
    if (isDone(s)) finish(b, 0, sorted);
    else setPhase("compare");
  }

  function pick(newIsBetter: boolean) {
    const next = answer(search, newIsBetter);
    setSearch(next);
    if (isDone(next) && bucket) finish(bucket, next.lo, list);
  }

  const total = maxSteps(list.length);
  const opp = phase === "compare" ? list[midpoint(search)] : null;
  const label = current ? "Re-ranking" : existing?.status === "reading" ? "Finished" : "Just finished";

  return (
    <div className="app">
      <main className="screen screen--flow" style={{ paddingTop: 16 }}>
        <div className="topbar">
          <Link href="/shelf" className="icon-btn" aria-label="Close">
            <CloseIcon size={18} />
          </Link>
          {phase === "compare" || phase === "done" ? (
            <div className="dots" aria-label={phase === "done" ? "Placed" : `Head-to-head ${search.steps + 1} of up to ${total}`}>
              {Array.from({ length: Math.max(total, 1) }, (_, i) => (
                <span
                  key={i}
                  data-state={phase === "done" || i < search.steps ? "done" : i === search.steps ? "current" : undefined}
                />
              ))}
            </div>
          ) : (
            <span />
          )}
          <span style={{ width: 44 }} />
        </div>

        {phase === "loading" && <div aria-busy="true" className="spacer" />}

        {phase === "error" && (
          <div className="empty">
            <p className="h2">Something went sideways</p>
            <p style={{ margin: "0 0 16px", fontSize: 14 }}>{error}</p>
            <Link href="/shelf" className="btn">Back to your shelf</Link>
          </div>
        )}

        {phase === "bucket" && book && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1, paddingTop: 10 }}>
            <p className="eyebrow" style={{ marginBottom: 18 }}>{label}</p>
            <Cover book={book} width={168} />
            <h1 className="h1" style={{ fontSize: 32, marginTop: 22, textAlign: "center", letterSpacing: "-0.03em" }}>{book.title}</h1>
            <p className="muted" style={{ margin: "4px 0 0", fontSize: 15 }}>{book.author}</p>
            {current && (
              <span className="pill" style={{ marginTop: 10 }}>
                Now #{current.rank} · {formatScore(current.score)}
              </span>
            )}
            <h2 className="h2" style={{ alignSelf: "stretch", margin: "28px 0 12px" }}>How did it land?</h2>
            <div className="stack" style={{ alignSelf: "stretch" }}>
              {BUCKET_ORDER.map((b) => (
                <button key={b} className="bucket-btn" onClick={() => chooseBucket(b)}>
                  <span style={{ display: "flex", alignItems: "center" }}>
                    <span className="bucket-dot" style={{ background: BUCKETS[b].color }} />
                    {BUCKETS[b].label}
                  </span>
                  <span className="m muted" style={{ fontSize: 13 }}>{BUCKETS[b].rangeLabel}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {phase === "compare" && book && opp && (
          <>
            <p className="eyebrow" style={{ marginTop: 12 }}>Head-to-head {search.steps + 1}</p>
            <h1 className="h1" style={{ fontSize: 34, marginTop: 8, lineHeight: 1.02, letterSpacing: "-0.03em" }}>
              Which one stuck with you more?
            </h1>
            <div className="versus">
              <button className="versus__card" onClick={() => pick(true)}>
                <Cover book={book} width={128} />
                <div style={{ minWidth: 0 }}>
                  <div className="versus__title">{book.title}</div>
                  <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>{book.author}</div>
                </div>
                <span className="pill pill--accent">{label}</span>
              </button>
              <button key={opp.id} className="versus__card" onClick={() => pick(false)}>
                <Cover book={opp.book} width={128} />
                <div style={{ minWidth: 0 }}>
                  <div className="versus__title">{opp.book.title}</div>
                  <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>{opp.book.author}</div>
                </div>
                <span className="pill pill--ink">You: {formatScore(opp.score)}</span>
              </button>
              <div className="versus__or" aria-hidden="true">OR</div>
            </div>
            <div className="spacer" style={{ minHeight: 24 }} />
            <button className="btn btn--quiet btn--block" onClick={() => pick(false)}>
              Too close to call
            </button>
          </>
        )}

        {phase === "saving" && (
          <div className="empty" aria-live="polite">
            <p className="h2">Placing it on your shelf…</p>
          </div>
        )}

        {phase === "done" && book && result && (
          <>
            <p className="eyebrow" style={{ marginTop: 8 }}>Placed on your shelf</p>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 14, marginTop: 4 }} aria-live="polite">
              <div className="big-rank reveal-rank">#{result.me.rank}</div>
              <div className="reveal-chip" style={{ marginBottom: 6 }}>
                <ScoreChip score={result.me.score} bucket={result.me.bucket} size={68} />
              </div>
            </div>
            <p className="moment" style={{ margin: "18px 0 0", fontSize: 17, lineHeight: 1.4, animationDelay: "0.25s" }}>
              {sentence(book.title, result)}
            </p>
            {result.moments.length > 0 && (
              <div className="moments">
                {result.moments.map((m, i) => (
                  <span
                    key={m.text}
                    className={`moment moment-pill ${m.tone === "hot" ? "moment-pill--hot" : m.tone === "cobalt" ? "moment-pill--cobalt" : ""}`}
                    style={{ animationDelay: `${0.7 + i * 0.12}s` }}
                  >
                    {m.tone === "hot" ? <SparkIcon size={14} /> : m.tone === "cobalt" ? <BoltIcon size={14} /> : null}
                    {m.text}
                  </span>
                ))}
              </div>
            )}
            <ol className="mini-list" style={{ listStyle: "none", margin: "18px 0 0" }}>
              {[result.above, result.me, result.below].filter((x): x is RankedEntry => Boolean(x)).map((e) => (
                <li key={e.id} className={`mini-row ${e.book_id === id ? "mini-row--new" : ""}`}>
                  <span className="m muted" style={{ width: 28, fontSize: 13, fontWeight: 700 }}>{e.rank}</span>
                  <Cover book={e.book} width={34} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="book-row__title" style={{ fontSize: 16 }}>{e.book.title}</div>
                    <div className="book-row__sub">{e.book.author}</div>
                  </div>
                  <ScoreChip score={e.score} bucket={e.bucket} size={40} />
                </li>
              ))}
            </ol>
            <div className="spacer" style={{ minHeight: 24 }} />
            <Link href="/shelf" className="btn btn--block">See your shelf</Link>
            <Link href="/add" className="btn btn--ghost btn--block" style={{ marginTop: 6 }}>Rank another</Link>
          </>
        )}
      </main>
    </div>
  );
}

const BUCKET_PHRASE: Record<Bucket, string> = {
  loved: "books you loved",
  fine: "books that were fine",
  disliked: "books that weren’t for you",
};

function sentence(title: string, r: Result): string {
  const group = BUCKET_PHRASE[r.me.bucket];
  if (r.bucketCount === 1) return `${title} is the first of your ${group}. Rank a few more and the head-to-heads begin.`;
  const sameAbove = r.above && r.above.bucket === r.me.bucket ? r.above : null;
  const sameBelow = r.below && r.below.bucket === r.me.bucket ? r.below : null;
  const pos = `#${r.bucketPos + 1} of the ${r.bucketCount} ${group}`;
  if (!sameAbove && sameBelow) return `${title} takes the top spot of the ${r.bucketCount} ${group} — edging out ${sameBelow.book.title}.`;
  if (sameAbove && !sameBelow) return `${title} is ${pos}, just after ${sameAbove.book.title}.`;
  if (sameAbove && sameBelow) return `${title} is ${pos}, between ${sameAbove.book.title} and ${sameBelow.book.title}.`;
  return `${title} is ${pos}.`;
}
