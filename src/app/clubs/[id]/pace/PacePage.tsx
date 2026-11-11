"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/Auth";
import { displayName } from "@/components/Avatar";
import { ClubScreen, NotAMember, today, useClub } from "@/components/ClubBits";
import { PokeButton } from "@/components/PokeButton";
import { RowsSkeleton } from "@/components/Skeleton";
import { atLabel, expectedChapter, fetchPace, type PaceRow } from "@/lib/clubs";

export function PacePage() {
  return (
    <RequireAuth>
      <Inner />
    </RequireAuth>
  );
}

/** Where everyone is in the current read, against where the plan says the club should be today. */
function Inner() {
  const { id: clubId } = useParams<{ id: string }>();
  const { data, me } = useClub(clubId);
  const read = data?.current ?? null;
  const book = read ? data?.books.get(read.book_id) : undefined;
  const [pace, setPace] = useState<PaceRow[] | null>(null);

  useEffect(() => {
    if (!read || !data?.role) return;
    fetchPace(read.id).then(setPace).catch(() => setPace([]));
  }, [read, data?.role]);

  if (data === undefined) return <ClubScreen title=" " back={`/clubs/${clubId}`}><RowsSkeleton /></ClubScreen>;
  if (!data || !data.role) return <ClubScreen title="Pace" back={`/clubs/${clubId}`}><NotAMember clubId={clubId} /></ClubScreen>;
  if (!read || !book) {
    return (
      <ClubScreen title="Pace" back={`/clubs/${clubId}`}>
        <div className="empty" style={{ marginTop: 24 }}><p className="h2">Between books</p><p style={{ margin: 0, fontSize: 14 }}>The pace board comes back when the host picks the next one.</p></div>
      </ClubScreen>
    );
  }

  const total = read.plan.at(-1)?.through ?? 1;
  const expected = expectedChapter(read.plan, read.starts_on, today());
  const rows = (pace ?? []).filter((p) => !p.read_before);
  const before = (pace ?? []).filter((p) => p.read_before);
  const reachedOf = (p: PaceRow) => Math.min(total, p.reached ?? 0);
  rows.sort((a, b) => reachedOf(b) - reachedOf(a));
  const behind = rows.filter((p) => reachedOf(p) < expected);
  const name = (uid: string) => (uid === me?.id ? "You" : displayName(data.people.get(uid)));
  const linePct = Math.min(1, expected / total);

  return (
    <ClubScreen eyebrow={`${data.card.name} · ${book.title}`} title="Where everyone is" back={`/clubs/${clubId}`}>
      <p className="muted" style={{ margin: "10px 0 0", fontSize: 14, lineHeight: 1.45 }}>
        {expected > 0 ? (
          read.unit === "percent"
            ? <>The plan says <strong style={{ color: "var(--ink)" }}>{expected}%</strong> of the way through by today.</>
            : <>The plan says chapter <strong style={{ color: "var(--ink)" }}>{expected}</strong> of {total} by today.</>
        ) : `Starts ${read.starts_on}.`}
        {behind.length > 0 && ` ${behind.length} ${behind.length === 1 ? "is" : "are"} behind.`}
      </p>

      {!pace ? (
        <RowsSkeleton />
      ) : (
        <>
          <section className="card" style={{ marginTop: 14, padding: "18px 14px" }} aria-label="Pace board">
            <div className="pace-board">
              {expected > 0 && <span className="pace-board__line" aria-hidden="true" style={{ left: `calc(106px + (100% - 152px) * ${linePct})` }} />}
              {rows.length === 0 && <p className="muted" style={{ margin: 0, fontSize: 14 }}>Nobody has started yet.</p>}
              {rows.map((p) => {
                const r = reachedOf(p);
                const isBehind = r < expected;
                return (
                  <div key={p.user_id} className="pace-row">
                    <Link href={p.user_id === me?.id ? "/you" : `/u/${data.people.get(p.user_id)?.username ?? p.user_id}`} className="pace-row__name">{name(p.user_id)}</Link>
                    <span className="pace-row__bar" role="img" aria-label={`${name(p.user_id)}: ${p.reached == null ? "not started" : read.unit === "percent" ? `${r}%` : `chapter ${r} of ${total}`}${isBehind ? ", behind" : ""}`}>
                      <span className={isBehind ? "behind" : undefined} style={{ width: `${(r / total) * 100}%` }} />
                    </span>
                    <span className="pace-row__n muted">{p.reached == null ? "–" : read.unit === "percent" ? `${r}%` : r}</span>
                  </div>
                );
              })}
            </div>
          </section>

          {behind.filter((p) => p.user_id !== me?.id).length > 0 && (
            <section style={{ marginTop: 18 }} aria-label="Give a nudge">
              <h2 className="eyebrow">Give a nudge</h2>
              <div className="stack" style={{ marginTop: 8, gap: 8 }}>
                {behind.filter((p) => p.user_id !== me?.id).map((p) => (
                  <div key={p.user_id} className="card" style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px" }}>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 14 }}>
                      <strong>{name(p.user_id)}</strong> <span className="muted">· {p.reached == null ? "not started" : atLabel(read.unit, reachedOf(p))}</span>
                    </span>
                    <PokeButton userId={p.user_id} name={name(p.user_id)} />
                  </div>
                ))}
              </div>
            </section>
          )}

          {before.length > 0 && (
            <section style={{ marginTop: 18 }} aria-label="Read it before">
              <h2 className="eyebrow">Read it before</h2>
              <p style={{ margin: "6px 0 0", fontSize: 14, lineHeight: 1.45 }}>
                {before.map((p) => name(p.user_id)).join(", ")} {before.length === 1 ? "is" : "are"} skipping the reading and joining the talk. Every room is open to them.
              </p>
            </section>
          )}
        </>
      )}
    </ClubScreen>
  );
}
