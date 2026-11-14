"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/Auth";
import { Avatar, displayName } from "@/components/Avatar";
import { ClubScreen, NotAMember, useClub } from "@/components/ClubBits";
import { Cover } from "@/components/Cover";
import { RowsSkeleton } from "@/components/Skeleton";
import { WHOLE_BOOK, fetchReveal, revealSummary, type RevealRow } from "@/lib/clubs";
import { formatScore } from "@/lib/ranking";

export function RevealPage() {
  return (
    <RequireAuth>
      <Inner />
    </RequireAuth>
  );
}

/**
 * Everyone's score for the club's book, shown together: the club's score,
 * the biggest split and who ranked it most like the club. Before the reveal
 * opens, only who has ranked so far.
 */
function Inner() {
  const { id: clubId } = useParams<{ id: string }>();
  const params = useSearchParams();
  const { data, me } = useClub(clubId);
  const readId = params.get("read") ?? data?.current?.id ?? null;
  const [state, setState] = useState<{ open: boolean; rows: RevealRow[] } | null | undefined>(undefined);

  useEffect(() => {
    if (!data?.role || !readId) return;
    fetchReveal(readId).then(setState).catch(() => setState(null));
  }, [data?.role, readId]);

  if (data === undefined) return <ClubScreen title=" " back={`/clubs/${clubId}`}><RowsSkeleton /></ClubScreen>;
  if (!data || !data.role) return <ClubScreen title="The reveal" back={`/clubs/${clubId}`}><NotAMember clubId={clubId} /></ClubScreen>;

  const read = data.reads.find((r) => r.id === readId);
  const book = read ? data.books.get(read.book_id) : undefined;
  const name = (uid: string) => (uid === me?.id ? "You" : displayName(data.people.get(uid)).split(" ")[0]);
  const memberCount = data.members.length;

  if (state === undefined) return <ClubScreen eyebrow={data.card.name} title="The reveal" back={`/clubs/${clubId}`}><RowsSkeleton /></ClubScreen>;
  if (!state || !read || !book) {
    return (
      <ClubScreen eyebrow={data.card.name} title="The reveal" back={`/clubs/${clubId}`}>
        <p className="lede" style={{ marginTop: 16 }}>Couldn&rsquo;t load the reveal. Try again in a moment.</p>
      </ClubScreen>
    );
  }

  const scored = state.rows.filter((r) => r.score != null).sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const { avg, high, low, closest } = revealSummary(state.rows);
  const notYet = data.members.filter((m) => !state.rows.some((r) => r.user_id === m.user_id));

  return (
    <ClubScreen eyebrow={data.card.name} title="The reveal" back={`/clubs/${clubId}`}>
      <section aria-label="The club's score" style={{ marginTop: 16, background: "var(--panel)", color: "var(--on-panel)", borderRadius: 22, padding: 20, display: "flex", gap: 16, alignItems: "center" }}>
        <Link href={`/book/${book.id}`} aria-label={`${book.title}: book page`} style={{ flexShrink: 0 }}><Cover book={book} width={64} /></Link>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
          <span className="g" style={{ fontSize: 24, lineHeight: 1.15 }}>{book.title}</span>
          {state.open && avg != null ? (
            <>
              <span style={{ fontFamily: "var(--font-book)", fontWeight: 700, fontSize: 44, lineHeight: 1 }}>{formatScore(avg)}</span>
              <span style={{ fontSize: 13, color: "var(--on-panel-muted)" }}>The club&rsquo;s score · {scored.length} of {memberCount} ranked it</span>
            </>
          ) : state.open ? (
            <span style={{ fontSize: 14, color: "var(--on-panel-muted)" }}>No one has ranked it yet. Rank it on your shelf and it shows up here.</span>
          ) : (
            <span style={{ fontSize: 14, color: "var(--on-panel-muted)" }}>
              {state.rows.length} of {memberCount} ranked it so far. Scores come out when the meeting starts, or when the host opens the reveal.
            </span>
          )}
        </div>
      </section>

      {state.open && high && low && high.score !== low.score && (
        <p style={{ margin: "14px 0 0", fontSize: 15, lineHeight: 1.5 }}>
          The biggest split: <strong>{name(high.user_id)} {formatScore(high.score!)}</strong>, <strong>{name(low.user_id)} {formatScore(low.score!)}</strong>.
          {closest && <> {name(closest.user_id)} ranked it most like the club.</>}
        </p>
      )}

      {state.open && scored.length > 0 && (
        <ol style={{ listStyle: "none", margin: "16px 0 0", padding: 0 }}>
          {scored.map((r, i) => (
            <li key={r.user_id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderTop: i ? "1px solid var(--line)" : undefined }}>
              <Avatar profile={data.people.get(r.user_id)} size={36} link />
              <span style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 600 }}>{name(r.user_id)}</span>
              <span style={{ fontFamily: "var(--font-book)", fontWeight: 700, fontSize: 20 }}>{formatScore(r.score!)}</span>
            </li>
          ))}
        </ol>
      )}

      {!state.open && state.rows.length > 0 && (
        <ul style={{ listStyle: "none", margin: "16px 0 0", padding: 0 }}>
          {state.rows.map((r, i) => (
            <li key={r.user_id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderTop: i ? "1px solid var(--line)" : undefined }}>
              <Avatar profile={data.people.get(r.user_id)} size={36} />
              <span style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 600 }}>{name(r.user_id)}</span>
              <span className="muted" style={{ fontSize: 14 }}>{r.score != null ? `yours: ${formatScore(r.score)}` : "ranked"}</span>
            </li>
          ))}
        </ul>
      )}

      {notYet.length > 0 && (
        <p className="muted" style={{ margin: "14px 0 0", fontSize: 13 }}>
          Still to rank: {notYet.map((m) => name(m.user_id)).join(", ")}
        </p>
      )}

      <div style={{ display: "grid", gridTemplateColumns: state.rows.some((r) => r.user_id === me?.id) ? "1fr" : "1fr 1fr", gap: 8, marginTop: 16 }}>
        {!state.rows.some((r) => r.user_id === me?.id) && <Link href={`/book/${book.id}`} className="btn">Rank it</Link>}
        <Link href={`/clubs/${clubId}/week/${WHOLE_BOOK}?read=${read.id}`} className="btn btn--outline">The discussion</Link>
      </div>
    </ClubScreen>
  );
}
