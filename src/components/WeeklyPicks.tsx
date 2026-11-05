"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Cover } from "@/components/Cover";
import { addToWant, fetchWeeklyPicks, respondToPick, revealPick, startReading, type WeeklyPick, type WeeklyPicks as Picks } from "@/lib/data";
import { GENRE_BY_KEY } from "@/lib/genres";
import { formatScore } from "@/lib/ranking";

function genreLabel(keys: string[]): string | null {
  const g = keys.map((k) => GENRE_BY_KEY[k]?.label).filter(Boolean);
  return g.length ? g.slice(0, 2).join(" · ") : null;
}

/** Days until picks roll over (Monday). */
function daysToMonday(): number {
  const d = new Date().getDay(); // 0 = Sunday
  return d === 1 ? 7 : (8 - d) % 7 || 7;
}

/**
 * This week's two picks: a mystery book (hints first, tap to reveal) and a
 * wildcard from outside the reader's usual genres.
 */
export function WeeklyPicks() {
  const [data, setData] = useState<Picks | null>(null);

  useEffect(() => {
    fetchWeeklyPicks().then(setData).catch(() => setData({ locked: false, picks: [] }));
  }, []);

  // Coming from the notification (/search#picks): scroll here once loaded.
  const ready = Boolean(data && !data.locked && data.picks.length);
  useEffect(() => {
    if (ready && window.location.hash === "#picks") document.getElementById("picks")?.scrollIntoView({ behavior: "smooth" });
  }, [ready]);

  if (!data || data.locked || data.picks.length === 0) return null;
  const update = (id: string, patch: Partial<WeeklyPick>) =>
    setData((d) => (d && !d.locked ? { ...d, picks: d.picks.map((p) => (p.id === id ? { ...p, ...patch } : p)) } : d));
  const days = daysToMonday();

  return (
    <section id="picks" style={{ marginTop: 24, scrollMarginTop: 16 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
        <h2 className="h2">This week&rsquo;s picks</h2>
        <span className="m muted" style={{ fontSize: 12 }}>new in {days} day{days === 1 ? "" : "s"}</span>
      </div>
      <div className="stack" style={{ marginTop: 12 }}>
        {data.picks.map((p) =>
          p.kind === "mystery" ? (
            <MysteryCard key={p.id} pick={p} onChange={(patch) => update(p.id, patch)} />
          ) : (
            <WildcardCard key={p.id} pick={p} onChange={(patch) => update(p.id, patch)} />
          ),
        )}
      </div>
    </section>
  );
}

function MysteryCard({ pick, onChange }: { pick: WeeklyPick; onChange: (p: Partial<WeeklyPick>) => void }) {
  const [busy, setBusy] = useState(false);
  const hints = [
    genreLabel(pick.hints.genres),
    pick.hints.decade ? `${pick.hints.decade}s` : null,
    pick.hints.pages ? `~${pick.hints.pages} pages` : null,
    pick.hints.initial ? `Title starts with “${pick.hints.initial}”` : null,
  ].filter((h): h is string => Boolean(h));

  async function reveal() {
    setBusy(true);
    try {
      await revealPick(pick.id);
      // Fetch the book now that it's revealed.
      const fresh = await fetchWeeklyPicks();
      const me = !fresh.locked ? fresh.picks.find((x) => x.id === pick.id) : undefined;
      onChange({ revealed: true, book: me?.book ?? null });
    } finally {
      setBusy(false);
    }
  }

  if (pick.revealed && pick.book) {
    return (
      <div className="card card--ink pick-card pick-card--revealed">
        <div className="eyebrow" style={{ color: "var(--accent)" }}>Mystery pick · revealed</div>
        <PickBody pick={pick} dark />
        <PickActions pick={pick} onChange={onChange} dark />
      </div>
    );
  }

  return (
    <div className="card card--ink pick-card">
      <div className="eyebrow" style={{ color: "var(--accent)" }}>Mystery pick</div>
      <div style={{ display: "flex", gap: 16, marginTop: 12 }}>
        <div className="mystery-cover" aria-hidden="true"><span>?</span></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p className="d" style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: "-0.01em", lineHeight: 1.05 }}>
            {pick.predicted != null ? <>You&rsquo;d probably give it a {formatScore(pick.predicted)}</> : "A book we think you’ll love"}
          </p>
          {pick.reason && <p style={{ margin: "6px 0 0", fontSize: 13, color: "#c9c8c2" }}>{pick.reason}</p>}
          <ul className="mystery-hints" aria-label="Hints">
            {hints.map((h) => <li key={h}>{h}</li>)}
          </ul>
        </div>
      </div>
      <button className="btn btn--block" style={{ marginTop: 16, background: "var(--accent)", color: "var(--black)" }} disabled={busy} onClick={reveal}>
        {busy ? "Revealing…" : "Reveal the book"}
      </button>
    </div>
  );
}

function WildcardCard({ pick, onChange }: { pick: WeeklyPick; onChange: (p: Partial<WeeklyPick>) => void }) {
  if (!pick.book) return null;
  return (
    <div className="card pick-card">
      <div className="eyebrow" style={{ color: "var(--cobalt, #2D3FE0)" }}>Wildcard · something different</div>
      <PickBody pick={pick} />
      <PickActions pick={pick} onChange={onChange} />
    </div>
  );
}

function PickBody({ pick, dark = false }: { pick: WeeklyPick; dark?: boolean }) {
  const b = pick.book!;
  return (
    <Link href={`/book/${b.id}`} style={{ display: "flex", gap: 14, marginTop: 12, color: "inherit", textDecoration: "none" }}>
      <Cover book={b} width={72} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="d" style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.01em", lineHeight: 1.08 }}>{b.title}</div>
        <div style={{ fontSize: 14, marginTop: 2, color: dark ? "#c9c8c2" : "var(--muted)" }}>{b.author}</div>
        {pick.reason && <p style={{ margin: "8px 0 0", fontSize: 13, lineHeight: 1.4, color: dark ? "#c9c8c2" : "var(--ink-2)" }}>{pick.reason}</p>}
      </div>
    </Link>
  );
}

function PickActions({ pick, onChange, dark = false }: { pick: WeeklyPick; onChange: (p: Partial<WeeklyPick>) => void; dark?: boolean }) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const b = pick.book!;

  async function act(r: "want" | "reading" | "skip") {
    setBusy(true);
    try {
      if (r === "want") await addToWant(b.id);
      if (r === "reading") await startReading(b.id);
      await respondToPick(pick.id, r);
      if (r === "reading") {
        router.push(`/book/${b.id}?checkin=1`);
        return;
      }
      onChange({ response: r });
    } finally {
      setBusy(false);
    }
  }

  if (pick.response) {
    const text = { want: "Saved for later", reading: "Added to reading now", skip: "Skipped. New picks Monday" }[pick.response];
    return <p className="m" style={{ margin: "14px 0 0", fontSize: 13, color: dark ? "#c9c8c2" : "var(--muted)" }}>✓ {text}</p>;
  }
  const quiet = dark ? { background: "transparent", color: "#fff", border: "1px solid #444" } : undefined;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 16 }}>
      <button className="btn" style={dark ? { background: "#fff", color: "var(--black)" } : undefined} disabled={busy} onClick={() => act("want")}>Want to read</button>
      <button className="btn btn--outline" style={quiet} disabled={busy} onClick={() => act("reading")}>Start reading</button>
      <Link href={`/rank/${b.id}`} className="btn btn--ghost" style={{ ...(dark ? { color: "#c9c8c2" } : {}), fontSize: 14 }}>Read it already</Link>
      <button className="btn btn--ghost" style={{ ...(dark ? { color: "#c9c8c2" } : {}), fontSize: 14 }} disabled={busy} onClick={() => act("skip")}>Not for me</button>
    </div>
  );
}
