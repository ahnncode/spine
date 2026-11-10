"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useProfile } from "@/components/Auth";
import { askFriends, followCounts, type Entry } from "@/lib/data";
import { Cover } from "./Cover";

const MAX = 4;

/**
 * Ask a friend: pick 2 to 4 books from your want-to-read and let the people
 * who follow you vote on which to read next. Opens the poll's page once sent.
 */
export function AskSheet({ wants, finished, onClose }: { wants: Entry[]; finished?: string; onClose: () => void }) {
  const router = useRouter();
  const { profile } = useProfile();
  const [picked, setPicked] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [followers, setFollowers] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.id) followCounts(profile.id).then((c) => setFollowers(c.followers)).catch(() => setFollowers(null));
  }, [profile?.id]);

  function toggle(bookId: string) {
    setError(null);
    setPicked((p) => (p.includes(bookId) ? p.filter((x) => x !== bookId) : p.length >= MAX ? p : [...p, bookId]));
  }

  async function send() {
    setBusy(true);
    setError(null);
    try {
      const id = await askFriends(picked, note);
      router.push(`/picks/${id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn’t send that");
      setBusy(false);
    }
  }

  const list = [...wants].sort((a, b) => b.created_at.localeCompare(a.created_at));

  return (
    <div className="sheet-backdrop" onClick={() => !busy && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Ask friends to pick your next book" onClick={(e) => e.stopPropagation()}>
        <div className="sheet__grab" />
        {finished && <p className="eyebrow" style={{ color: "var(--amber-ink)" }}>Finished {finished}</p>}
        <h2 className="g" style={{ margin: "4px 0 0", fontSize: 28, lineHeight: 1.1, fontWeight: 400 }}>Can&rsquo;t decide what&rsquo;s next?</h2>
        {list.length < 2 ? (
          <>
            <p className="muted" style={{ margin: "8px 0 0", fontSize: 15, lineHeight: 1.45 }}>
              Save at least two books to want to read, then your friends can vote on which comes next.
            </p>
            <Link href="/add" className="btn btn--block" style={{ marginTop: 20 }}>Find books to save</Link>
            <button className="link-btn" style={{ minHeight: 44, width: "100%" }} onClick={onClose}>Not now</button>
          </>
        ) : (
          <>
            <p className="muted" style={{ margin: "8px 0 0", fontSize: 15, lineHeight: 1.45 }}>
              Pick two to four from your want-to-read and let your friends vote.
            </p>
            <div className="ask-grid" role="group" aria-label="Your want-to-read">
              {list.slice(0, 24).map((e) => {
                const on = picked.includes(e.book_id);
                return (
                  <button key={e.id} type="button" className="ask-book" aria-pressed={on} disabled={!on && picked.length >= MAX} onClick={() => toggle(e.book_id)}>
                    <span className="ask-book__cover">
                      <Cover book={e.book} width={88} />
                      {on && <span className="ask-book__check" aria-hidden="true">✓</span>}
                    </span>
                    <span className="ask-book__title">{e.book.title}</span>
                  </button>
                );
              })}
            </div>
            <label htmlFor="ask-note" className="muted" style={{ display: "block", margin: "16px 0 8px", fontSize: 13, fontWeight: 600 }}>
              A note for friends <span style={{ fontWeight: 400 }}>Optional</span>
            </label>
            <input id="ask-note" className="input" maxLength={140} value={note} placeholder="Something cozier after that one" onChange={(e) => setNote(e.target.value)} />
            {error && <p className="error" role="alert">{error}</p>}
            <button className="btn btn--block" style={{ marginTop: 18 }} disabled={busy || picked.length < 2} onClick={send}>
              {busy ? "Sending…" : picked.length < 2 ? `Pick ${2 - picked.length} more` : `Ask ${followers ? `${followers} friend${followers === 1 ? "" : "s"}` : "friends"} · ${picked.length} books`}
            </button>
            <p className="muted" style={{ textAlign: "center", fontSize: 12, margin: "8px 0 0" }}>
              {followers === 0 ? "Nobody follows you yet, so invite a friend first." : "Open for 48 hours, or until you start one."}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
