"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { RequireAuth } from "@/components/Auth";
import { Avatar, displayName } from "@/components/Avatar";
import { CheckInSheet } from "@/components/CheckInSheet";
import { ClubPick } from "@/components/ClubPick";
import { ClubScreen, ClubTile, shortDate, today, useClub } from "@/components/ClubBits";
import { Cover } from "@/components/Cover";
import { LockIcon } from "@/components/icons";
import { CardSkeleton } from "@/components/Skeleton";
import { useShelf } from "@/components/useShelf";
import {
  CLUB_COLORS, WHOLE_BOOK, currentWeek, deleteClub, expectedChapter, fetchPace, fetchRoomCounts, joinClub, leaveClub,
  removeClubMember, setClubRole, setReadBefore, updateClub, weekOpen, weekRange, type ClubColor, type PaceRow,
} from "@/lib/clubs";
import { fetchFollowing, startReading } from "@/lib/data";

export function ClubPage() {
  return (
    <RequireAuth>
      <Inner />
    </RequireAuth>
  );
}

function Inner() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data, reload, me } = useClub(id);
  const { entries, reload: reloadShelf } = useShelf();
  const [pace, setPace] = useState<PaceRow[] | null>(null);
  const [counts, setCounts] = useState<Map<number, number>>(new Map());
  const [friends, setFriends] = useState<Set<string>>(new Set());
  const [sheet, setSheet] = useState<"pick" | "plan" | "edit" | "members" | "checkin" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");

  const current = data?.current ?? null;
  const book = current ? data?.books.get(current.book_id) : undefined;
  const isHost = data?.role === "host" || data?.role === "cohost";
  const entry = useMemo(() => (book ? entries?.find((e) => e.book_id === book.id) ?? null : null), [entries, book]);

  useEffect(() => {
    fetchFollowing().then((f) => setFriends(new Set(f))).catch(() => {});
  }, []);
  useEffect(() => {
    if (!current || !data?.role) return;
    Promise.all([fetchPace(current.id), fetchRoomCounts(current.id)])
      .then(([p, c]) => {
        setPace(p);
        setCounts(c);
      })
      .catch(() => {});
  }, [current, data?.role, entry?.progress_chapter, entry?.progress_pct, entry?.status]);
  useEffect(() => {
    if (data?.role && isHost && !current && new URLSearchParams(window.location.search).get("pick") === "1") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- opened once from the new-club redirect
      setSheet("pick");
    }
  }, [data?.role, isHost, current]);

  if (data === undefined) return <ClubScreen title=" " back="/clubs"><CardSkeleton height={320} /></ClubScreen>;
  if (data === null) {
    return (
      <ClubScreen title="Club not found" back="/clubs">
        <div className="empty" style={{ marginTop: 24 }}>
          <p style={{ margin: 0 }}>This club may have closed.</p>
          <Link href="/clubs" className="btn" style={{ marginTop: 12 }}>See clubs</Link>
        </div>
      </ClubScreen>
    );
  }

  const { card, members, people, role } = data;
  const color = CLUB_COLORS[card.color] ?? CLUB_COLORS.ember;
  const friendMembers = members.filter((m) => friends.has(m.user_id));
  const host = members.find((m) => m.role === "host");
  const day = today();

  async function join(e?: FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await joinClub(id, card.has_password ? password : undefined);
      if (r === "wrong_password") setError("That password isn’t right.");
      else if (r === "locked") setError("Too many tries. Wait 15 minutes and try again.");
      else await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn’t join");
    } finally {
      setBusy(false);
    }
  }

  // ---------------------------------------------------------------- not a member: the preview
  if (!role) {
    return (
      <ClubScreen eyebrow={`${card.members} member${card.members === 1 ? "" : "s"}${host ? ` · hosted by ${displayName(people.get(host.user_id)).split(" ")[0]}` : ""}`} title={card.name} back="/clubs">
        <div style={{ display: "flex", gap: 14, alignItems: "center", marginTop: 16 }}>
          <ClubTile name={card.name} color={card.color} size={64} />
          {card.description && <p style={{ margin: 0, fontSize: 15, lineHeight: 1.45, color: "var(--ink-2)" }}>{card.description}</p>}
        </div>
        {book && current && (
          <div className="card" style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 16 }}>
            <Cover book={book} width={44} />
            <div style={{ minWidth: 0 }}>
              <span className="eyebrow">Reading now</span>
              <strong style={{ display: "block", fontSize: 15 }}>{book.title}</strong>
              <span className="muted" style={{ fontSize: 13 }}>Week {currentWeek(current.plan, day)} of {current.plan.length || 1} · finishes {shortDate(current.ends_on)}</span>
            </div>
          </div>
        )}
        {friendMembers.length > 0 && (
          <p style={{ margin: "14px 0 0", display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: "var(--cobalt-ink)" }}>
            <Avatar profile={people.get(friendMembers[0].user_id)} size={28} />
            {friendMembers.slice(0, 2).map((m) => displayName(people.get(m.user_id)).split(" ")[0]).join(" and ")}{friendMembers.length > 2 ? ` and ${friendMembers.length - 2} more` : ""} {friendMembers.length === 1 ? "is a member" : "are members"}
          </p>
        )}
        {card.has_password ? (
          <form className="card stack" style={{ marginTop: 16, gap: 8 }} onSubmit={join}>
            <label htmlFor="club-pass" style={{ fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}><LockIcon size={14} /> This club needs a password</label>
            <input id="club-pass" className="input" type="password" autoComplete="off" value={password} onChange={(e) => setPassword(e.target.value)} />
            <span className="muted" style={{ fontSize: 12 }}>Ask the host, or a member, for it.</span>
            {error && <p className="error" role="alert" style={{ margin: 0 }}>{error}</p>}
            <button className="btn btn--block" disabled={busy || !password}>{busy ? "Joining…" : "Join the club"}</button>
          </form>
        ) : (
          <>
            {error && <p className="error" role="alert">{error}</p>}
            <button className="btn btn--block" style={{ marginTop: 16 }} disabled={busy} onClick={() => join()}>{busy ? "Joining…" : "Join the club"}</button>
          </>
        )}
      </ClubScreen>
    );
  }

  // ---------------------------------------------------------------- member: club home
  const myPace = pace?.find((p) => p.user_id === me?.id);
  const readBefore = Boolean(myPace?.read_before);
  const reached = myPace?.reached ?? null;
  const week = current ? currentWeek(current.plan, day) : 1;
  const expected = current ? expectedChapter(current.plan, current.starts_on, day) : 0;
  const onTrack = pace ? pace.filter((p) => p.read_before || (p.reached ?? 0) >= 999 || (p.reached ?? 0) >= expected).length : 0;
  const ahead = pace?.filter((p) => !p.read_before && (p.reached ?? 0) < 999).sort((a, b) => (b.reached ?? 0) - (a.reached ?? 0))[0];
  const before = pace?.filter((p) => p.read_before).length ?? 0;
  const status = readBefore ? "You’ve read it before, so every room is open"
    : (reached ?? 0) >= 999 ? "You’ve finished"
    : reached == null ? "Not started yet"
    : reached >= expected ? `You’re at chapter ${reached} · on track`
    : `You’re at chapter ${reached} · ${expected - reached} behind`;
  const statusColor = readBefore || (reached ?? 0) >= expected ? "#2D6A3E" : "#C2410C";

  async function toggleBefore() {
    if (!current) return;
    await setReadBefore(current.id, !readBefore).catch(() => {});
    setPace(await fetchPace(current.id).catch(() => pace));
  }

  async function startIt() {
    if (!book) return;
    await startReading(book.id).catch(() => {});
    await reloadShelf();
    setSheet("checkin");
  }

  return (
    <ClubScreen
      eyebrow={`${card.members} member${card.members === 1 ? "" : "s"} · ${data.reads.filter((r) => r.finished_at).length} read together`}
      title={card.name}
      back="/clubs"
      action={<button className="icon-btn" aria-label="Club settings and members" onClick={() => setSheet("members")}>⋯</button>}
    >
      <div style={{ ["--club" as string]: color.bg }}>
        {current && book ? (
          <section className="card" aria-label="Reading now" style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 14 }}>
            <Link href={`/book/${book.id}`} style={{ display: "flex", gap: 14, color: "inherit", textDecoration: "none" }}>
              <Cover book={book} width={64} />
              <span style={{ minWidth: 0 }}>
                <span className="eyebrow" style={{ color: color.bg }}>Reading now</span>
                <span className="g" style={{ display: "block", fontSize: 22, lineHeight: 1.15, marginTop: 2 }}>{book.title}</span>
                <span className="muted" style={{ display: "block", fontSize: 13, marginTop: 2 }}>{book.author} · finishes {shortDate(current.ends_on)}</span>
              </span>
            </Link>
            {current.plan.length > 0 && (
              <div className="stack" style={{ gap: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, gap: 8 }}>
                  <strong>Week {week}: {weekRange(current.plan, week).toLowerCase().replace(/^c/, "c")}</strong>
                  <span className="muted">by {shortDate(current.plan[week - 1].due)}</span>
                </div>
                <div className="club-weeks" aria-label={`Week ${week} of ${current.plan.length}`}>
                  {current.plan.map((_, i) => <span key={i} className={i + 1 < week ? "done" : i + 1 === week ? "now" : undefined} />)}
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, color: statusColor }}>{status}</span>
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {readBefore ? (
                <Link href={`/clubs/${id}/week/${week}`} className="btn" style={{ gridColumn: "1 / -1" }}>Week {week} room</Link>
              ) : entry && entry.status !== "want" ? (
                <button className="btn" onClick={() => setSheet("checkin")}>Check in</button>
              ) : (
                <button className="btn" onClick={startIt}>Start reading</button>
              )}
              {!readBefore && (() => {
                const open = [...current.plan.keys()].map((i) => i + 1).filter((w) => weekOpen(current.plan, w, reached, false));
                const latest = open.at(-1);
                return latest ? (
                  <Link href={`/clubs/${id}/week/${latest}`} className="btn btn--outline">Week {latest} room</Link>
                ) : (
                  <span className="btn btn--outline" aria-disabled="true" style={{ opacity: 0.6 }}><LockIcon size={14} /> Week 1 room</span>
                );
              })()}
            </div>
            <button type="button" className="link-btn" style={{ minHeight: 36, alignSelf: "flex-start", fontSize: 13 }} onClick={toggleBefore}>
              {readBefore ? "Actually, I’m reading it now" : "Read it before? Skip ahead to the discussion"}
            </button>
          </section>
        ) : (
          <section className="card" style={{ marginTop: 16 }}>
            <p className="h2" style={{ margin: 0 }}>{isHost ? "Pick the club’s first book" : "Between books"}</p>
            <p className="muted" style={{ margin: "6px 0 0", fontSize: 14 }}>{isHost ? "Choose from the list or any book, set the dates, and the weekly plan fills itself in." : "The host is picking what’s next."}</p>
            {isHost && <button className="btn btn--block" style={{ marginTop: 12 }} onClick={() => setSheet("pick")}>Pick a book</button>}
          </section>
        )}

        {current && (
          <>
            <Link href={`/clubs/${id}/pace`} className="club-row" style={{ marginTop: 12 }}>
              <span className="avatar-stack" aria-hidden="true">
                {members.slice(0, 4).map((m) => <Avatar key={m.user_id} profile={people.get(m.user_id)} size={30} ring={false} />)}
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <strong style={{ display: "block", fontSize: 15 }}>{pace ? `${onTrack} of ${pace.length} on track` : "Where everyone is"}</strong>
                <span className="muted" style={{ fontSize: 13 }}>
                  {[ahead && (ahead.reached ?? 0) > 0 ? `${ahead.user_id === me?.id ? "You’re" : `${displayName(people.get(ahead.user_id)).split(" ")[0]}’s`} ahead at chapter ${ahead.reached}` : null, before ? `${before} read it before` : null].filter(Boolean).join(" · ") || "See the pace board"}
                </span>
              </span>
              <span aria-hidden="true" className="muted">›</span>
            </Link>

            {current.plan.length > 0 && (
              <section aria-label="Week rooms" style={{ marginTop: 20 }}>
                <h2 className="eyebrow">Week rooms</h2>
                <ul className="rooms__list">
                  {[...current.plan.map((_, i) => i + 1), WHOLE_BOOK].map((w) => {
                    const open = weekOpen(current.plan, w, reached, readBefore);
                    const n = counts.get(w) ?? 0;
                    const label = w === WHOLE_BOOK ? "Whole book" : `Week ${w}`;
                    return (
                      <li key={w}>
                        {open ? (
                          <Link href={`/clubs/${id}/week/${w}`} className="rooms__row">
                            <span className="rooms__label"><strong>{label}</strong> <span className="muted">· {weekRange(current.plan, w)}</span></span>
                            <span className="muted" style={{ fontSize: 13 }}>{n ? `${n} comment${n === 1 ? "" : "s"}` : "No comments yet"}</span>
                          </Link>
                        ) : (
                          <span className="rooms__row rooms__locked">
                            <LockIcon size={14} />
                            <span className="rooms__label">{label} <span className="muted">· {w === WHOLE_BOOK ? "opens when you finish" : `opens at chapter ${current.plan[w - 1].through}`}</span></span>
                            {n > 0 && <span className="muted" style={{ fontSize: 13 }}>{n} waiting</span>}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}
          </>
        )}

        <div className="club-tiles">
          <Link href={`/clubs/${id}/list`}>
            <span className="eyebrow">{card.list_id ? "The list" : "Read together"}</span>
            <span className="d" style={{ fontWeight: 700, fontSize: 22 }}>{data.reads.filter((r) => r.finished_at).length} read</span>
            <span className="muted" style={{ fontSize: 12 }}>{card.list_id ? "See the whole list" : "Every book so far"}</span>
          </Link>
          <Link href={`/clubs/${id}/shelf`}>
            <span className="eyebrow">Club shelf</span>
            <span className="d" style={{ fontWeight: 700, fontSize: 22 }}>Verdicts</span>
            <span className="muted" style={{ fontSize: 12 }}>The club&rsquo;s ranking</span>
          </Link>
        </div>
        {isHost && current && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 16 }}>
            <button className="small-btn small-btn--outline" onClick={() => setSheet("plan")}>Edit the plan and questions</button>
            <button className="small-btn small-btn--outline" onClick={() => setSheet("pick")}>Pick the next book</button>
          </div>
        )}
      </div>

      {sheet === "checkin" && entry && (
        <CheckInSheet entry={entry} onClose={() => setSheet(null)} onDone={async () => { await reloadShelf(); setSheet(null); }} />
      )}
      {(sheet === "pick" || sheet === "plan") && (
        <ClubPick
          clubId={id}
          listId={card.list_id}
          readPositions={data.reads.filter((r) => r.finished_at && r.list_position != null).map((r) => r.list_position!)}
          editing={sheet === "plan" && current && book ? { read: current, book } : null}
          onClose={() => setSheet(null)}
          onDone={async () => {
            setSheet(null);
            router.replace(`/clubs/${id}`);
            await reload();
          }}
        />
      )}
      {sheet === "members" && (
        <MembersSheet clubId={id} data={data} meId={me?.id ?? ""} onClose={() => setSheet(null)} onChange={reload} onEdit={() => setSheet("edit")} onGone={() => router.replace("/clubs")} />
      )}
      {sheet === "edit" && <EditClubSheet clubId={id} data={data} onClose={() => setSheet(null)} onDone={async () => { setSheet(null); await reload(); }} />}
    </ClubScreen>
  );
}

/** Members, roles and leaving; hosts can make co-hosts and remove people. */
function MembersSheet({ clubId, data, meId, onClose, onChange, onEdit, onGone }: {
  clubId: string; data: NonNullable<ReturnType<typeof useClub>["data"]>; meId: string;
  onClose: () => void; onChange: () => Promise<void>; onEdit: () => void; onGone: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<"leave" | "delete" | null>(null);
  const role = data.role;
  const roleLabel = { host: "Host", cohost: "Co-host", member: "" } as const;

  async function act(key: string, fn: () => Promise<void>) {
    setBusy(key);
    try {
      await fn();
      await onChange();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="sheet-backdrop" onClick={() => !busy && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Members" onClick={(e) => e.stopPropagation()}>
        <div className="sheet__grab" />
        <h2 className="g" style={{ margin: 0, fontSize: 26, fontWeight: 400 }}>Members · {data.members.length}</h2>
        <ul style={{ listStyle: "none", margin: "12px 0 0", padding: 0 }}>
          {data.members.map((m) => (
            <li key={m.user_id} className="book-row" style={{ borderBottom: "1px solid var(--line)" }}>
              <Avatar profile={data.people.get(m.user_id)} size={36} link />
              <span className="book-row__body">
                <span className="book-row__title" style={{ display: "block" }}>{m.user_id === meId ? "You" : displayName(data.people.get(m.user_id))}</span>
                {roleLabel[m.role] && <span className="book-row__sub" style={{ display: "block" }}>{roleLabel[m.role]}</span>}
              </span>
              {role === "host" && m.role !== "host" && (
                <button className="small-btn small-btn--outline" disabled={busy !== null} onClick={() => act(`r${m.user_id}`, () => setClubRole(clubId, m.user_id, m.role === "cohost" ? "member" : "cohost"))}>
                  {m.role === "cohost" ? "Make member" : "Make co-host"}
                </button>
              )}
              {(role === "host" || (role === "cohost" && m.role === "member")) && m.user_id !== meId && m.role !== "host" && (
                <button className="link-btn" style={{ minHeight: 36, fontSize: 13 }} disabled={busy !== null} onClick={() => act(`x${m.user_id}`, () => removeClubMember(clubId, m.user_id))}>Remove</button>
              )}
            </li>
          ))}
        </ul>
        <div className="stack" style={{ marginTop: 16 }}>
          {(role === "host" || role === "cohost") && <button className="btn btn--outline btn--block" onClick={onEdit}>Edit the club</button>}
          {confirm === "leave" ? (
            <button className="btn btn--block" disabled={busy !== null} onClick={async () => { setBusy("leave"); await leaveClub(clubId).catch(() => {}); onGone(); }}>
              {role === "host" ? (data.members.length > 1 ? "Leave and hand the club on" : "Leave and close the club") : "Yes, leave the club"}
            </button>
          ) : (
            <button className="link-btn" style={{ minHeight: 44 }} onClick={() => setConfirm("leave")}>Leave the club</button>
          )}
          {role === "host" && (confirm === "delete" ? (
            <button className="btn btn--block" style={{ background: "#B42318" }} disabled={busy !== null} onClick={async () => { setBusy("delete"); await deleteClub(clubId).catch(() => {}); onGone(); }}>Delete the club for everyone</button>
          ) : (
            <button className="link-btn" style={{ minHeight: 44, color: "#B42318" }} onClick={() => setConfirm("delete")}>Delete the club</button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Host edits the name, description, colour and password. */
function EditClubSheet({ clubId, data, onClose, onDone }: { clubId: string; data: NonNullable<ReturnType<typeof useClub>["data"]>; onClose: () => void; onDone: () => Promise<void> }) {
  const [name, setName] = useState(data.card.name);
  const [about, setAbout] = useState(data.card.description ?? "");
  const [color, setColor] = useState<ClubColor>(data.card.color);
  const [locked, setLocked] = useState(data.card.has_password);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (locked && !data.card.has_password && password.length < 4) return setError("Use a password of at least 4 characters");
    setBusy(true);
    try {
      await updateClub(clubId, { name, description: about, color, password: locked ? password || null : null, clearPassword: !locked && data.card.has_password });
      await onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn’t save that");
      setBusy(false);
    }
  }

  return (
    <div className="sheet-backdrop" onClick={() => !busy && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Edit the club" onClick={(e) => e.stopPropagation()}>
        <div className="sheet__grab" />
        <h2 className="g" style={{ margin: 0, fontSize: 26, fontWeight: 400 }}>Edit the club</h2>
        <div className="stack" style={{ marginTop: 14, gap: 14 }}>
          <div><label htmlFor="e-name" className="field-label">Name</label><input id="e-name" className="input" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><label htmlFor="e-about" className="field-label">What it&rsquo;s about</label><textarea id="e-about" className="textarea" maxLength={500} value={about} onChange={(e) => setAbout(e.target.value)} /></div>
          <fieldset className="plain-fieldset">
            <legend className="field-label">Colour</legend>
            <div className="tag-list">
              {(Object.keys(CLUB_COLORS) as ClubColor[]).map((c) => (
                <button key={c} type="button" className="swatch" aria-pressed={color === c} aria-label={c} onClick={() => setColor(c)} style={{ background: CLUB_COLORS[c].bg }} />
              ))}
            </div>
          </fieldset>
          <fieldset className="plain-fieldset">
            <legend className="field-label">Who can join</legend>
            <div className="seg" role="radiogroup" aria-label="Who can join">
              <button type="button" role="radio" aria-checked={!locked} onClick={() => setLocked(false)}>Anyone</button>
              <button type="button" role="radio" aria-checked={locked} onClick={() => setLocked(true)}>With a password</button>
            </div>
            {locked && (
              <div style={{ marginTop: 10 }}>
                <label htmlFor="e-pass" className="field-label">{data.card.has_password ? "New password (leave blank to keep it)" : "Password"}</label>
                <input id="e-pass" className="input" type="text" autoComplete="off" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
            )}
          </fieldset>
          {error && <p className="error" role="alert">{error}</p>}
          <button className="btn btn--block" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save"}</button>
        </div>
      </div>
    </div>
  );
}
