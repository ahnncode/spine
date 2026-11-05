"use client";

import { MentionText, useMentionPicker } from "@/components/Mentions";
import { timeAgo } from "@/lib/time";
import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  addComment, deleteComment, fetchComments, fetchHearts, fetchProfiles, fetchScoredEntry, myId, report,
  type Comment, type HeartState, type Profile, type ScoredEntry,
} from "@/lib/data";
import { COMMENT_MAX } from "@/lib/thoughts";
import { Avatar } from "./Avatar";
import { Name } from "@/components/Badge";
import { Cover } from "./Cover";
import { MoreIcon } from "./icons";
import { ScoreChip } from "./ScoreChip";
import { HeartButton, NoteText, TagList } from "./Social";

const ago = timeAgo;

/**
 * Someone's ranking of a book, with their thoughts, hearts and the comment
 * thread. Opens as a sheet from the feed, book pages and notifications.
 */
export function EntryThread({ entryId, onClose, onCountChange }: { entryId: string; onClose: () => void; onCountChange?: (n: number) => void }) {
  const [entry, setEntry] = useState<ScoredEntry | null | undefined>(undefined);
  const [comments, setComments] = useState<Comment[]>([]);
  const [people, setPeople] = useState<Map<string, Profile>>(new Map());
  const [hearts, setHearts] = useState<HeartState | undefined>(undefined);
  const [me, setMe] = useState<string>("");
  const [text, setText] = useState("");
  const mention = useMentionPicker<HTMLTextAreaElement>(text, setText);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [e, cs, uid, h] = await Promise.all([
      fetchScoredEntry(entryId), fetchComments(entryId), myId(), fetchHearts([{ type: "entry", id: entryId }]),
    ]);
    setEntry(e);
    setComments(cs);
    setMe(uid);
    setHearts(h.get(`entry:${entryId}`) ?? { count: 0, mine: false });
    setPeople(await fetchProfiles([...new Set([...(e ? [e.user_id] : []), ...cs.map((c) => c.user_id)])]));
    onCountChange?.(cs.length);
  }, [entryId, onCountChange]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loads from the network
    load().catch(() => setEntry(null));
  }, [load]);

  async function send(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await addComment(entryId, text);
      setText("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn’t post that");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setMenuFor(null);
    await deleteComment(id).catch(() => {});
    await load();
  }

  async function flag(id: string) {
    setMenuFor(null);
    await report("comment", id).catch(() => {});
    setNotice("Thanks — we’ll take a look.");
  }

  const owner = entry ? people.get(entry.user_id) : undefined;

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Comments" onClick={(e) => e.stopPropagation()}>
        <div className="sheet__grab" />
        {entry === undefined && <div aria-busy="true" style={{ minHeight: 160 }} />}
        {entry === null && <p className="muted">This post isn’t available.</p>}
        {entry && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Avatar profile={owner} size={36} link />
              <div style={{ flex: 1, minWidth: 0, fontSize: 14 }}>
                <strong><Name profile={owner} /></strong> ranked
              </div>
            </div>
            <Link href={`/book/${entry.book_id}`} style={{ display: "flex", gap: 14, marginTop: 12, textDecoration: "none", color: "inherit", alignItems: "center" }}>
              <Cover book={entry.book} width={52} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="book-row__title">{entry.book.title}</div>
                <div className="book-row__sub">#{entry.overall_rank} on their shelf</div>
              </div>
              <ScoreChip score={entry.score} bucket={entry.bucket} size={44} />
            </Link>
            {(entry.tags?.length > 0 || entry.note) && (
              <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                <TagList tags={entry.tags} />
                {entry.note && <NoteText note={entry.note} spoiler={entry.note_spoiler} mine={entry.user_id === me} />}
              </div>
            )}
            <div className="actions">
              {hearts && <HeartButton type="entry" id={entry.id} initial={hearts} />}
            </div>

            <h3 className="h2" style={{ marginTop: 18 }}>{comments.length ? `${comments.length} comment${comments.length === 1 ? "" : "s"}` : "No comments yet"}</h3>
            {notice && <p className="notice" role="status" style={{ marginTop: 8 }}>{notice}</p>}
            <div>
              {comments.map((c) => {
                const p = people.get(c.user_id);
                const canDelete = c.user_id === me || c.target_owner === me;
                return (
                  <div key={c.id} className="comment">
                    <Avatar profile={p} size={32} link />
                    <div className="comment__body">
                      <span><strong><Name profile={p} /></strong> <span className="muted" style={{ fontSize: 12 }}>{ago(c.created_at)}</span></span>
                      <p><MentionText text={c.body} /></p>
                    </div>
                    <div style={{ position: "relative" }}>
                      <button className="icon-btn" style={{ width: 36, height: 36, background: "transparent" }} aria-label="Comment options" aria-expanded={menuFor === c.id} onClick={() => setMenuFor(menuFor === c.id ? null : c.id)}>
                        <MoreIcon size={18} />
                      </button>
                      {menuFor === c.id && (
                        <div className="menu" role="menu">
                          {canDelete && <button role="menuitem" onClick={() => remove(c.id)}>Delete</button>}
                          {c.user_id !== me && <button role="menuitem" onClick={() => flag(c.id)}>Report</button>}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {mention.picker}
            <form onSubmit={send} style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "flex-end" }}>
              <label htmlFor={`c-${entryId}`} className="visually-hidden">Add a comment</label>
              <textarea
                id={`c-${entryId}`}
                className="textarea"
                style={{ minHeight: 44, height: 44, flex: 1 }}
                placeholder="Add a comment"
                maxLength={COMMENT_MAX}
                value={text}
                onChange={(e) => setText(e.target.value)}
                {...mention.fieldProps}
              />
              <button className="btn" style={{ minHeight: 44 }} disabled={busy || !text.trim()}>Post</button>
            </form>
            {error && <p className="error" role="alert">{error}</p>}
          </>
        )}
      </div>
    </div>
  );
}
