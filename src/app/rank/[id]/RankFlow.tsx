"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { RequireAuth } from "@/components/Auth";
import { Cover } from "@/components/Cover";
import { BoltIcon, CloseIcon, SparkIcon } from "@/components/icons";
import { ScoreChip } from "@/components/ScoreChip";
import { isImported } from "@/lib/goodreads";
import { ThoughtsEditor } from "@/components/ThoughtsEditor";
import type { Book } from "@/lib/books";
import { bucketList, countHeadToHeads, fetchBook, fetchCheckinDays, fetchShelf, placeBook, rankEntries, refreshBadges, type Entry, type RankedEntry } from "@/lib/data";
import { BADGE } from "@/lib/badges";
import { Medallion } from "@/components/Badge";
import {
  BUCKET_ORDER, BUCKETS, formatScore, MANUAL_SCORE_BOOKS, type Bucket,
} from "@/lib/ranking";
import {
  answerPlacement, questionsLeft, skipPlacement, startPlacement, tiePlacement,
  type Candidate, type Placement,
} from "@/lib/placement";
import { clearQueue, shiftQueue } from "@/lib/queue";
import { activityDates, readInYear, weeklyStreak } from "@/lib/stats";

export function RankFlow() {
  return (
    <RequireAuth>
      <Flow />
    </RequireAuth>
  );
}

type Phase = "loading" | "bucket" | "score" | "compare" | "saving" | "done" | "error";

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
  /** Badges this ranking just earned. */
  badges: string[];
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

/** What the placement needs to know about each book already in the tier. */
function toCandidates(sorted: RankedEntry[]): Candidate[] {
  return sorted.map((e) => {
    const when = e.finished_on ? Date.parse(`${e.finished_on}T12:00:00`) : e.ranked_at ? Date.parse(e.ranked_at) : 0;
    return { id: e.id, rough: e.needs_sort, genres: e.book.genres ?? [], readAt: Number.isFinite(when) ? when : 0, compared: e.compare_count };
  });
}

function Flow() {
  const { id } = useParams<{ id: string }>();
  const [phase, setPhase] = useState<Phase>("loading");
  const [book, setBook] = useState<Book | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [bucket, setBucket] = useState<Bucket | null>(null);
  const [list, setList] = useState<RankedEntry[]>([]);
  const [placement, setPlacement] = useState<Placement | null>(null);
  const [manual, setManual] = useState<number>(8.4);
  const [queueLeft, setQueueLeft] = useState<string[]>([]);
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

  // Your first few books get a score you set yourself, unless a big import
  // already gives head-to-heads plenty to work with.
  const others = entries.filter((e) => e.status === "ranked" && e.book_id !== id);
  const importedRanked = others.filter((e) => isImported(e.source)).length;
  const placedByYou = others.filter((e) => !isImported(e.source)).length;
  const scoreByHand = importedRanked <= 3 && placedByYou < MANUAL_SCORE_BOOKS;

  async function finish(b: Bucket, index: number, sorted: RankedEntry[], manualScore: number | null = null) {
    setPhase("saving");
    try {
      await placeBook({ bookId: id, bucket: b, index, list: sorted, existing, manualScore });
      const [fresh, checkinDays, badges] = await Promise.all([
        fetchShelf(),
        fetchCheckinDays().catch(() => []),
        refreshBadges().catch(() => []),
      ]);
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
        badges: badges.filter((x) => x.fresh && BADGE[x.key]).map((x) => x.key),
      });
      setEntries(fresh);
      setQueueLeft(shiftQueue(id));
      setPhase("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn’t save your ranking");
      setPhase("error");
    }
  }

  const genres = book?.genres ?? [];
  const candidates = useMemo(() => toCandidates(list), [list]);

  function step(next: Placement, b: Bucket, sorted: RankedEntry[]) {
    setPlacement(next);
    if (next.phase === "done") {
      countHeadToHeads(next.steps);
      finish(b, next.result as number, sorted);
    }
    else setPhase("compare");
  }

  function chooseBucket(b: Bucket) {
    const sorted = bucketList(entries, b, id);
    setBucket(b);
    setList(sorted);
    if (scoreByHand) {
      const [lo, hi] = BUCKETS[b].range;
      setManual(Math.round(((lo + hi) / 2) * 10) / 10);
      setPhase("score");
      return;
    }
    step(startPlacement(toCandidates(sorted), genres), b, sorted);
  }

  function saveManual() {
    if (!bucket) return;
    // Sits above every book in the tier you scored lower (ties go just below).
    const index = list.filter((e) => e.score >= manual).length;
    finish(bucket, index, list, manual);
  }

  function pick(newIsBetter: boolean) {
    if (placement && bucket) step(answerPlacement(placement, candidates, newIsBetter, genres), bucket, list);
  }
  function tie() {
    if (placement && bucket) step(tiePlacement(placement), bucket, list);
  }
  function skip() {
    if (placement && bucket) step(skipPlacement(placement, candidates, genres), bucket, list);
  }

  const steps = placement?.steps ?? 0;
  const total = steps + (placement ? questionsLeft(placement) : 0);
  const opp = phase === "compare" && placement?.pivot != null ? list[placement.pivot] : null;
  const confirming = placement?.phase === "confirm";
  const label = current ? "Re-ranking" : existing?.status === "reading" ? "Finished" : "Just finished";

  return (
    <div className="app">
      <main className="screen screen--flow" style={{ paddingTop: 16 }}>
        <div className="topbar">
          <Link href="/shelf" className="icon-btn" aria-label="Close">
            <CloseIcon size={18} />
          </Link>
          {phase === "compare" || phase === "done" ? (
            <div className="dots" aria-label={phase === "done" ? "Placed" : `Head-to-head ${steps + 1} of about ${total}`}>
              {Array.from({ length: Math.max(total, 1) }, (_, i) => (
                <span
                  key={i}
                  data-state={phase === "done" || i < steps ? "done" : i === steps ? "current" : undefined}
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

        {phase === "score" && book && bucket && (
          <>
            <p className="eyebrow" style={{ marginTop: 12 }}>
              Book {placedByYou + 1} of {MANUAL_SCORE_BOOKS} · setting your scale
            </p>
            <h1 className="h1" style={{ fontSize: 34, marginTop: 8, lineHeight: 1.02, letterSpacing: "-0.03em" }}>
              What would you give it?
            </h1>
            <p className="muted" style={{ margin: "8px 0 0", fontSize: 14, lineHeight: 1.45 }}>
              Your first {MANUAL_SCORE_BOOKS} books set the scale. After that, quick head-to-heads place each new book and score it around these.
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 18, marginTop: 26 }}>
              <Cover book={book} width={84} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="versus__title">{book.title}</div>
                <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>{BUCKETS[bucket].label}</div>
              </div>
              <ScoreChip score={manual} bucket={bucket} size={72} />
            </div>
            <label htmlFor="manual-score" className="visually-hidden">Score</label>
            <input
              id="manual-score"
              type="range"
              min={BUCKETS[bucket].range[0]}
              max={BUCKETS[bucket].range[1]}
              step={0.1}
              value={manual}
              onChange={(e) => setManual(Math.round(Number(e.target.value) * 10) / 10)}
              style={{ width: "100%", marginTop: 22, accentColor: "var(--accent)", height: 32 }}
            />
            <div className="m muted" style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
              <span>{formatScore(BUCKETS[bucket].range[0])}</span>
              <span>{formatScore(BUCKETS[bucket].range[1])}</span>
            </div>
            {list.length > 0 && (
              <ol className="mini-list" style={{ listStyle: "none", margin: "18px 0 0" }} aria-label="Your other books in this tier">
                {list.slice(0, 4).map((e) => (
                  <li key={e.id} className="mini-row" style={{ padding: "6px 12px" }}>
                    <Cover book={e.book} width={28} />
                    <div style={{ flex: 1, minWidth: 0 }} className="book-row__title">{e.book.title}</div>
                    <ScoreChip score={e.score} bucket={e.bucket} size={34} />
                  </li>
                ))}
              </ol>
            )}
            <div className="spacer" style={{ minHeight: 24 }} />
            <button className="btn btn--block" onClick={saveManual}>Save {formatScore(manual)}</button>
            <button className="btn btn--ghost btn--block" style={{ marginTop: 6 }} onClick={() => setPhase("bucket")}>Back</button>
          </>
        )}

        {phase === "compare" && book && opp && (
          <>
            <p className="eyebrow" style={{ marginTop: 12 }}>{confirming ? "One last check" : `Head-to-head ${steps + 1}`}</p>
            <h1 className="h1" style={{ fontSize: 34, marginTop: 8, lineHeight: 1.02, letterSpacing: "-0.03em" }}>
              Which one stuck with you more?
            </h1>
            {confirming && (
              <p className="muted" style={{ margin: "8px 0 0", fontSize: 14 }}>
                Some books nearby came from your import and are only roughly sorted, so here&rsquo;s one you placed yourself.
              </p>
            )}
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
            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn btn--quiet" style={{ flex: 1 }} onClick={tie}>
                Too close to call
              </button>
              <button className="btn btn--quiet" style={{ flex: 1 }} onClick={skip}>
                Don&rsquo;t remember it
              </button>
            </div>
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
            {result.badges.length > 0 && (
              <div className="moments">
                {result.badges.map((k, i) => (
                  <span key={k} className="moment badge-earned-pill" style={{ animationDelay: `${0.5 + i * 0.15}s` }}>
                    <span className="medal-pop" style={{ display: "flex", animationDelay: `${0.6 + i * 0.15}s` }}><Medallion badge={k} earned size={32} /></span>
                    <span>{BADGE[k].name} <small>badge earned</small></span>
                  </span>
                ))}
              </div>
            )}
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
            <ThoughtsEditor entry={result.me} />
            <div className="spacer" style={{ minHeight: 24 }} />
            {queueLeft.length > 0 ? (
              <>
                <Link href={`/rank/${queueLeft[0]}`} className="btn btn--block">
                  Next book · {queueLeft.length} to go
                </Link>
                <Link href="/shelf" className="btn btn--ghost btn--block" style={{ marginTop: 6 }} onClick={() => clearQueue()}>
                  Finish later
                </Link>
              </>
            ) : (
              <>
                <Link href="/shelf" className="btn btn--block">See your shelf</Link>
                <Link href="/add" className="btn btn--ghost btn--block" style={{ marginTop: 6 }}>Rank another</Link>
              </>
            )}
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
