"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/Auth";
import { displayName } from "@/components/Avatar";
import { ClubScreen, NotAMember, shortDate, useClub } from "@/components/ClubBits";
import { Cover } from "@/components/Cover";
import { RowsSkeleton } from "@/components/Skeleton";
import { WHOLE_BOOK } from "@/lib/clubs";
import { friendsRankedOn, type ScoredEntry } from "@/lib/data";
import { formatScore } from "@/lib/ranking";

interface Verdict {
  readId: string;
  bookId: string;
  finished: string;
  avg: number | null;
  scores: ScoredEntry[];
}

/** Average of members' scores on their own shelves, to one decimal. */
function average(xs: number[]): number | null {
  return xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null;
}

export function ShelfPage() {
  return (
    <RequireAuth>
      <Inner />
    </RequireAuth>
  );
}

/** The club's verdict on its latest book, and every finished read ranked by the club's average score. */
function Inner() {
  const { id: clubId } = useParams<{ id: string }>();
  const { data, me } = useClub(clubId);
  const [verdicts, setVerdicts] = useState<Verdict[] | null>(null);

  useEffect(() => {
    if (!data?.role) return;
    const finished = data.reads.filter((r) => r.finished_at);
    const memberIds = data.members.map((m) => m.user_id);
    friendsRankedOn(finished.map((r) => r.book_id), memberIds)
      .then((entries) => {
        setVerdicts(finished.map((r) => {
          const scores = entries.filter((e) => e.book_id === r.book_id).sort((a, b) => b.score - a.score);
          return { readId: r.id, bookId: r.book_id, finished: r.finished_at!, avg: average(scores.map((s) => s.score)), scores };
        }));
      })
      .catch(() => setVerdicts([]));
  }, [data]);

  if (data === undefined) return <ClubScreen title=" " back={`/clubs/${clubId}`}><RowsSkeleton /></ClubScreen>;
  if (!data || !data.role) return <ClubScreen title="Club shelf" back={`/clubs/${clubId}`}><NotAMember clubId={clubId} /></ClubScreen>;

  const latest = verdicts?.[0];
  const latestBook = latest ? data.books.get(latest.bookId) : undefined;
  const ranked = (verdicts ?? []).filter((v) => v.avg != null).sort((a, b) => b.avg! - a.avg!);
  const unranked = (verdicts ?? []).filter((v) => v.avg == null);
  const name = (uid: string) => (uid === me?.id ? "You" : displayName(data.people.get(uid)).split(" ")[0]);
  const mine = latest?.scores.find((s) => s.user_id === me?.id);

  return (
    <ClubScreen eyebrow={data.card.name} title="Club shelf" back={`/clubs/${clubId}`}>
      {!verdicts ? (
        <RowsSkeleton />
      ) : verdicts.length === 0 ? (
        <div className="empty" style={{ marginTop: 24 }}>
          <p className="h2">Nothing finished yet</p>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.45 }}>When the club finishes a book, everyone&rsquo;s scores come together here as the club&rsquo;s verdict.</p>
          <Link href={`/clubs/${clubId}`} className="btn" style={{ marginTop: 12 }}>Back to the club</Link>
        </div>
      ) : (
        <>
          {latest && latestBook && (
            <section aria-label="The club's verdict" style={{ marginTop: 16, background: "var(--panel)", color: "#fff", borderRadius: 20, padding: 20, display: "flex", gap: 16, alignItems: "center" }}>
              <Link href={`/book/${latestBook.id}`} style={{ flexShrink: 0 }}><Cover book={latestBook} width={64} /></Link>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
                <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#c9c8c2" }}>The club&rsquo;s verdict · {shortDate(latest.finished.slice(0, 10))}</span>
                <span className="g" style={{ fontSize: 24, lineHeight: 1.15 }}>{latestBook.title}</span>
                {latest.avg != null ? (
                  <>
                    <span style={{ fontFamily: "var(--font-book)", fontWeight: 700, fontSize: 40, lineHeight: 1 }}>{formatScore(latest.avg)}</span>
                    <span style={{ fontSize: 13, color: "#c9c8c2" }}>
                      {latest.scores.length} of {data.members.length} ranked it{mine ? ` · yours ${formatScore(mine.score)}` : ""}
                    </span>
                  </>
                ) : (
                  <span style={{ fontSize: 14, color: "#c9c8c2" }}>No one has ranked it yet. Rank it on your shelf to start the verdict.</span>
                )}
              </div>
            </section>
          )}

          {latest && latest.scores.length >= 2 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8, marginTop: 10 }}>
              <div className="card" style={{ padding: "12px 14px" }}>
                <span className="muted" style={{ display: "block", fontSize: 12 }}>Loved it most</span>
                <b style={{ fontSize: 15 }}>{name(latest.scores[0].user_id)} · {formatScore(latest.scores[0].score)}</b>
              </div>
              <div className="card" style={{ padding: "12px 14px" }}>
                <span className="muted" style={{ display: "block", fontSize: 12 }}>The holdout</span>
                <b style={{ fontSize: 15 }}>{name(latest.scores.at(-1)!.user_id)} · {formatScore(latest.scores.at(-1)!.score)}</b>
              </div>
            </div>
          )}

          {latest && latestBook && (
            <div style={{ display: "grid", gridTemplateColumns: mine ? "1fr" : "1fr 1fr", gap: 8, marginTop: 10 }}>
              {!mine && <Link href={`/book/${latestBook.id}`} className="btn">Rank it</Link>}
              <Link href={`/clubs/${clubId}/week/${WHOLE_BOOK}?read=${latest.readId}`} className="btn btn--outline">The discussion</Link>
            </div>
          )}

          <section aria-label="Club shelf" style={{ marginTop: 20 }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
              <h2 className="g" style={{ margin: 0, fontWeight: 400, fontSize: 22 }}>Ranked by the club</h2>
              <span className="muted" style={{ fontSize: 13 }}>{verdicts.length} read together</span>
            </div>
            <ol className="card" style={{ listStyle: "none", margin: "8px 0 0", padding: 0, overflow: "hidden" }}>
              {ranked.map((v, i) => {
                const b = data.books.get(v.bookId);
                return (
                  <li key={v.bookId} style={{ borderTop: i ? "1px solid var(--line)" : undefined }}>
                    <Link href={`/clubs/${clubId}/week/${WHOLE_BOOK}?read=${v.readId}`} aria-label={`${b?.title ?? "A book"}: club score ${formatScore(v.avg!)}. Open the discussion`} style={{ display: "flex", gap: 12, alignItems: "center", padding: "12px 14px", color: "inherit", textDecoration: "none" }}>
                      <span style={{ width: 18, fontFamily: "var(--font-book)", fontWeight: 700 }}>{i + 1}</span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: "block", fontSize: 15, fontWeight: 600 }}>{b?.title ?? "A book"}</span>
                        <span className="muted" style={{ fontSize: 12 }}>{v.scores.length} ranked · finished {shortDate(v.finished.slice(0, 10))}</span>
                      </span>
                      <span style={{ fontFamily: "var(--font-book)", fontWeight: 700, fontSize: 17 }}>{formatScore(v.avg!)}</span>
                    </Link>
                  </li>
                );
              })}
              {unranked.map((v, i) => {
                const b = data.books.get(v.bookId);
                return (
                  <li key={v.bookId} style={{ borderTop: ranked.length || i ? "1px solid var(--line)" : undefined }}>
                    <Link href={`/clubs/${clubId}/week/${WHOLE_BOOK}?read=${v.readId}`} style={{ display: "flex", gap: 12, alignItems: "center", padding: "12px 14px", color: "inherit", textDecoration: "none" }}>
                      <span style={{ width: 18 }} className="muted">–</span>
                      <span style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 600 }}>{b?.title ?? "A book"}</span>
                      <span className="muted" style={{ fontSize: 12 }}>Not ranked yet</span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          </section>
          <p className="muted" style={{ margin: "12px 0 40px", fontSize: 13, lineHeight: 1.45 }}>
            Everyone ranks the book on their own shelf as usual; the club score is the average. Members who read it before count with their existing ranking. Tap a book to revisit the club&rsquo;s discussion.
          </p>
        </>
      )}
    </ClubScreen>
  );
}
