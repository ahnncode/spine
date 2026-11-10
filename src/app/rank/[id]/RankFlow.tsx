"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { RequireAuth } from "@/components/Auth";
import { Cover } from "@/components/Cover";
import { BoltIcon, CloseIcon, SparkIcon } from "@/components/icons";
import { ScoreChip } from "@/components/ScoreChip";
import { AskPrompt } from "@/components/AskPrompt";
import { ThoughtsEditor } from "@/components/ThoughtsEditor";
import { FinishedPicker } from "@/components/FinishedPicker";
import { FormatToggle } from "@/components/FormatToggle";
import type { Book } from "@/lib/books";
import { bucketList, countHeadToHeads, logMatchup, fetchBook, fetchCheckinDays, fetchShelf, placeBook, rankEntries, refreshBadges, today, type Entry, type RankedEntry, setFormat, type Format } from "@/lib/data";
import { BADGE } from "@/lib/badges";
import { Medallion } from "@/components/Badge";
import {
  BUCKET_ORDER, BUCKETS, formatScore, type Bucket,
} from "@/lib/ranking";
import {
  answerPlacement, questionsLeft, skipPlacement, startPlacement, tiePlacement,
  type Candidate, type Placement,
} from "@/lib/placement";
import { clearQueue, shiftQueue } from "@/lib/queue";
import { activityDates, readInYear, weeklyStreak } from "@/lib/stats";
import { Burst, buzz } from "@/components/Burst";
import { useCoverTint } from "@/components/useCoverTint";

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
    out.push({ text: `New #1. Dethroned ${prev[0]?.book.title ?? "your old favorite"}`, tone: "hot" });
  } else if (me.rank <= 10 && next.length > 10 && (!prevMe || prevMe.rank > 10)) {
    const nextTop = new Set(next.slice(0, 10).map((e) => e.book_id));
    const out10 = prev.slice(0, 10).find((e) => !nextTop.has(e.book_id));
    out.push({ text: out10 ? `Top 10. Bye, ${out10.book.title}` : "Straight into your top 10", tone: "hot" });
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
  const tint = useCoverTint(book);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [bucket, setBucket] = useState<Bucket | null>(null);
  const [list, setList] = useState<RankedEntry[]>([]);
  const [placement, setPlacement] = useState<Placement | null>(null);
  const [queueLeft, setQueueLeft] = useState<string[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [finishedOn, setFinishedOn] = useState<string | null>(() => today());
  // Read or listened: starts as Read (or what you said while reading it).
  const [format, setFormatChoice] = useState<Format | null>(null);
  // Date and format sit behind one line so the tier question comes first.
  const [details, setDetails] = useState(false);
  const [savedBeforeError, setSavedBeforeError] = useState(false);

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
        const mine = e.find((x) => x.book_id === id);
        if (mine?.finished_on) setFinishedOn(mine.finished_on);
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
  const wasDropped = existing?.status === "dropped";

  async function finish(b: Bucket, index: number, sorted: RankedEntry[]) {
    setPhase("saving");
    let saved = false;
    try {
      // Re-ranking keeps the date already saved; a new finish uses the one picked here.
      // Ranked anyway after dropping it: there's no finish date.
      await placeBook({ bookId: id, bucket: b, index, list: sorted, existing, finishedOn: current ? undefined : wasDropped ? null : finishedOn });
      saved = true;
      let fresh = await fetchShelf();
      const placed = fresh.find((e) => e.book_id === id);
      // Save read/listened before badges are counted (All Ears, Both Ways).
      if (placed && format && placed.format !== format) {
        await setFormat(placed.id, format).catch(() => {});
        fresh = fresh.map((e) => (e.id === placed.id ? { ...e, format } : e));
      }
      const [checkinDays, badges] = await Promise.all([
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
      // The first worry is "did it save?", so say that before anything else.
      setSavedBeforeError(saved);
      setError(saved ? "Your ranking is saved. The results just didn’t load." : `Your ranking wasn’t saved. ${e instanceof Error ? e.message : ""}`.trim());
      setPhase("error");
    }
  }

  const genres = book?.genres ?? [];
  const candidates = useMemo(() => toCandidates(list), [list]);

  function step(next: Placement, b: Bucket, sorted: RankedEntry[]) {
    setPlacement(next);
    if (next.phase === "done") {
      buzz(18);
      countHeadToHeads(next.steps);
      finish(b, next.result as number, sorted);
    }
    else setPhase("compare");
  }

  function chooseBucket(b: Bucket) {
    const sorted = bucketList(entries, b, id);
    setBucket(b);
    setList(sorted);
    // Every book, your first ones included, is placed with head-to-heads: you
    // pick the tier, the matchups pick the spot, the score follows.
    step(startPlacement(toCandidates(sorted), genres), b, sorted);
  }

  function pick(newIsBetter: boolean) {
    if (!placement || !bucket) return;
    const other = placement.pivot != null ? list[placement.pivot] : null;
    if (other) logMatchup(newIsBetter ? id : other.book_id, newIsBetter ? other.book_id : id);
    step(answerPlacement(placement, candidates, newIsBetter, genres), bucket, list);
  }
  function tie() {
    if (!placement || !bucket) return;
    const other = placement.pivot != null ? list[placement.pivot] : null;
    if (other) logMatchup(id, other.book_id, { tie: true });
    step(tiePlacement(placement), bucket, list);
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
              {phase === "compare" && (
                <small className="dots__count">{steps + 1} of {total > steps + 1 ? `about ${total}` : total}</small>
              )}
            </div>
          ) : (
            <span />
          )}
          <span style={{ width: 44 }} />
        </div>

        {phase === "loading" && <div aria-busy="true" className="spacer" />}

        {phase === "error" && (
          <div className="empty">
            <p className="h2">{savedBeforeError ? "Saved, with a hiccup" : "Something went sideways"}</p>
            <p style={{ margin: "0 0 16px", fontSize: 14 }}>{error}</p>
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              {!savedBeforeError && book && <button className="btn" onClick={() => { setError(null); setPhase("bucket"); }}>Try again</button>}
              <Link href="/shelf" className={savedBeforeError ? "btn" : "btn btn--quiet"}>{savedBeforeError ? "See your shelf" : "Back to your shelf"}</Link>
            </div>
          </div>
        )}

        {phase === "bucket" && book && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1, paddingTop: 10 }}>
            <p className="eyebrow" style={{ marginBottom: 18 }}>{label}</p>
            <Cover book={book} width={168} />
            <h1 className="h1" style={{ fontSize: 32, marginTop: 24, textAlign: "center", letterSpacing: "-0.03em" }}>{book.title}</h1>
            <p className="muted" style={{ margin: "4px 0 0", fontSize: 15 }}>{book.author}</p>
            {current && (
              <span className="pill" style={{ marginTop: 12 }}>
                Now #{current.rank} · {formatScore(current.score)}
              </span>
            )}
            {wasDropped && (
              <p className="muted" style={{ margin: "16px 0 0", fontSize: 14, textAlign: "center" }}>Ranking a book you didn&rsquo;t finish. It stays marked that way.</p>
            )}
            {!current && !wasDropped && !details && (
              <button type="button" className="details-line" onClick={() => setDetails(true)}>
                {finishedOn === today() ? "Finished today" : finishedOn === today(1) ? "Finished yesterday" : finishedOn ? `Finished ${new Date(`${finishedOn}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : "Finish date unknown"}
                {" · "}
                {FORMAT_WORD[format ?? existing?.format ?? "read"]}
                <span className="details-line__change">Change</span>
              </button>
            )}
            {!current && !wasDropped && details && (
              <div style={{ alignSelf: "stretch", marginTop: 24 }}>
                <FinishedPicker value={finishedOn} onChange={setFinishedOn} />
                <div style={{ marginTop: 16 }}>
                  <FormatToggle value={format ?? existing?.format ?? "read"} onChange={setFormatChoice} />
                </div>
              </div>
            )}
            <h2 className="h2" style={{ alignSelf: "stretch", margin: current ? "28px 0 12px" : "22px 0 12px" }}>How did it land?</h2>
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
              <button key={`new-${steps}`} className="versus__card" onClick={() => pick(true)}>
                <Cover book={book} width={128} />
                <div style={{ minWidth: 0 }}>
                  <div className="versus__title">{book.title}</div>
                  <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>{book.author}</div>
                </div>
                <span className="pill pill--accent">{label}</span>
              </button>
              <button key={`${opp.id}-${steps}`} className="versus__card" onClick={() => pick(false)}>
                <Cover book={opp.book} width={128} />
                <div style={{ minWidth: 0 }}>
                  <div className="versus__title">{opp.book.title}</div>
                  <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>{opp.book.author}</div>
                </div>
                <span className="pill pill--ink">On your shelf</span>
              </button>
              <div className="versus__or" aria-hidden="true">OR</div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
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
          <div className="placed" style={{ ["--tint" as string]: tint ?? "var(--accent)" }}>
            <div className="placed__panel">
            <p className="eyebrow" style={{ margin: 0 }}>Placed on your shelf</p>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 14, marginTop: 4 }} aria-live="polite">
              <div className="big-rank reveal-rank" style={{ position: "relative" }}>
                #{result.me.rank}
                <Burst pieces={result.me.rank <= 3 || result.badges.length ? 28 : 14} spread={result.me.rank <= 3 ? 170 : 110} delay={0.2} />
              </div>
              <div className="reveal-chip" style={{ marginBottom: 6 }}>
                <ScoreChip score={result.me.score} bucket={result.me.bucket} size={68} />
              </div>
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
            <ThoughtsEditor entry={result.me} genres={book.genres} showDate={false} />
            {queueLeft.length === 0 && !current && <AskPrompt entries={entries} finished={book.title} />}
            <div className="spacer" style={{ minHeight: 24 }} />
            {queueLeft.length > 0 ? (
              <>
                <Link href={`/rank/${queueLeft[0]}`} className="btn btn--block">
                  Next book · {queueLeft.length} to go
                </Link>
                <Link href="/shelf" className="btn btn--ghost btn--block" style={{ marginTop: 8 }} onClick={() => clearQueue()}>
                  Finish later
                </Link>
              </>
            ) : (
              <>
                <Link href="/shelf" className="btn btn--block">See your shelf</Link>
                <Link href="/add" className="btn btn--ghost btn--block" style={{ marginTop: 8 }}>Rank another</Link>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

const FORMAT_WORD: Record<Format, string> = { read: "Read", listen: "Listened", both: "Read and listened" };

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
  if (!sameAbove && sameBelow) return `${title} takes the top spot of the ${r.bucketCount} ${group}, just ahead of ${sameBelow.book.title}.`;
  if (sameAbove && !sameBelow) return `${title} is ${pos}, just after ${sameAbove.book.title}.`;
  if (sameAbove && sameBelow) return `${title} is ${pos}, between ${sameAbove.book.title} and ${sameBelow.book.title}.`;
  return `${title} is ${pos}.`;
}
