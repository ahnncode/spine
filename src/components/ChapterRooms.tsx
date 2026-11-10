"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Avatar, displayName } from "@/components/Avatar";
import { LockIcon } from "@/components/icons";
import type { Book } from "@/lib/books";
import {
  FINISHED, WHOLE_BOOK, fetchFollowing, fetchProfiles, fetchRoom, fetchRoomCounts, reachedChapter,
  type Entry, type Profile, type RoomComment,
} from "@/lib/data";

/** "Chapter 7", or "Whole book" for chapter 0. */
export function roomLabel(chapter: number): string {
  return chapter === WHOLE_BOOK ? "Whole book" : `Chapter ${chapter}`;
}

/** Whether a reader at `reached` can open `chapter`'s room. */
export function canOpenRoom(reached: number | null, chapter: number): boolean {
  if (reached == null) return false;
  return chapter === WHOLE_BOOK ? reached >= FINISHED : reached >= chapter;
}

export function roomHref(bookId: string, chapter: number): string {
  return `/book/${bookId}/room/${chapter}`;
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

/**
 * The book page's "Chapter rooms": the rooms you've reached (newest first,
 * with how many comments each has), the whole-book room once you finish,
 * and a line for the chapters still ahead of you.
 */
export function BookRooms({ book, entry }: { book: Book; entry: Entry | null }) {
  const [reached, setReached] = useState<number | null | undefined>(undefined);
  const [counts, setCounts] = useState<Map<number, { comments: number; latest: string }>>(new Map());
  const [all, setAll] = useState(false);
  const status = entry?.status;
  const progress = entry?.progress_chapter ?? entry?.progress_pct ?? null;

  useEffect(() => {
    if (!status || status === "want") return;
    let live = true;
    Promise.all([reachedChapter(book.id), fetchRoomCounts(book.id)])
      .then(([r, c]) => {
        if (!live) return;
        setReached(r);
        setCounts(c);
      })
      .catch(() => live && setReached(null));
    return () => {
      live = false;
    };
  }, [book.id, status, progress]);

  if (!entry || entry.status === "want" || reached === undefined) return null;
  const finished = reached != null && reached >= FINISHED;
  const total = entry.chapter_total ?? book.chapters ?? null;
  const upTo = finished ? (total ?? Math.max(0, ...[...counts.keys()])) : (reached ?? 0);
  const comments = [...counts.values()].reduce((n, c) => n + c.comments, 0);

  // No chapter count and not finished: nothing to open yet.
  if (!finished && !total && !(reached && reached > 0)) {
    return (
      <section className="rooms" aria-label="Chapter rooms">
        <h2 className="h2" style={{ margin: 0 }}>Chapter rooms</h2>
        <p className="muted" style={{ margin: "6px 0 0", fontSize: 14, lineHeight: 1.45 }}>
          Check in by chapter and each chapter&rsquo;s room opens as you reach it, with what other readers said. No spoilers past where you are.
        </p>
      </section>
    );
  }

  const open: number[] = [];
  for (let c = upTo; c >= 1; c--) open.push(c);
  const shown = all ? open : open.slice(0, 3);
  const rest = open.length - shown.length;

  return (
    <section className="rooms" aria-label="Chapter rooms">
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <h2 className="h2" style={{ margin: 0 }}>Chapter rooms</h2>
        {comments > 0 && <span className="muted" style={{ fontSize: 13 }}>{plural(comments, "comment")} so far</span>}
      </div>
      <p className="muted" style={{ margin: "4px 0 0", fontSize: 14, lineHeight: 1.45 }}>
        {finished ? "You’ve finished, so every room is open." : "Each chapter’s room opens once you’ve read it. No spoilers past where you are."}
      </p>
      <ul className="rooms__list">
        {finished && (
          <li>
            <Link href={roomHref(book.id, WHOLE_BOOK)} className="rooms__row">
              <span className="rooms__num rooms__num--word">All</span>
              <span className="rooms__label">
                <strong>Whole book</strong>
                <span className="muted"> · {counts.get(WHOLE_BOOK) ? plural(counts.get(WHOLE_BOOK)!.comments, "comment") : "talk about the ending"}</span>
              </span>
            </Link>
          </li>
        )}
        {shown.map((c) => {
          const n = counts.get(c)?.comments ?? 0;
          return (
            <li key={c}>
              <Link href={roomHref(book.id, c)} className="rooms__row">
                <span className="rooms__num">{c}</span>
                <span className="rooms__label">{n ? <strong>{plural(n, "comment")}</strong> : <span className="muted">No comments yet</span>}</span>
              </Link>
            </li>
          );
        })}
        {rest > 0 && (
          <li>
            <button type="button" className="rooms__row rooms__more" onClick={() => setAll(true)}>
              <span className="rooms__num rooms__num--word">{open[open.length - 1]}–{open[shown.length]}</span>
              <span className="rooms__label muted">{plural(rest, "more room")}</span>
            </button>
          </li>
        )}
        {!finished && total && upTo < total && (
          <li className="rooms__row rooms__locked" aria-label={`Chapters ${upTo + 1} to ${total} open as you read`}>
            <span className="rooms__num rooms__num--word" aria-hidden="true"><LockIcon size={15} /></span>
            <span className="rooms__label">
              {upTo + 1 === total ? `Chapter ${total} opens` : `Chapters ${upTo + 1} to ${total} open`} as you read
              {(() => {
                const ahead = [...counts.entries()].filter(([c]) => c > upTo).reduce((s, [, v]) => s + v.comments, 0);
                return ahead ? <span className="muted"> · {plural(ahead, "comment")} waiting</span> : null;
              })()}
            </span>
          </li>
        )}
      </ul>
    </section>
  );
}

/**
 * After a check-in: the room for the chapter you just reached, with a
 * friend's comment from it if there is one.
 */
export function RoomPrompt({ bookId, chapter, onOpen }: { bookId: string; chapter: number; onOpen?: () => void }) {
  const [state, setState] = useState<{ comments: RoomComment[]; people: Map<string, Profile>; friends: Set<string> } | null>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      const [comments, following] = await Promise.all([fetchRoom(bookId, chapter), fetchFollowing().catch(() => [] as string[])]);
      const people = await fetchProfiles([...new Set(comments.map((c) => c.user_id))]);
      if (live) setState({ comments, people, friends: new Set(following) });
    })().catch(() => live && setState({ comments: [], people: new Map(), friends: new Set() }));
    return () => {
      live = false;
    };
  }, [bookId, chapter]);

  const top = state?.comments.filter((c) => !c.parent_id) ?? [];
  const friendsHere = [...new Set(top.filter((c) => state!.friends.has(c.user_id)).map((c) => c.user_id))];
  const preview = [...top].reverse().find((c) => state!.friends.has(c.user_id)) ?? top[top.length - 1];
  const who = preview ? state!.people.get(preview.user_id) : undefined;

  return (
    <section className="room-prompt" aria-label={`${roomLabel(chapter)} room`}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span className="eyebrow" style={{ color: "var(--cobalt-ink)" }}>{roomLabel(chapter)} room · now open</span>
        {state && state.comments.length > 0 && <span style={{ fontSize: 12, color: "var(--cobalt-ink)" }}>{plural(state.comments.length, "comment")}</span>}
      </div>
      {!state ? (
        <p className="muted" style={{ margin: 0, fontSize: 14 }}>Opening the room…</p>
      ) : preview ? (
        <>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <Avatar profile={who ?? { id: preview.user_id, display_name: null, username: null }} size={28} />
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.45 }}>
              <strong>{displayName(who).split(" ")[0]}</strong> {preview.body.length > 140 ? `${preview.body.slice(0, 140)}…` : preview.body}
            </p>
          </div>
          {friendsHere.length > 0 && (
            <p style={{ margin: 0, fontSize: 13, color: "var(--cobalt-ink)" }}>
              {friendsHere.length === 1 ? `${displayName(state.people.get(friendsHere[0])).split(" ")[0]} talked about this chapter` : `${displayName(state.people.get(friendsHere[0])).split(" ")[0]} and ${plural(friendsHere.length - 1, "friend")} talked about this chapter`}
            </p>
          )}
        </>
      ) : (
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.45 }}>Nobody&rsquo;s said anything about this chapter yet. Be the first.</p>
      )}
      <Link href={roomHref(bookId, chapter)} className="btn btn--block" onClick={onOpen}>
        Open the {chapter === WHOLE_BOOK ? "whole-book" : `chapter ${chapter}`} room
      </Link>
    </section>
  );
}
