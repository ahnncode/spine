"use client";

import { ShareCardButton } from "@/components/ShareCard";
import { timeAgo } from "@/lib/time";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { RequireAuth, useProfile } from "@/components/Auth";
import { Avatar, displayName } from "@/components/Avatar";
import { Name } from "@/components/Badge";
import { CheckInSheet } from "@/components/CheckInSheet";
import { Cover } from "@/components/Cover";
import { BackIcon, MoreIcon } from "@/components/icons";
import { MentionText } from "@/components/Mentions";
import { PokeButton } from "@/components/PokeButton";
import { ReadAlongStart, rememberNextGroup } from "@/components/ReadAlongStart";
import { ScoreChip } from "@/components/ScoreChip";
import { TabBar } from "@/components/TabBar";
import {
  deleteReadAlongMessage, fetchFollowing, fetchProfiles, fetchReadAlong, fetchReadAlongMessages, fetchShelf, leaveReadAlong,
  postReadAlongMessage, readAlongProgress, respondReadAlong,
  type Entry, type Profile, type ReadAlong, type ReadAlongMessage, type ReadAlongProgress,
} from "@/lib/data";
import { formatScore, type Bucket } from "@/lib/ranking";
import { CardSkeleton } from "@/components/Skeleton";
import { deferred } from "@/lib/toast";

export function ReadAlongPage() {
  return (
    <RequireAuth>
      <Inner />
    </RequireAuth>
  );
}

const MESSAGE_MAX = 1000;
const REFRESH_MS = 20000;

const ago = timeAgo;

function bucketFor(score: number): Bucket {
  return score >= 6.7 ? "loved" : score >= 3.4 ? "fine" : "disliked";
}

/** How far along you'd be by today to finish on the target date (0–100). */
function paceFor(ra: ReadAlong): number | null {
  if (!ra.target_date) return null;
  const start = new Date(ra.created_at).getTime();
  const end = new Date(`${ra.target_date}T23:59:59`).getTime();
  if (end <= start) return 100;
  return Math.max(0, Math.min(100, Math.round(((Date.now() - start) / (end - start)) * 100)));
}

function daysLeftLabel(target: string): string {
  const days = Math.ceil((new Date(`${target}T23:59:59`).getTime() - Date.now()) / 86400000);
  return days > 1 ? `${days} days left` : days === 1 ? "1 day left" : "today’s the day";
}

interface Loaded {
  ra: ReadAlong;
  progress: ReadAlongProgress[];
  messages: ReadAlongMessage[];
  people: Map<string, Profile>;
  following: Set<string>;
  mine: Entry | null;
}

function Inner() {
  const { id } = useParams<{ id: string }>();
  const { profile: me } = useProfile();
  const router = useRouter();
  const [data, setData] = useState<Loaded | null | undefined>(undefined);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [menu, setMenu] = useState(false);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    const ra = await fetchReadAlong(id);
    if (!ra) return setData(null);
    const [progress, messages, following, shelf] = await Promise.all([
      readAlongProgress(id),
      fetchReadAlongMessages(id).catch(() => []),
      fetchFollowing(),
      fetchShelf(),
    ]);
    const ids = [...new Set([...ra.members.map((m) => m.user_id), ...messages.map((m) => m.user_id)])];
    const people = await fetchProfiles(ids);
    setData({ ra, progress, messages, people, following: new Set(following), mine: shelf.find((e) => e.book_id === ra.book_id) ?? null });
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load().catch(() => setData(null));
    const t = setInterval(() => {
      if (document.visibilityState === "visible") load().catch(() => {});
    }, REFRESH_MS);
    return () => clearInterval(t);
  }, [load]);

  const myRow = data?.progress.find((p) => p.user_id === me?.id);
  const myState = data?.ra.members.find((m) => m.user_id === me?.id)?.state;
  const myPct = myRow?.ranked ? 100 : myRow?.progress_pct ?? 0;
  const joined = useMemo(() => (data?.progress ?? []).filter((p) => p.state === "joined"), [data]);
  const invited = useMemo(() => (data?.progress ?? []).filter((p) => p.state === "invited"), [data]);
  const pace = data ? paceFor(data.ra) : null;
  const verdict = data?.ra.revealed_at ? [...joined].filter((p) => p.score != null).sort((a, b) => (b.score ?? 0) - (a.score ?? 0)) : [];

  async function send(e: FormEvent) {
    e.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const msg = await postReadAlongMessage(id, text);
      setData((d) => (d ? { ...d, messages: [...d.messages, msg] } : d));
      setText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn’t post that");
    } finally {
      setBusy(false);
    }
  }

  async function respond(join: boolean) {
    await respondReadAlong(id, join);
    if (join) await load();
    else router.replace("/feed");
  }

  async function leave() {
    setMenu(false);
    // Leave straight away; Undo (for 5 seconds) brings you back in.
    router.replace("/you");
    deferred("You left the read-along", {
      commit: () => leaveReadAlong(id).catch(() => {}),
      restore: () => router.push(`/together/${id}`),
    });
  }

  if (data === null) {
    return (
      <div className="app">
        <main className="screen">
          <div className="empty">
            <h1 className="h2">This read-along isn&rsquo;t available</h1>
            <p style={{ margin: "0 0 16px", fontSize: 14 }}>It may have been for a different group.</p>
            <Link href="/feed" className="btn">Back to your feed</Link>
          </div>
        </main>
        <TabBar />
      </div>
    );
  }

  return (
    <div className="app">
      <main className="screen">
        <div className="topbar">
          <button className="icon-btn" aria-label="Back" onClick={() => router.back()}><BackIcon size={20} /></button>
          {myState === "joined" && (
            <div style={{ position: "relative" }}>
              <button className="icon-btn" aria-label="Read-along options" aria-expanded={menu} onClick={() => setMenu(!menu)}><MoreIcon size={20} /></button>
              {menu && (
                <div className="menu" role="menu">
                  <button role="menuitem" onClick={leave}>Leave read-along</button>
                </div>
              )}
            </div>
          )}
        </div>

        {!data ? <CardSkeleton height={220} /> : (
          <>
            <Link href={`/book/${data.ra.book_id}`} className="ra-hero" style={{ textDecoration: "none", color: "inherit" }}>
              <Cover book={data.ra.book} width={84} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <p className="eyebrow">Reading together</p>
                <h1 className="h1" style={{ fontSize: 28, marginTop: 4 }}>{data.ra.book.title}</h1>
                <p className="muted" style={{ margin: "4px 0 0", fontSize: 14 }}>{data.ra.book.author}</p>
              </div>
            </Link>
            {data.ra.target_date && !data.ra.revealed_at && (
              <p className="m" style={{ fontSize: 12, margin: "12px 0 0", color: "var(--cobalt-ink)", fontWeight: 600 }}>
                Finish by {new Date(`${data.ra.target_date}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                {" · "}
                {daysLeftLabel(data.ra.target_date)}
              </p>
            )}

            {myState === "invited" && (
              <div className="card card--ink" style={{ marginTop: 20 }}>
                <p style={{ margin: 0, fontWeight: 600 }}>
                  {displayName(data.ra.created_by ? data.people.get(data.ra.created_by) : undefined)} invited you to read this together.
                </p>
                <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--on-panel-muted)" }}>
                  Joining puts it in your Reading now. Check in as you go; the discussion hides anything past where you are.
                </p>
                <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                  <button className="btn" style={{ flex: 1, background: "var(--on-panel)", color: "var(--black)" }} onClick={() => respond(true)}>Join</button>
                  <button className="btn btn--ghost" style={{ flex: 1, color: "var(--on-panel)" }} onClick={() => respond(false)}>Not now</button>
                </div>
              </div>
            )}

            {verdict.length >= 2 && (
              <section className="card verdict" style={{ marginTop: 20 }}>
                <p className="eyebrow" style={{ color: "var(--on-panel-muted)" }}>The verdict</p>
                {verdict.map((p, i) => (
                  <div key={p.user_id} className="verdict__row">
                    <span className="verdict__rank">{i + 1}</span>
                    <Avatar profile={data.people.get(p.user_id)} size={36} />
                    <span style={{ flex: 1, minWidth: 0, fontWeight: 600 }}><Name profile={data.people.get(p.user_id)} /></span>
                    <span className="verdict__chip"><ScoreChip score={p.score!} bucket={bucketFor(p.score!)} size={44} /></span>
                  </div>
                ))}
                <p style={{ margin: "10px 0 0", fontSize: 14, color: "var(--on-panel-2)", lineHeight: 1.45 }}>
                  {displayName(data.people.get(verdict[0].user_id)).split(" ")[0]} loved it most
                  {verdict[0].score! - verdict[verdict.length - 1].score! >= 2
                    ? `, ${displayName(data.people.get(verdict[verdict.length - 1].user_id)).split(" ")[0]} not so much`
                    : ". You mostly agree"}
                  . Group average {formatScore(verdict.reduce((s, p) => s + (p.score ?? 0), 0) / verdict.length)}.
                </p>
                <ShareCardButton
                  query={`kind=verdict&id=${data.ra.id}`}
                  label="Share the verdict"
                  filename="readread-verdict"
                  className="btn btn--block"
                  style={{ marginTop: 16, background: "var(--accent)", color: "var(--black)" }}
                />
                <Link
                  href="/search"
                  className="btn btn--block"
                  style={{ marginTop: 8, background: "var(--on-panel)", color: "var(--black)" }}
                  onClick={() => rememberNextGroup(data.ra.id, joined.map((p) => p.user_id).filter((u) => u !== me?.id))}
                >
                  Pick the next book together
                </Link>
              </section>
            )}

            <section className="card" style={{ marginTop: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <h2 className="h2">Progress</h2>
                {pace != null && !data.ra.revealed_at && (
                  <span className="m" style={{ fontSize: 12, color: "var(--cobalt-ink)", display: "inline-flex", alignItems: "center", gap: 5 }}>
                    <i className="ra-legend" aria-hidden="true" /> on pace · {pace}%
                  </span>
                )}
              </div>
              {[...joined, ...invited].map((p) => {
                const person = data.people.get(p.user_id);
                const pct = p.ranked ? 100 : p.progress_pct ?? 0;
                const isMe = p.user_id === me?.id;
                return (
                  <div key={p.user_id} className="ra-member" style={{ opacity: p.state === "invited" ? 0.55 : 1 }}>
                    <Avatar profile={person} size={36} link={!isMe} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 14 }}>
                        <span style={{ fontWeight: 600, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {isMe ? "You" : <Name profile={person} />}
                        </span>
                        <span className="m muted" style={{ fontSize: 12, flexShrink: 0 }}>
                          {p.state === "invited" ? "invited" : p.ranked ? (p.score != null ? `finished · ${formatScore(p.score)}` : "finished ✓") : p.shelf_status === "paused" ? `put it aside${p.progress_pct != null ? ` at ${pct}%` : ""}` : p.shelf_status === "dropped" ? `didn’t finish${p.progress_pct != null ? ` · ${pct}%` : ""}` : p.progress_pct != null ? `${pct}%` : "not started"}
                        </span>
                      </div>
                      {p.state === "joined" && (
                        <div className="ra-bar" aria-hidden="true">
                          <span data-done={p.ranked} style={{ width: `${Math.max(pct, 2)}%` }} />
                          {pace != null && !data.ra.revealed_at && <i className="ra-bar__pace" style={{ left: `${pace}%` }} />}
                        </div>
                      )}
                    </div>
                    {!isMe && p.state === "joined" && !p.ranked && data.following.has(p.user_id) && (
                      <PokeButton userId={p.user_id} name={displayName(person)} />
                    )}
                  </div>
                );
              })}
              {myState === "joined" && (
                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  {!myRow?.ranked && data.mine && (
                    <button className="btn ra-action" onClick={() => setChecking(true)}>Check in</button>
                  )}
                  {!myRow?.ranked && (
                    <Link href={`/rank/${data.ra.book_id}`} className="btn btn--quiet ra-action">Rank it</Link>
                  )}
                  {joined.length + invited.length < 8 && !data.ra.revealed_at && (
                    <button className="btn btn--quiet ra-action" onClick={() => setInviting(true)}>Invite</button>
                  )}
                </div>
              )}
              {myState === "joined" && !data.ra.revealed_at && joined.length >= 2 && (
                <p className="muted" style={{ fontSize: 12, margin: "10px 0 0" }}>Scores stay hidden until everyone&rsquo;s ranked it. Then the verdict shows up here.</p>
              )}
            </section>

            {myState === "joined" && (
              <section style={{ marginTop: 20 }}>
                <h2 className="h2">Discussion</h2>
                <p className="muted" style={{ fontSize: 12, margin: "2px 0 0" }}>
                  Each message shows how far its writer was. Anything past {myPct}% stays hidden until you catch up.
                </p>
                {data.messages.length === 0 && (
                  <p className="muted" style={{ fontSize: 14, marginTop: 16 }}>No messages yet. Say how it&rsquo;s going.</p>
                )}
                <div style={{ marginTop: 8 }}>
                  {data.messages.map((m) => {
                    const person = data.people.get(m.user_id);
                    const mineMsg = m.user_id === me?.id;
                    const hidden = !mineMsg && !myRow?.ranked && m.progress_pct > myPct && !revealed.has(m.id);
                    return (
                      <div key={m.id} className="ra-msg">
                        <Avatar profile={person} size={32} />
                        <div className="ra-msg__body">
                          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", fontSize: 13 }}>
                            <strong>{mineMsg ? "You" : <Name profile={person} />}</strong>
                            <span className="ra-at">at {m.progress_pct}%</span>
                            <span className="muted">{ago(m.created_at)}</span>
                            {mineMsg && (
                              <button className="link-btn" style={{ marginLeft: "auto", fontSize: 12, color: "var(--muted)" }}
                                onClick={() => {
                                  const gone = m;
                                  setData((d) => d && { ...d, messages: d.messages.filter((x) => x.id !== gone.id) });
                                  deferred("Message deleted", {
                                    commit: () => deleteReadAlongMessage(gone.id).catch(() => {}),
                                    restore: () => setData((d) => d && { ...d, messages: [...d.messages, gone].sort((a, b) => a.created_at.localeCompare(b.created_at)) }),
                                  });
                                }}>
                                Delete
                              </button>
                            )}
                          </div>
                          {hidden ? (
                            <div className="ra-hidden">
                              Written at {m.progress_pct}%. You&rsquo;re at {myPct}%.{" "}
                              <button className="link-btn" style={{ fontSize: 13 }} onClick={() => setRevealed((r) => new Set(r).add(m.id))}>Show anyway</button>
                            </div>
                          ) : (
                            <p><MentionText text={m.body} /></p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <form onSubmit={send} style={{ marginTop: 12 }}>
                  <label htmlFor="ra-msg" className="visually-hidden">Message the group</label>
                  <textarea
                    id="ra-msg"
                    className="textarea"
                    placeholder={myRow?.ranked ? "Say what you thought" : `How’s it going? (posting at ${myPct}%)`}
                    maxLength={MESSAGE_MAX}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    style={{ minHeight: 64 }}
                  />
                  {error && <p className="error" role="alert">{error}</p>}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8, gap: 10 }}>
                    <span className="muted" style={{ fontSize: 12 }}>
                      {myRow?.ranked ? "You’ve finished, so everyone further along can read this." : "Check in first to post from further along."}
                    </span>
                    <button className="btn" style={{ minHeight: 44 }} disabled={busy || !text.trim()}>Post</button>
                  </div>
                </form>
              </section>
            )}
          </>
        )}
      </main>
      {checking && data?.mine && (
        <CheckInSheet entry={data.mine} onClose={() => setChecking(false)} onDone={async () => { setChecking(false); await load(); }} />
      )}
      {inviting && data && (
        <ReadAlongStart
          book={data.ra.book}
          readAlongId={data.ra.id}
          already={data.ra.members.filter((m) => m.state === "joined" || m.state === "invited").map((m) => m.user_id)}
          onClose={() => { setInviting(false); load().catch(() => {}); }}
        />
      )}
      <TabBar />
    </div>
  );
}
