"use client";

import { useState } from "react";
import { Medallion } from "@/components/Badge";
import {
  BADGE, BADGES, byRarity, CATEGORY_LABEL, RARITY_LABEL, fraction, progressLabel, sortForCase, type BadgeStatus,
} from "@/lib/badges";

function earnedOn(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/** A bottom sheet describing one badge. */
export function BadgeSheet({ status, onClose, theirs = false }: { status: BadgeStatus; onClose: () => void; theirs?: boolean }) {
  const def = BADGE[status.key];
  if (!def) return null;
  const earned = Boolean(status.earned);
  const hidden = Boolean(def.secret) && !earned;
  const label = hidden ? null : progressLabel(def, status);
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={def.name} onClick={(e) => e.stopPropagation()} style={{ textAlign: "center" }}>
        <div className="sheet__grab" />
        <div className={earned ? "medal-pop" : undefined} style={{ display: "flex", justifyContent: "center", marginTop: 8 }}>
          <Medallion badge={def.key} earned={earned} progress={fraction(status)} size={112} />
        </div>
        <p className="eyebrow" style={{ marginTop: 16 }}>{hidden ? "Secret" : `${RARITY_LABEL[def.rarity]} · ${CATEGORY_LABEL[def.category]}`}</p>
        <h2 className="d" style={{ margin: "4px 0 0", fontSize: 28, fontWeight: 800, letterSpacing: "-0.03em" }}>{hidden ? "???" : def.name}</h2>
        <p style={{ margin: "8px 0 0", fontSize: 15, color: "var(--ink-2)" }}>{hidden ? "A secret badge. You’ll know it when you earn it." : def.how}</p>
        {earned ? (
          <p className="m muted" style={{ fontSize: 13, marginTop: 16 }}>{theirs ? "Earned" : "You earned this"} {earnedOn(status.earned!)}</p>
        ) : (
          label && (
            <div style={{ marginTop: 16, textAlign: "left" }}>
              <div className="bar"><span style={{ width: `${fraction(status) * 100}%`, background: "var(--ink)" }} /></div>
              <p className="m muted" style={{ fontSize: 13, margin: "8px 0 0" }}>{label}</p>
            </div>
          )
        )}
        <button className="btn btn--quiet btn--block" style={{ marginTop: 20 }} onClick={onClose}>Close</button>
      </div>
    </div>
  );
}

/** Your full badge case: earned ones first, then what you're closest to. */
export function BadgeCase({ statuses }: { statuses: BadgeStatus[] | null }) {
  const [open, setOpen] = useState<BadgeStatus | null>(null);
  const [all, setAll] = useState(false);
  const list = statuses ? sortForCase(statuses) : BADGES.map((b) => ({ key: b.key, progress: 0, goal: 1, earned: null, fresh: false }));
  const earnedCount = list.filter((s) => s.earned).length;
  const shown = all ? list : list.slice(0, 8);

  return (
    <section className="card" id="badges" style={{ marginTop: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h2 className="h2">Badges</h2>
        <span className="m muted" style={{ fontSize: 12 }}>{statuses ? `${earnedCount} of ${BADGES.length}` : " "}</span>
      </div>
      <div className="badge-grid" aria-busy={!statuses}>
        {shown.map((s) => {
          const def = BADGE[s.key];
          const earned = Boolean(s.earned);
          const hidden = Boolean(def.secret) && !earned;
          const label = hidden ? null : progressLabel(def, s);
          return (
            <button key={s.key} className="badge-cell" data-locked={!earned} onClick={() => setOpen(s)}
              aria-label={hidden ? "Secret badge" : `${def.name}. ${earned ? "Earned" : label ?? def.how}`}>
              <Medallion badge={s.key} earned={earned} progress={fraction(s)} size={58} />
              <span className="badge-cell__name">{hidden ? "???" : def.name}</span>
              {!earned && label && <span className="badge-cell__sub m">{Math.min(s.progress, s.goal).toLocaleString()}/{s.goal.toLocaleString()}</span>}
            </button>
          );
        })}
      </div>
      {list.length > 8 && (
        <button className="btn btn--quiet btn--block" style={{ marginTop: 16, minHeight: 40, fontSize: 14 }} onClick={() => setAll(!all)}>
          {all ? "Show fewer" : `See all ${list.length}`}
        </button>
      )}
      {open && <BadgeSheet status={open} onClose={() => setOpen(null)} />}
    </section>
  );
}

/** Someone else's earned badges, as a scrolling strip. */
export function BadgeStrip({ earned }: { earned: { key: string; earned_at: string }[] }) {
  const [open, setOpen] = useState<BadgeStatus | null>(null);
  const known = byRarity(earned);
  if (!known.length) return null;
  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 20 }}>
        <h2 className="h2" style={{ margin: 0 }}>Badges</h2>
        <span className="m muted" style={{ fontSize: 12 }}>{known.length} of {BADGES.length}</span>
      </div>
      <div className="badge-strip">
        {known.map((b) => (
          <button key={b.key} className="badge-cell" style={{ width: 64, flexShrink: 0 }} aria-label={BADGE[b.key].name}
            onClick={() => setOpen({ key: b.key, progress: 1, goal: 1, earned: b.earned_at, fresh: false })}>
            <Medallion badge={b.key} earned size={52} />
            <span className="badge-cell__name">{BADGE[b.key].name}</span>
            <span className="badge-cell__sub" data-rarity={BADGE[b.key].rarity}>{RARITY_LABEL[BADGE[b.key].rarity]}</span>
          </button>
        ))}
      </div>
      {open && <BadgeSheet status={open} theirs onClose={() => setOpen(null)} />}
    </>
  );
}
