"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { RequireAuth, useProfile } from "@/components/Auth";
import { Medallion } from "@/components/Badge";
import { Cover } from "@/components/Cover";
import { BackIcon } from "@/components/icons";
import { CardSkeleton } from "@/components/Skeleton";
import { useShelf } from "@/components/useShelf";
import { badgeReceipt } from "@/lib/badgeReceipts";
import { BADGE, CATEGORY_LABEL, RARITY_LABEL, fraction, progressLabel, type BadgeStatus } from "@/lib/badges";
import { fetchCheckinDays, isListened, rankEntries, refreshBadges } from "@/lib/data";

export function BadgePage() {
  return (
    <RequireAuth>
      <Inner />
    </RequireAuth>
  );
}

function earnedOn(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

/**
 * One badge, and how you earned it: the books, days and numbers behind it,
 * from your own shelf. Badge notifications open here.
 */
function Inner() {
  const { key } = useParams<{ key: string }>();
  const router = useRouter();
  const { profile } = useProfile();
  const { entries } = useShelf();
  const [statuses, setStatuses] = useState<BadgeStatus[] | null>(null);
  const [checkins, setCheckins] = useState<string[] | null>(null);
  useEffect(() => {
    refreshBadges().then(setStatuses).catch(() => setStatuses([]));
    fetchCheckinDays().then(setCheckins).catch(() => setCheckins([]));
  }, []);

  const def = BADGE[key];
  const status = useMemo<BadgeStatus | null>(
    () => (statuses ? statuses.find((s) => s.key === key) ?? { key, progress: 0, goal: 1, earned: null, fresh: false } : null),
    [statuses, key],
  );
  const ranked = useMemo(() => rankEntries(entries ?? []), [entries]);
  const receipt = useMemo(
    () => (def && status && entries && checkins ? badgeReceipt(key, { entries, ranked, checkinDays: checkins, goal: profile?.yearly_goal ?? null, status }) : null),
    [def, key, status, entries, ranked, checkins, profile?.yearly_goal],
  );

  const back = (
    <div className="topbar">
      <button className="icon-btn" aria-label="Back" onClick={() => (window.history.length > 1 ? router.back() : router.push("/you#badges"))}><BackIcon size={20} /></button>
    </div>
  );

  if (!def) {
    return (
      <div className="app"><main className="screen screen--flow" style={{ paddingTop: 16 }}>{back}
        <div className="empty"><p className="h2">No such badge</p><Link href="/you#badges" className="btn" style={{ marginTop: 12 }}>See your badges</Link></div>
      </main></div>
    );
  }
  if (!statuses || !entries || !checkins) {
    return <div className="app"><main className="screen screen--flow" style={{ paddingTop: 16 }}>{back}<CardSkeleton height={360} /></main></div>;
  }

  const earned = Boolean(status?.earned);
  const hidden = Boolean(def.secret) && !earned;
  const known = Boolean(statuses?.some((s) => s.key === key));
  const label = status && known && !hidden ? progressLabel(def, status) : null;

  return (
    <div className="app">
      <main className="screen screen--flow" style={{ paddingTop: 16 }}>
        {back}
        <section style={{ textAlign: "center", marginTop: 8 }}>
          <div className={earned ? "medal-pop" : undefined} style={{ display: "flex", justifyContent: "center" }}>
            <Medallion badge={def.key} earned={earned} progress={status ? fraction(status) : 0} size={128} />
          </div>
          <p className="eyebrow" style={{ marginTop: 16 }}>{hidden ? "Secret" : `${RARITY_LABEL[def.rarity]} · ${CATEGORY_LABEL[def.category]}`}</p>
          <h1 className="g" style={{ margin: "4px 0 0", fontSize: 34, fontWeight: 800, letterSpacing: "-0.01em", lineHeight: 1.05 }}>{hidden ? "???" : def.name}</h1>
          <p style={{ margin: "8px 0 0", fontSize: 15, color: "var(--ink-2)" }}>{hidden ? "A secret badge. You’ll know it when you earn it." : def.how}</p>
          {earned ? (
            <p className="m muted" style={{ fontSize: 13, marginTop: 12 }}>You earned this {earnedOn(status!.earned!)}</p>
          ) : label ? (
            <div style={{ marginTop: 16, textAlign: "left" }}>
              <div className="bar"><span style={{ width: `${fraction(status!) * 100}%`, background: "var(--ink)" }} /></div>
              <p className="m muted" style={{ fontSize: 13, margin: "8px 0 0" }}>{label}</p>
            </div>
          ) : null}
        </section>

        {!hidden && receipt && (
          <section aria-label={earned ? "How you earned it" : "So far"} style={{ marginTop: 32 }}>
            <h2 className="section-title">{earned ? "How you earned it" : "So far"}</h2>
            <p style={{ margin: "8px 0 0", fontSize: 16, lineHeight: 1.45 }}>{receipt.summary}</p>
            {receipt.books.length > 0 && (
              <div className="receipt-grid">
                {receipt.books.map(({ entry, caption }) => (
                  <Link key={entry.id} href={`/book/${entry.book_id}`} className="receipt-book" aria-label={`${entry.book.title}${caption ? `, ${caption}` : ""}`}>
                    <Cover book={entry.book} width={72} listened={isListened(entry.format)} />
                    <span className="receipt-book__title">{entry.book.title}</span>
                    {caption && <span className="m muted receipt-book__caption">{caption}</span>}
                  </Link>
                ))}
              </div>
            )}
            {receipt.facts.length > 0 && (
              <dl className="receipt-facts">
                {receipt.facts.map((f) => (
                  <div key={f.label}><dt>{f.label}</dt><dd className="m">{f.value}</dd></div>
                ))}
              </dl>
            )}
          </section>
        )}

        <Link href="/you#badges" className="btn btn--quiet btn--block" style={{ marginTop: 28 }}>All your badges</Link>
      </main>
    </div>
  );
}
