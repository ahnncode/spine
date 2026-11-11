"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { RequireAuth } from "@/components/Auth";
import { Avatar, displayName } from "@/components/Avatar";
import { ClubScreen, NotAMember, useClub } from "@/components/ClubBits";
import { LockIcon } from "@/components/icons";
import { RowsSkeleton } from "@/components/Skeleton";
import { HeartButton } from "@/components/Social";
import {
  COMMENT_MAX, WHOLE_BOOK, deleteWeekComment, fetchPace, fetchRoomCounts, fetchWeekComments, postWeekComment, weekOpen, weekRange,
  type ClubComment,
} from "@/lib/clubs";
import { fetchHearts, fetchProfiles, report, type HeartState, type Profile } from "@/lib/data";
import { timeAgo } from "@/lib/time";

export function WeekPage() {
  return (
    <RequireAuth>
      <Inner />
    </RequireAuth>
  );
}

/** One week's room in the club's current read: the host's questions, then the conversation. */
function Inner() {
  const params = useParams<{ id: string; week: string }>();
  const clubId = params.id;
  const week = Math.max(0, Math.min(52, parseInt(params.week, 10) || 0));
  const { data, me } = useClub(clubId);
  // ?read= opens a past book's rooms (from the club shelf); otherwise the current read.
  const readParam = useSearchParams().get("read");
  const read = (readParam ? data?.reads.find((r) => r.id === readParam) : data?.current) ?? null;
  const past = Boolean(read?.finished_at);
  const q = readParam ? `?read=${readParam}` : "";
  const book = read ? data?.books.get(read.book_id) : undefined;
  const [state, setState] = useState<{ open: boolean; comments: ClubComment[]; people: Map<string, Profile>; hearts: Map<string, HeartState>; counts: Map<number, number>; reached: number | null; before: boolean } | null>(null);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<ClubComment | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const isHost = data?.role === "host" || data?.role === "cohost";

  const load = useCallback(async () => {
    if (!read || !data?.role) return;
    const [pace, counts] = await Promise.all([fetchPace(read.id), fetchRoomCounts(read.id)]);
    const mine = pace.find((p) => p.user_id === me?.id);
    const open = weekOpen(read.plan, week, mine?.reached ?? null, Boolean(mine?.read_before));
    const comments = open ? await fetchWeekComments(read.id, week) : [];
    const [people, hearts] = await Promise.all([
      fetchProfiles([...new Set(comments.map((c) => c.user_id))]),
      fetchHearts(comments.map((c) => ({ type: "club_comment" as const, id: c.id }))).catch(() => new Map()),
    ]);
    setState({ open, comments, people, hearts, counts, reached: mine?.reached ?? null, before: Boolean(mine?.read_before) });
  }, [read, data?.role, me?.id, week]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loads from the network
    load().catch(() => setState({ open: false, comments: [], people: new Map(), hearts: new Map(), counts: new Map(), reached: null, before: false }));
  }, [load]);

  if (data === undefined) return <ClubScreen title=" " back={`/clubs/${clubId}`}><RowsSkeleton /></ClubScreen>;
  if (!data || !data.role) return <ClubScreen title="Club room" back={`/clubs/${clubId}`}><NotAMember clubId={clubId} /></ClubScreen>;
  if (!read || !book) {
    return (
      <ClubScreen title="Club room" back={`/clubs/${clubId}`}>
        <div className="empty" style={{ marginTop: 24 }}><p className="h2">Between books</p><Link href={`/clubs/${clubId}`} className="btn" style={{ marginTop: 12 }}>Back to the club</Link></div>
      </ClubScreen>
    );
  }

  const label = week === WHOLE_BOOK ? "Whole book" : `Week ${week}`;
  const titleRange = week === WHOLE_BOOK ? "" : ` · ${weekRange(read.plan, week).replace(/^Chapters?/, "ch.")}`;
  const questions = week === WHOLE_BOOK ? [] : (read.plan[week - 1]?.questions ?? []);
  const top = (state?.comments ?? []).filter((c) => !c.parent_id);
  const replies = (id: string) => (state?.comments ?? []).filter((c) => c.parent_id === id);
  const weeks = [...read.plan.map((_, i) => i + 1), WHOLE_BOOK];

  async function post(e: FormEvent) {
    e.preventDefault();
    if (!text.trim() || busy || !read) return;
    setBusy(true);
    setError(null);
    try {
      await postWeekComment(read.id, week, text, replyTo ? (replyTo.parent_id ?? replyTo.id) : null);
      setText("");
      setReplyTo(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn’t post that");
    } finally {
      setBusy(false);
    }
  }

  function renderComment(c: ClubComment, reply = false) {
    const p = state!.people.get(c.user_id);
    const mine = c.user_id === me?.id;
    const canDelete = mine || isHost;
    return (
      <article key={c.id} className={`room-comment${reply ? " room-comment--reply" : ""}`}>
        <Avatar profile={p ?? { id: c.user_id, display_name: null, username: null }} size={reply ? 26 : 32} link />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
            <strong style={{ fontSize: 14 }}>{mine ? "You" : displayName(p)}</strong>
            <span className="muted" style={{ fontSize: 12 }}>{timeAgo(c.created_at)}</span>
          </div>
          <p style={{ margin: "4px 0 0", fontSize: 15, lineHeight: 1.45, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{c.body}</p>
          <div className="room-comment__actions">
            <HeartButton type="club_comment" id={c.id} initial={state!.hearts.get(`club_comment:${c.id}`)} />
            <button type="button" className="link-btn" style={{ minHeight: 32, fontSize: 13 }} onClick={() => { setReplyTo(c); setTimeout(() => inputRef.current?.focus(), 0); }}>Reply</button>
            <button type="button" className="link-btn muted" style={{ minHeight: 32, fontSize: 13 }} aria-expanded={menu === c.id} onClick={() => setMenu(menu === c.id ? null : c.id)}>{canDelete ? "Delete" : "Report"}</button>
            {menu === c.id && (
              <button type="button" className="small-btn small-btn--outline" style={{ minHeight: 32 }} onClick={async () => {
                setMenu(null);
                if (canDelete) await deleteWeekComment(c.id).catch(() => {});
                else { await report("club_comment", c.id).catch(() => {}); setNotice("Thanks for flagging it. We’ll take a look."); }
                await load();
              }}>{canDelete ? "Delete it" : "Report it"}</button>
            )}
          </div>
        </div>
      </article>
    );
  }

  return (
    <ClubScreen eyebrow={`${data.card.name} · ${book.title}${past ? " · finished" : ""}`} title={`${label}${titleRange}`} back={`/clubs/${clubId}`}>
      <nav className="room-chips" aria-label="Weeks">
        {weeks.map((w) => {
          const open = state ? weekOpen(read.plan, w, state.reached, state.before) : false;
          const n = state?.counts.get(w) ?? 0;
          const name = w === WHOLE_BOOK ? "Whole book" : `Week ${w}`;
          return open ? (
            <Link key={w} href={`/clubs/${clubId}/week/${w}${q}`} replace className="room-chip" aria-current={w === week ? "page" : undefined}>
              {name}{n ? <span className="room-chip__n"> · {n}</span> : null}
            </Link>
          ) : (
            <span key={w} className="room-chip room-chip--locked" aria-current={w === week ? "page" : undefined} aria-label={`${name}, locked`}><LockIcon size={12} />{w === WHOLE_BOOK ? "Whole book" : w}</span>
          );
        })}
      </nav>

      {!state ? (
        <RowsSkeleton />
      ) : !state.open ? (
        <div className="empty" style={{ marginTop: 24 }}>
          <LockIcon size={28} />
          <p className="h2">{week === WHOLE_BOOK ? "Opens when you finish" : `Opens at chapter ${read.plan[week - 1]?.through ?? "?"}`}</p>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.45 }}>
            {state.reached ? `You’re at chapter ${state.reached}. ` : ""}Check in once you get there and the room opens.{state.counts.get(week) ? ` ${state.counts.get(week)} comments are waiting.` : ""}
          </p>
          <Link href={`/clubs/${clubId}`} className="btn" style={{ marginTop: 12 }}>Back to the club</Link>
        </div>
      ) : (
        <>
          {questions.length > 0 && (
            <section className="club-questions" aria-label="The host's questions">
              <span className="eyebrow" style={{ color: "inherit" }}>From the host</span>
              <ol style={{ margin: "6px 0 0", paddingLeft: 20, fontSize: 15, lineHeight: 1.45 }}>
                {questions.map((q, i) => <li key={i}>{q}</li>)}
              </ol>
            </section>
          )}
          {top.length === 0 ? (
            <div className="empty" style={{ marginTop: 24 }}>
              <p className="h2">Nobody&rsquo;s here yet</p>
              <p style={{ margin: 0, fontSize: 14 }}>Start the conversation. Only members who&rsquo;ve read this far see it.</p>
            </div>
          ) : (
            <div className="stack" style={{ marginTop: 16, gap: 10 }}>
              {top.map((c) => (
                <div key={c.id} className="card room-thread">
                  {renderComment(c)}
                  {replies(c.id).map((r) => renderComment(r, true))}
                </div>
              ))}
            </div>
          )}
        </>
      )}
      <div style={{ height: 120 }} />

      {state?.open && (
        <form className="room-composer" onSubmit={post}>
          {replyTo && (
            <p className="room-composer__reply">
              Replying to {replyTo.user_id === me?.id ? "yourself" : displayName(state.people.get(replyTo.user_id)).split(" ")[0]}
              <button type="button" className="link-btn" style={{ minHeight: 28, fontSize: 13 }} onClick={() => setReplyTo(null)}>Cancel</button>
            </p>
          )}
          {error && <p className="error" role="alert" style={{ margin: "0 0 8px" }}>{error}</p>}
          {notice && <p role="status" style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 600 }}>{notice}</p>}
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
            <label htmlFor="week-say" className="visually-hidden">Say something about {label.toLowerCase()}</label>
            <textarea id="week-say" ref={inputRef} className="textarea" rows={1} maxLength={COMMENT_MAX} value={text}
              placeholder={replyTo ? "Write a reply" : `Say something about ${label.toLowerCase()}`}
              onChange={(e) => {
                setText(e.target.value);
                // Grow with the text, up to the max height.
                e.currentTarget.style.height = "auto";
                e.currentTarget.style.height = `${e.currentTarget.scrollHeight}px`;
              }} />
            <button className="btn" style={{ minHeight: 44, padding: "0 18px" }} disabled={busy || !text.trim()}>{busy ? "…" : "Post"}</button>
          </div>
          {text.length > COMMENT_MAX - 100 && <p className="muted" style={{ margin: "6px 0 0", fontSize: 12, textAlign: "right" }}>{COMMENT_MAX - text.length} left</p>}
        </form>
      )}
    </ClubScreen>
  );
}
