"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { RequireAuth, useProfile } from "@/components/Auth";
import { displayName } from "@/components/Avatar";
import { ArrowIcon, BackIcon, ShareIcon } from "@/components/icons";
import { CardSkeleton } from "@/components/Skeleton";
import { useShelf } from "@/components/useShelf";
import { TypeIconReward } from "@/components/TypeIconReward";
import { useSyncMyReaderType } from "@/components/useReaderTypes";
import { SlidesSheet } from "@/components/WrapShare";
import { fetchAbandonedCount, rankEntries, today } from "@/lib/data";
import { AXES, buildReaderType, driveShares, MIN_BOOKS, readerInputFromShelf, withArticle, type AxisResult } from "@/lib/readerType";
import { DRIVES, TYPE_COLOR, TYPES } from "@/lib/readerTypeCopy";

export default function Page() {
  return (
    <RequireAuth>
      <ReaderTypePage />
    </RequireAuth>
  );
}

const STABILITY: Record<string, string> = {
  provisional: "Provisional",
  settling: "Settling",
  settled: "Settled",
};

function ReaderTypePage() {
  const { profile } = useProfile();
  const { entries } = useShelf();
  const [abandoned, setAbandoned] = useState<number | null | undefined>(undefined);
  const [sharing, setSharing] = useState(false);
  useEffect(() => {
    fetchAbandonedCount().then(setAbandoned).catch(() => setAbandoned(null));
  }, []);

  const ranked = useMemo(() => rankEntries(entries || []), [entries]);
  const input = useMemo(
    () => (entries && abandoned !== undefined ? readerInputFromShelf(ranked, entries, abandoned, today()) : null),
    [entries, ranked, abandoned],
  );
  const type = useMemo(() => (input ? buildReaderType(input) : null), [input]);
  const shares = useMemo(() => (input ? driveShares(input.ranked).slice(0, 3) : []), [input]);
  useSyncMyReaderType(profile?.id, type);

  if (!input) {
    return (
      <div className="app">
        <main className="screen screen--flow" style={{ paddingTop: 16 }}>
          <TopBar />
          <CardSkeleton height={420} />
        </main>
      </div>
    );
  }

  if (!type) {
    const have = input.ranked.length;
    return (
      <div className="app">
        <main className="screen screen--flow" style={{ paddingTop: 16 }}>
          <TopBar />
          <p className="eyebrow" style={{ marginTop: 20 }}>Your reader type</p>
          <h1 className="h1 h1--xl" style={{ marginTop: 8 }}>What kind of reader are you, really?</h1>
          <p className="lede">Not a quiz. Your type is worked out from how you actually read: what you rank, how you rank it, and how you move through books.</p>
          <div className="rt-dots" role="img" aria-label={`${have} of ${MIN_BOOKS} books ranked`}>
            {Array.from({ length: MIN_BOOKS }, (_, i) => <span key={i} className={i < have ? "on" : undefined} />)}
          </div>
          <p className="muted" style={{ fontSize: 14, margin: "10px 0 0" }}>
            Rank {MIN_BOOKS - have} more book{MIN_BOOKS - have === 1 ? "" : "s"} to reveal yours.
          </p>
          <Link href="/add" className="btn btn--block" style={{ marginTop: 20 }}>Rank a book</Link>
          <Link href="/import" className="btn btn--quiet btn--block" style={{ marginTop: 10 }}>Import from Goodreads or StoryGraph</Link>
        </main>
      </div>
    );
  }

  const f = type.family;
  const first = displayName(profile).split(" ")[0];
  const strongest = type.blindSpot.pole.letter;

  return (
    <div className="app">
      <main className="screen screen--flow" style={{ paddingTop: 16 }}>
        <TopBar onShare={() => setSharing(true)} />

        {/* The reveal */}
        <section className="rt-hero" style={{ background: type.color.bg, color: type.color.fg }} aria-labelledby="rt-name">
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <span className="eyebrow" style={{ color: "inherit", opacity: 0.8 }}>{first}&rsquo;s reader type</span>
            <span className="eyebrow" style={{ color: "inherit", opacity: 0.8 }}>{f.label}</span>
          </div>
          <div className="rt-code" role="img" aria-label={type.code.split("").join(" ")}>
            {type.code.split("").map((l, i) => (
              <span key={i} style={{ animationDelay: `${0.12 + i * 0.14}s` }} aria-hidden="true">{l}</span>
            ))}
          </div>
          <h1 id="rt-name" className="g moment" style={{ margin: 0, fontSize: 36, lineHeight: 1, letterSpacing: "-0.015em", animationDelay: "0.75s" }}>{type.copy.name}</h1>
          <p className="d moment" style={{ margin: "10px 0 0", fontSize: 17, lineHeight: 1.3, fontWeight: 500, animationDelay: "0.85s" }}>{type.copy.tagline}</p>
          <p className="moment" style={{ margin: "16px 0 0", fontSize: 13, opacity: 0.85, animationDelay: "0.95s" }}>
            {f.label}: {f.gist.toLowerCase()}.
          </p>
        </section>

        <div className="rt-stability">
          <span className={`pill${type.stability === "settled" ? " pill--ink" : ""}`}>{STABILITY[type.stability]}</span>
          <span className="muted" style={{ fontSize: 13 }}>
            {type.stability === "settled"
              ? `From ${type.bookCount} ranked books. It can still shift as your reading does.`
              : `From ${type.bookCount} ranked books. Rank ${type.toNextStability} more and it ${type.stability === "provisional" ? "starts to settle" : "settles"}.`}
          </span>
        </div>

        <button className="btn btn--block" style={{ marginTop: 16 }} onClick={() => setSharing(true)}>
          <ShareIcon size={16} /> Share your type as slides
        </button>

        <TypeIconReward code={type.code} />

        <h2 className="section-title" style={{ marginTop: 36 }}>Your four spectrums</h2>
        <p className="muted" style={{ fontSize: 14, margin: "6px 0 0" }}>
          Nobody is all one thing. Each letter is just the side you lean toward, and how far.
        </p>
        <div className="stack" style={{ marginTop: 14 }}>
          {type.axes.map((a) => <AxisCard key={a.key} a={a} accent={type.color.bg} />)}
        </div>

        <h2 className="section-title" style={{ marginTop: 36 }}>Why you read</h2>
        <section className="card" style={{ marginTop: 12, background: type.drive.bg, borderColor: type.drive.bg, color: type.drive.fg }}>
          <div className="eyebrow" style={{ color: "inherit", opacity: 0.95 }}>Your core drive</div>
          <div className="g" style={{ fontSize: 44, lineHeight: 1, marginTop: 8 }}>{type.drive.label}</div>
          {type.wing && <div className="g" style={{ fontSize: 20, marginTop: 6, opacity: 0.8 }}>with {withArticle(type.wing.label.toLowerCase())} wing</div>}
          <p className="d" style={{ margin: "14px 0 0", fontSize: 17, lineHeight: 1.3, fontWeight: 500 }}>{type.drive.desire}</p>
          <div className="eyebrow" style={{ color: "inherit", opacity: 0.95, marginTop: 16 }}>What loses you</div>
          <p style={{ margin: "4px 0 0", fontSize: 15 }}>{type.drive.shadow}</p>
          <div className="stack" style={{ marginTop: 18, gap: 8 }}>
            {shares.map(([k, s]) => (
              <div key={k} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
                <span style={{ width: 104 }}>{DRIVES[k].label}</span>
                <span className="rt-share"><span style={{ width: `${Math.round((s / shares[0][1]) * 100)}%`, background: type.drive.fg }} /></span>
                <span className="m" style={{ width: 36, textAlign: "right", fontWeight: 700 }}>{Math.round(s * 100)}%</span>
              </div>
            ))}
          </div>
        </section>

        <h2 className="section-title" style={{ marginTop: 36 }}>{type.copy.name}</h2>
        <section className="card" style={{ marginTop: 12 }}>
          <p style={{ margin: 0, fontSize: 16, lineHeight: 1.5 }}>{type.copy.about}</p>
          <div className="eyebrow" style={{ marginTop: 18 }}>Superpower</div>
          <p style={{ margin: "4px 0 0", fontSize: 15, lineHeight: 1.45 }}>{type.copy.superpower}</p>
          <div className="eyebrow" style={{ marginTop: 16 }}>Watch out for</div>
          <p style={{ margin: "4px 0 0", fontSize: 15, lineHeight: 1.45 }}>{type.copy.watchOut}</p>
        </section>

        <div className="stat-grid" style={{ marginTop: 12 }}>
          {type.stats.map((s) => (
            <div key={s.label} className="stat">
              <div className="stat__n">{s.value}</div>
              <div className="stat__l">{s.label}</div>
            </div>
          ))}
        </div>

        <h2 className="section-title" style={{ marginTop: 36 }}>Where to grow</h2>
        <section className="card" style={{ marginTop: 12 }}>
          <div className="eyebrow">Your blind spot · {type.blindSpot.pole.name}</div>
          <p style={{ margin: "6px 0 0", fontSize: 15, lineHeight: 1.45 }}>{type.blindSpot.text}</p>
          {strongest === "E" && (
            <Link href="/sharpen" className="link-btn" style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 10, fontWeight: 600, fontSize: 14 }}>
              Sharpen your ranking <ArrowIcon size={14} />
            </Link>
          )}
        </section>
        {type.stretch && (
          <section className="card" style={{ marginTop: 10 }}>
            <div className="eyebrow">Your stretch read</div>
            <div className="g" style={{ fontSize: 24, lineHeight: 1.05, marginTop: 6 }}>{type.stretch.label}</div>
            <p style={{ margin: "6px 0 0", fontSize: 15, lineHeight: 1.45 }}>{type.stretch.why}</p>
            <Link href="/search" className="link-btn" style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 10, fontWeight: 600, fontSize: 14 }}>
              Find one <ArrowIcon size={14} />
            </Link>
          </section>
        )}

        <h2 className="section-title" style={{ marginTop: 36 }}>Your book-club match</h2>
        <section className="card" style={{ marginTop: 12, display: "flex", gap: 14, alignItems: "flex-start" }}>
          <span className="rt-chip" style={{ background: TYPE_COLOR[type.partner.code].bg, color: TYPE_COLOR[type.partner.code].fg }}>{type.partner.code}</span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 16 }}>{type.partner.name}</div>
            <p className="muted" style={{ margin: "4px 0 0", fontSize: 14, lineHeight: 1.45 }}>{type.partner.why}</p>
          </div>
        </section>

        <details className="card rt-how" style={{ marginTop: 36 }}>
          <summary style={{ fontWeight: 600, cursor: "pointer" }}>How your type is worked out</summary>
          <ul>
            <li><b>From what you do, not what you say.</b> Your genres, your rankings, your tags, your dates and how many books you keep going at once. There&rsquo;s no quiz to game.</li>
            <li><b>Spectrums, not boxes.</b> Each letter is a lean, with a percentage. When you&rsquo;re near even we say so, because that letter could flip.</li>
            <li><b>Careful with small shelves.</b> With only a few books, every spectrum is pulled toward the middle until there&rsquo;s enough to go on.</li>
            <li><b>It moves with you.</b> Your type is recalculated as you rank. Readers change, and so can this.</li>
            <li><b>Every claim has receipts.</b> If one sounds wrong, check the books behind it. Sometimes a book&rsquo;s genre needs fixing.</li>
            <li>It&rsquo;s a mirror for your reading, not a clinical personality test.</li>
          </ul>
          <p className="muted" style={{ fontSize: 13, margin: "8px 0 0" }}>
            The 16 types: {Object.entries(TYPES).map(([c, t]) => `${c} ${t.name.replace("The ", "")}`).join(" · ")}.
          </p>
        </details>

        {sharing && (
          <SlidesSheet
            title="Your reader type"
            blurb="Three slides, sized for an Instagram post: your type, why you read, and the receipts."
            slides={[1, 2, 3].map((n) => ({ src: `/api/card?kind=type&slide=${n}`, filename: `readread-${type.code.toLowerCase()}-${n}.png` }))}
            onClose={() => setSharing(false)}
          />
        )}
      </main>
    </div>
  );
}


function TopBar({ onShare }: { onShare?: () => void }) {
  return (
    <div className="topbar">
      <Link href="/you" className="icon-btn" aria-label="Back"><BackIcon size={20} /></Link>
      {onShare && <button className="icon-btn" aria-label="Share your reader type" onClick={onShare}><ShareIcon size={18} /></button>}
    </div>
  );
}

function AxisCard({ a, accent }: { a: AxisResult; accent: string }) {
  const def = AXES.find((d) => d.key === a.key)!;
  const [left, right] = def.poles;
  const leanPct = a.pct >= 50 ? a.pct : 100 - a.pct;
  return (
    <section className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
        <div className="eyebrow">{a.label}</div>
        <div className="muted" style={{ fontSize: 13 }}>{def.question}</div>
      </div>
      <div className="rt-poles">
        <span className={a.pct >= 50 ? "on" : undefined}>{left.name}</span>
        <span className={a.pct < 50 ? "on" : undefined}>{right.name}</span>
      </div>
      <div className="rt-track" role="img" aria-label={`${a.label}: ${a.pct}% ${left.name.toLowerCase()}, ${100 - a.pct}% ${right.name.toLowerCase()}`}>
        <span className="rt-track__mid" />
        <span className="rt-track__fill" style={{ left: `${Math.min(50, 100 - a.pct)}%`, width: `${Math.abs(a.pct - 50)}%`, background: accent }} />
        <span className="rt-track__dot" style={{ left: `${100 - a.pct}%`, background: accent }} />
      </div>
      <div className="d" style={{ fontWeight: 700, fontSize: 20, marginTop: 12, letterSpacing: "-0.01em" }}>
        {a.strength === "balanced" ? `Balanced, just ${a.pole.name.toLowerCase()} (${leanPct}/${100 - leanPct})` : `${leanPct}% ${a.pole.name.toLowerCase()}`}
      </div>
      <p className="muted" style={{ margin: "4px 0 0", fontSize: 14, lineHeight: 1.4 }}>
        {a.strength === "balanced" ? `You’re close to even here, so this letter could flip as you read. ${a.pole.blurb}` : a.pole.blurb}
      </p>
      {a.receipts.length > 0 && (
        <ul className="rt-receipts">
          {a.receipts.map((r) => <li key={r}>{r}</li>)}
        </ul>
      )}
      {a.confidence < 0.35 && (
        <p className="muted" style={{ margin: "10px 0 0", fontSize: 12 }}>
          {a.key === "rhythm" ? "Not much to go on yet. Mark books as reading when you start them to sharpen this one." : "Not much to go on yet. This one sharpens as you rank."}
        </p>
      )}
    </section>
  );
}
