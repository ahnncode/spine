"use client";

import { useEffect, useState } from "react";
import { BADGE, type BadgeStatus } from "@/lib/badges";
import { Medallion } from "./Badge";
import { Burst, buzz } from "./Burst";

const KEY = "readread:seen-badges";

function readSeen(): Set<string> | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : null;
  } catch {
    return null;
  }
}
function writeSeen(keys: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(keys));
  } catch {
    /* private mode */
  }
}

/**
 * Celebrates badges earned since you last looked (from anywhere: a check-in,
 * an import, a friend joining). The first visit just records what you have.
 */
export function NewBadges({ statuses }: { statuses: BadgeStatus[] | null }) {
  const [fresh, setFresh] = useState<string[]>([]);

  useEffect(() => {
    if (!statuses) return;
    const earned = statuses.filter((s) => s.earned).map((s) => s.key);
    const seen = readSeen();
    if (seen) {
      const added = earned.filter((k) => !seen.has(k) && BADGE[k]);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (added.length) { setFresh(added); buzz(20); }
    }
    writeSeen(earned);
  }, [statuses]);

  if (!fresh.length) return null;
  const close = () => setFresh([]);
  const first = BADGE[fresh[0]];
  return (
    <div className="sheet-backdrop" onClick={close}>
      <div className="sheet new-badge" role="dialog" aria-modal="true" aria-label="New badge" onClick={(e) => e.stopPropagation()}>
        <div className="sheet__grab" />
        <div className="new-badge__stage">
          <Burst pieces={26} spread={140} delay={0.25} />
          <span className="medal-pop" style={{ display: "inline-flex", animationDelay: "0.1s" }}>
            <Medallion badge={first.key} earned size={112} />
          </span>
        </div>
        <p className="eyebrow" style={{ textAlign: "center", marginTop: 8 }}>
          {fresh.length > 1 ? `${fresh.length} new badges` : "New badge"}
        </p>
        <h2 className="h1" style={{ textAlign: "center", fontSize: 28, marginTop: 8 }}>{first.name}</h2>
        <p className="muted" style={{ textAlign: "center", margin: "6px 0 0", fontSize: 15 }}>{first.how}</p>
        {fresh.length > 1 && (
          <div style={{ display: "flex", justifyContent: "center", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
            {fresh.slice(1).map((k, i) => (
              <span key={k} className="medal-pop" style={{ display: "inline-flex", animationDelay: `${0.4 + i * 0.12}s` }} title={BADGE[k].name}>
                <Medallion badge={k} earned size={44} />
              </span>
            ))}
          </div>
        )}
        <button className="btn btn--block" style={{ marginTop: 20 }} onClick={close}>Nice</button>
      </div>
    </div>
  );
}
