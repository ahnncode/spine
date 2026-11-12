"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { RequireAuth, useProfile } from "@/components/Auth";
import { Avatar, displayName } from "@/components/Avatar";
import { canOpenRoom, roomHref, roomLabel } from "@/components/ChapterRooms";
import { BackIcon, LockIcon } from "@/components/icons";
import { RowsSkeleton } from "@/components/Skeleton";
import { HeartButton } from "@/components/Social";
import { useShelf } from "@/components/useShelf";
import type { Book } from "@/lib/books";
import {
  FINISHED, WHOLE_BOOK, deleteRoomComment, fetchBooks, fetchFollowing, fetchHearts, fetchProfiles, fetchRoom, fetchRoomCounts,
  postRoomComment, reachedChapter, report, tasteMatches, type HeartState, type Profile, type RoomComment,
} from "@/lib/data";
import { timeAgo } from "@/lib/time";

const MAX = 500;

export function RoomPage() {
  return (
    <RequireAuth>
      <Inner />
    </RequireAuth>
  );
}

interface Loaded {
  book: Book | null;
  reached: number | null;
  comments: RoomComment[];
  counts: Map<number, { comments: number }>;
  people: Map<string, Profile>;
  friends: Set<string>;
  matches: Map<string, number>;
  hearts: Map<string, HeartState>;
}

/**
 * One chapter's room: friends' comments first, then everyone else reading the
 * book, each with hearts and one level of replies. Rooms past where you are
 * stay locked (the database won't return them either).
 */
function Inner() {
  const params = useParams<{ id: string; chapter: string }>();
  const bookId = params.id;
  const chapter = Math.max(0, Math.min(999, parseInt(params.chapter, 10) || 0));
  const router = useRouter();
  const { profile } = useProfile();
  const { entries } = useShelf();
  const entry = useMemo(() => entries?.find((e) => e.book_id === bookId) ?? null, [entries, bookId]);
  const [data, setData] = useState<Loaded | null>(null);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<RoomComment | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const [books, reached, counts, following] = await Promise.all([
      fetchBooks([bookId]).catch(() => []),
      reachedChapter(bookId).catch(() => null),
      fetchRoomCounts(bookId).catch(() => new Map()),
      fetchFollowing().catch(() => [] as string[]),
    ]);
    const comments = canOpenRoom(reached, chapter) ? await fetchRoom(bookId, chapter) : [];
    const ids = [...new Set(comments.map((c) => c.user_id))];
    const [people, matches, hearts] = await Promise.all([
      fetchProfiles(ids),
      tasteMatches(ids).catch(() => new Map()),
      fetchHearts(comments.map((c) => ({ type: "chapter_comment" as const, id: c.id }))).catch(() => new Map()),
    ]);
    setData({
      book: books[0] ?? null, reached, comments, counts, people, hearts,
      friends: new Set(following),
      matches: new Map([...matches.entries()].map(([k, m]) => [k, (m as { match?: number | null }).match ?? 0])),
    });
  }, [bookId, chapter]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loads after an await
    load().catch(() => setData({ book: null, reached: null, comments: [], counts: new Map(), people: new Map(), friends: new Set(), matches: new Map(), hearts: new Map() }));
  }, [load]);

  const total = entry?.chapter_total ?? data?.book?.chapters ?? null;
  const reached = data?.reached ?? null;
  const finished = reached != null && reached >= FINISHED;
  const open = canOpenRoom(reached, chapter);

  // Chapter chips: rooms you've reached around this one, then the next couple, locked.
  const chips = useMemo(() => {
    if (!data) return [] as Array<{ c: number; locked: boolean }>;
    const last = finished ? (total ?? Math.max(chapter, ...[...data.counts.keys()])) : (reached ?? 0);
    const out: Array<{ c: number; locked: boolean }> = [];
    if (finished) out.push({ c: WHOLE_BOOK, locked: false });
    for (let c = 1; c <= last; c++) out.push({ c, locked: false });
    if (!finished) for (let c = last + 1; c <= Math.min(last + 2, total ?? last + 2); c++) out.push({ c, locked: true });
    return out;
  }, [data, finished, total, reached, chapter]);
  const stripRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    stripRef.current?.querySelector<HTMLElement>("[aria-current='page']")?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [chips]);

  async function post(e: FormEvent) {
    e.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await postRoomComment(bookId, chapter, text.slice(0, MAX), replyTo ? (replyTo.parent_id ?? replyTo.id) : null);
      setText("");
      setReplyTo(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn’t post that");
    } finally {
      setBusy(false);
    }
  }

  async function remove(c: RoomComment) {
    setMenu(null);
    await deleteRoomComment(c.id).catch(() => {});
    await load();
  }

  async function flag(c: RoomComment) {
    setMenu(null);
    await report("chapter_comment", c.id).catch(() => {});
    setError("Thanks. We’ll take a look.");
  }

  function startReply(c: RoomComment) {
    setReplyTo(c);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  const back = (
    <button className="icon-btn" aria-label="Back" onClick={() => (window.history.length > 1 ? router.back() : router.push(`/book/${bookId}`))}><BackIcon size={20} /></button>
  );

  const top = (data?.comments ?? []).filter((c) => !c.parent_id);
  const replies = (id: string) => (data?.comments ?? []).filter((c) => c.parent_id === id);
  const friendsTop = top.filter((c) => data!.friends.has(c.user_id) || c.user_id === profile?.id);
  const othersTop = top.filter((c) => !data!.friends.has(c.user_id) && c.user_id !== profile?.id);

  function renderComment(c: RoomComment, reply = false) {
    const p = data!.people.get(c.user_id);
    const mine = c.user_id === profile?.id;
    const m = data!.matches.get(c.user_id);
    return (
      <article key={c.id} className={`room-comment${reply ? " room-comment--reply" : ""}`}>
        <Avatar profile={p ?? { id: c.user_id, display_name: null, username: null }} size={reply ? 26 : 32} link />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
            <strong style={{ fontSize: 14 }}>{mine ? "You" : displayName(p)}</strong>
            <span className="muted" style={{ fontSize: 12 }}>
              {[timeAgo(c.created_at), !mine && !data!.friends.has(c.user_id) && m ? `${m}% match` : null].filter(Boolean).join(" · ")}
            </span>
          </div>
          <p style={{ margin: "4px 0 0", fontSize: 15, lineHeight: 1.45, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{c.body}</p>
          <div className="room-comment__actions">
            <HeartButton type="chapter_comment" id={c.id} initial={data!.hearts.get(`chapter_comment:${c.id}`)} />
            <button type="button" className="link-btn" style={{ minHeight: 32, fontSize: 13 }} onClick={() => startReply(c)}>Reply</button>
            <button type="button" className="link-btn muted" style={{ minHeight: 32, fontSize: 13 }} aria-expanded={menu === c.id} onClick={() => setMenu(menu === c.id ? null : c.id)}>{mine ? "Delete" : "Report"}</button>
            {menu === c.id && (
              <button type="button" className="small-btn small-btn--outline" style={{ minHeight: 32 }} onClick={() => (mine ? remove(c) : flag(c))}>
                {mine ? "Delete it" : "Report it"}
              </button>
            )}
          </div>
        </div>
      </article>
    );
  }

  function renderThread(c: RoomComment) {
    return (
      <div key={c.id} className="card room-thread">
        {renderComment(c)}
        {replies(c.id).map((r) => renderComment(r, true))}
      </div>
    );
  }

  return (
    <div className="app">
      <main className="screen screen--flow room" style={{ paddingTop: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {back}
          <div style={{ minWidth: 0 }}>
            <Link href={`/book/${bookId}`} className="muted" style={{ display: "block", fontSize: 13, textDecoration: "none", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {data?.book ? `${data.book.title}${data.book.author ? ` · ${data.book.author}` : ""}` : " "}
            </Link>
            <h1 className="g" style={{ margin: 0, fontSize: 26, lineHeight: 1.15, fontWeight: 400 }}>{roomLabel(chapter)}</h1>
          </div>
        </div>

        {chips.length > 0 && (
          <div className="room-chips" ref={stripRef} role="navigation" aria-label="Chapters">
            {chips.map(({ c, locked }) =>
              locked ? (
                <span key={c} className="room-chip room-chip--locked" aria-label={`${roomLabel(c)}, locked until you reach it`}>
                  <LockIcon size={12} />{c}
                </span>
              ) : (
                <Link key={c} href={roomHref(bookId, c)} replace className="room-chip" aria-current={c === chapter ? "page" : undefined}>
                  {c === WHOLE_BOOK ? "Whole book" : c}
                  {data?.counts.get(c)?.comments ? <span className="room-chip__n"> · {data.counts.get(c)!.comments}</span> : null}
                </Link>
              ),
            )}
          </div>
        )}

        {!data ? (
          <RowsSkeleton />
        ) : !open ? (
          <div className="empty" style={{ marginTop: 24 }}>
            <LockIcon size={28} />
            <p className="h2">{chapter === WHOLE_BOOK ? "Opens when you finish" : `Opens at chapter ${chapter}`}</p>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.45 }}>
              {reached == null ? "Add this book to your shelf and check in as you read." : `You’re at chapter ${reached}. Check in once you get here and the room opens.`}
              {data.counts.get(chapter)?.comments ? ` ${data.counts.get(chapter)!.comments} comments are waiting.` : ""}
            </p>
            <Link href={`/book/${bookId}`} className="btn" style={{ marginTop: 12 }}>Go to the book</Link>
          </div>
        ) : top.length === 0 ? (
          <div className="empty" style={{ marginTop: 24 }}>
            <p className="h2">Nobody&rsquo;s here yet</p>
            <p style={{ margin: 0, fontSize: 14 }}>Say what you thought of {chapter === WHOLE_BOOK ? "the book" : "this chapter"}. Only readers who&rsquo;ve got this far will see it.</p>
          </div>
        ) : (
          <>
            {friendsTop.length > 0 && (
              <section aria-label="Friends" style={{ marginTop: 20 }}>
                <h2 className="eyebrow">Friends · {friendsTop.length}</h2>
                <div className="stack" style={{ marginTop: 10, gap: 10 }}>{friendsTop.map(renderThread)}</div>
              </section>
            )}
            {othersTop.length > 0 && (
              <section aria-label="Everyone reading" style={{ marginTop: 20 }}>
                <h2 className="eyebrow">{friendsTop.length ? "Everyone reading" : "Readers"} · {othersTop.length}</h2>
                <div className="stack" style={{ marginTop: 10, gap: 10 }}>{othersTop.map(renderThread)}</div>
              </section>
            )}
          </>
        )}
        <div style={{ height: 120 }} />
      </main>

      {data && open && (
        <form className="room-composer" aria-label="Write a comment" onSubmit={post}>
          {replyTo && (
            <p className="room-composer__reply">
              Replying to {replyTo.user_id === profile?.id ? "yourself" : displayName(data.people.get(replyTo.user_id)).split(" ")[0]}
              <button type="button" className="link-btn" style={{ minHeight: 28, fontSize: 13 }} onClick={() => setReplyTo(null)}>Cancel</button>
            </p>
          )}
          {error && <p className="error" role="alert" style={{ margin: "0 0 8px" }}>{error}</p>}
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <label htmlFor="room-say" className="visually-hidden">Say something about {chapter === WHOLE_BOOK ? "the book" : `chapter ${chapter}`}</label>
            <input
              id="room-say"
              ref={inputRef}
              className="input"
              style={{ flex: 1, minHeight: 44, borderRadius: 22 }}
              maxLength={MAX}
              value={text}
              placeholder={replyTo ? "Write a reply" : `Say something about ${chapter === WHOLE_BOOK ? "the book" : `chapter ${chapter}`}`}
              onChange={(e) => setText(e.target.value)}
            />
            <button className="btn" style={{ minHeight: 44, padding: "0 18px" }} disabled={busy || !text.trim()}>{busy ? "…" : "Post"}</button>
          </div>
        </form>
      )}
    </div>
  );
}
