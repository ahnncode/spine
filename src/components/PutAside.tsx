"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Entry } from "@/lib/data";
import { progressLabel } from "@/lib/progress";
import { STOP_REASON_LABEL } from "@/lib/stopReasons";
import { Cover } from "./Cover";
import { ResumeSheet, StopSheet } from "./StopSheet";

const NUDGE_AFTER_DAYS = 42;
const nudgeKey = (id: string) => `readread:nudged:${id}`;

function monthDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const NUDGED_EVENT = "readread:nudged";

/**
 * Shelf's "Put aside" books, in two parts so the ranked list stays near the
 * top: `nudge` is one gentle "Still saving it?" card (a book paused six weeks
 * or more, dismissed for good with "Not yet", kept in this browser) for the
 * top of the shelf; `list` is the rest of the paused books, for the bottom.
 */
export function PutAsideSection({ items, onChange, part }: { items: Entry[]; onChange: () => void | Promise<void>; part: "nudge" | "list" }) {
  const [sheet, setSheet] = useState<{ entry: Entry; kind: "resume" | "drop" } | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [now] = useState(() => Date.now());

  useEffect(() => {
    const read = () => {
      try {
        setDismissed(new Set(items.filter((e) => localStorage.getItem(nudgeKey(e.id))).map((e) => e.id)));
      } catch {
        /* storage blocked: nudge shows each visit */
      }
    };
    read();
    // The other part answered a nudge: re-read, so the book moves back to the list.
    window.addEventListener(NUDGED_EVENT, read);
    return () => window.removeEventListener(NUDGED_EVENT, read);
  }, [items]);

  if (!items.length) return null;
  const nudge = items
    .filter((e) => e.stopped_at && now - new Date(e.stopped_at).getTime() >= NUDGE_AFTER_DAYS * 864e5 && !dismissed.has(e.id))
    .sort((a, b) => (a.stopped_at ?? "").localeCompare(b.stopped_at ?? ""))[0];
  const weeks = nudge?.stopped_at ? Math.round((now - new Date(nudge.stopped_at).getTime()) / (7 * 864e5)) : 0;
  const done = async () => {
    setSheet(null);
    await onChange();
  };
  function notYet(id: string) {
    try {
      localStorage.setItem(nudgeKey(id), "1");
    } catch {
      /* fine */
    }
    setDismissed((d) => new Set(d).add(id));
    window.dispatchEvent(new Event(NUDGED_EVENT));
  }

  // The nudged book is in the card at the top, so it isn't listed again.
  const rest = items.filter((e) => e.id !== nudge?.id);
  if (part === "nudge" ? !nudge : !rest.length) return null;

  return (
    <section aria-label={part === "nudge" ? "A book you put aside" : "Put aside"} style={{ marginTop: 20 }}>
      {part === "list" && <h2 className="eyebrow" style={{ color: "var(--amber-ink)" }}>Put aside · {rest.length}</h2>}
      {part === "nudge" && nudge && (
        <div className="state-banner state-banner--paused" style={{ marginTop: 10 }}>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.4 }}>
            <strong>Still saving {nudge.book.title}?</strong> You put it aside {weeks} weeks ago{progressLabel(nudge) ? ` at ${progressLabel(nudge)!.replace(/^Chapter/, "chapter")}` : ""}.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="small-btn" style={{ background: "var(--ink)", color: "var(--on-ink)" }} onClick={() => setSheet({ entry: nudge, kind: "resume" })}>Pick back up</button>
            <button className="small-btn small-btn--outline" style={{ color: "inherit" }} onClick={() => setSheet({ entry: nudge, kind: "drop" })}>Drop it</button>
            <button className="link-btn" style={{ minHeight: 36, color: "inherit" }} onClick={() => notYet(nudge.id)}>Not yet</button>
          </div>
        </div>
      )}
      {part === "list" && <ul style={{ listStyle: "none", margin: "6px 0 0", padding: 0 }}>
        {rest.map((e) => (
          <li key={e.id} className="book-row" style={{ borderBottom: "1px solid var(--line)" }}>
            <Link href={`/book/${e.book_id}`} aria-label={`${e.book.title}: book page`} style={{ flexShrink: 0, opacity: 0.75 }}>
              <Cover book={e.book} width={40} />
            </Link>
            <span className="book-row__body">
              <Link href={`/book/${e.book_id}`} className="book-row__title" style={{ display: "block", color: "inherit", textDecoration: "none" }}>{e.book.title}</Link>
              <span className="book-row__sub" style={{ display: "block" }}>
                {[progressLabel(e), e.stopped_at ? `since ${monthDay(e.stopped_at)}` : null].filter(Boolean).join(" · ")}
              </span>
            </span>
            <button className="small-btn small-btn--outline" onClick={() => setSheet({ entry: e, kind: "resume" })}>Pick back up</button>
          </li>
        ))}
      </ul>}
      {sheet?.kind === "resume" && <ResumeSheet entry={sheet.entry} onClose={() => setSheet(null)} onDone={done} />}
      {sheet?.kind === "drop" && <StopSheet entry={sheet.entry} mode="drop" onClose={() => setSheet(null)} onDone={done} />}
    </section>
  );
}

/** Shelf's "Didn't finish" tab: where each one stopped and why; tap for the book page. */
export function DroppedList({ items }: { items: Entry[] }) {
  if (!items.length) {
    return (
      <div className="empty">
        <p className="h2">Nothing dropped</p>
        <p style={{ margin: 0, fontSize: 14 }}>Books you don&rsquo;t finish land here, off your rankings.</p>
      </div>
    );
  }
  return (
    <ul style={{ listStyle: "none", margin: "8px 0 0", padding: 0 }}>
      {items.map((e) => {
        const p = progressLabel(e);
        const why = e.stop_reason ? STOP_REASON_LABEL[e.stop_reason] : null;
        return (
          <li key={e.id}>
            <Link href={`/book/${e.book_id}`} className="book-row" style={{ color: "inherit", textDecoration: "none", borderBottom: "1px solid var(--line)" }}>
              <Cover book={e.book} width={44} state="dropped" />
              <span className="book-row__body">
                <span className="book-row__title" style={{ display: "block" }}>{e.book.title}</span>
                <span className="book-row__sub" style={{ display: "block" }}>
                  {[p && p !== "Not started" ? `Got to ${p.replace(/^Chapter/, "chapter")}` : null, why].filter(Boolean).join(" · ") || e.book.author}
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** Profile row: covers of books someone didn't finish, greyed out, each opening its book page. */
export function DroppedRow({ items, mine = false }: { items: Entry[]; mine?: boolean }) {
  if (!items.length) return null;
  const top = new Map<string, number>();
  for (const e of items) if (e.stop_reason) top.set(e.stop_reason, (top.get(e.stop_reason) ?? 0) + 1);
  const common = [...top.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  return (
    <section aria-label="Didn’t finish" style={{ marginTop: 20 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <h2 className="h2" style={{ margin: 0 }}>Didn&rsquo;t finish <span className="muted" style={{ fontWeight: 500 }}>{items.length}</span></h2>
        {mine && <Link href="/shelf" style={{ fontSize: 13, fontWeight: 600, minHeight: 32, display: "inline-flex", alignItems: "center" }}>See all</Link>}
      </div>
      <div className="reading-strip" style={{ marginTop: 10 }}>
        {items.slice(0, 8).map((e) => (
          <Link key={e.id} href={`/book/${e.book_id}`} aria-label={`${e.book.title}: didn’t finish`} style={{ flexShrink: 0 }}>
            <Cover book={e.book} width={64} state="dropped" />
          </Link>
        ))}
      </div>
      {common && items.length >= 3 && (
        <p className="muted" style={{ margin: "8px 0 0", fontSize: 13 }}>Most common reason: &ldquo;{STOP_REASON_LABEL[common]}&rdquo;</p>
      )}
    </section>
  );
}
