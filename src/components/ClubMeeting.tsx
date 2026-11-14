"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Avatar, displayName } from "@/components/Avatar";
import type { Profile } from "@/lib/data";
import {
  fetchMeeting, fetchReveal, meetingCountdown, meetingWhen, openReveal, rsvp, setMeeting,
  type ClubMeeting, type ClubRsvp, type RevealRow, type RsvpAnswer,
} from "@/lib/clubs";

const ANSWERS: Array<{ value: RsvpAnswer; label: string }> = [
  { value: "going", label: "Going" },
  { value: "maybe", label: "Maybe" },
  { value: "no", label: "Can’t make it" },
];

/**
 * The club's next meeting: when and where, a countdown, and who's coming.
 * Hosts set, move or cancel it; everyone answers going, maybe or can't.
 */
export function MeetingSection({ readId, isHost, meId, people, memberCount, onChange }: {
  readId: string;
  isHost: boolean;
  meId: string;
  people: Map<string, Profile>;
  memberCount: number;
  onChange?: () => void;
}) {
  const [meeting, setMeetingState] = useState<ClubMeeting | null | undefined>(undefined);
  const [rsvps, setRsvps] = useState<ClubRsvp[]>([]);
  const [sheet, setSheet] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetchMeeting(readId);
      setMeetingState(r.meeting);
      setRsvps(r.rsvps);
    } catch {
      setMeetingState(null);
    }
  }, [readId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load once per read
    load();
  }, [load]);

  if (meeting === undefined) return null;

  const mine = rsvps.find((r) => r.user_id === meId)?.answer ?? null;
  const going = rsvps.filter((r) => r.answer === "going");
  const maybe = rsvps.filter((r) => r.answer === "maybe").length;
  const countdown = meeting ? meetingCountdown(meeting.starts_at) : null;

  async function answer(a: RsvpAnswer) {
    setBusy(true);
    setError(null);
    const next = mine === a ? null : a;
    // Flip straight away; put it back if the save fails.
    const before = rsvps;
    setRsvps([...rsvps.filter((r) => r.user_id !== meId), ...(next ? [{ user_id: meId, answer: next }] : [])]);
    try {
      await rsvp(readId, next);
    } catch {
      setRsvps(before);
      setError("Couldn’t save that. Try again.");
    }
    setBusy(false);
  }

  if (!meeting) {
    return isHost ? (
      <section aria-label="Meeting" style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--line)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 14, color: "var(--ink-2)" }}>Meeting up to talk about it? Set a time and everyone can say if they&rsquo;re coming.</span>
          <button className="small-btn small-btn--outline" onClick={() => setSheet(true)}>Set a meeting</button>
        </div>
        {sheet && <MeetingSheet readId={readId} meeting={null} onClose={() => setSheet(false)} onDone={async () => { setSheet(false); await load(); onChange?.(); }} />}
      </section>
    ) : null;
  }

  return (
    <section aria-label="Meeting" style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--line)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
        <h2 className="g" style={{ margin: 0, fontWeight: 400, fontSize: 20 }}>
          {countdown === "now" ? "Meeting now" : `Meeting${countdown ? ` ${countdown}` : ""}`}
        </h2>
        {isHost && <button className="link-btn" style={{ minHeight: 36, fontSize: 13 }} onClick={() => setSheet(true)}>Change</button>}
      </div>
      <p style={{ margin: "4px 0 0", fontSize: 15, fontWeight: 600 }}>{meetingWhen(meeting.starts_at)}</p>
      {meeting.place && <p style={{ margin: "2px 0 0", fontSize: 14, color: "var(--ink-2)" }}>{meeting.place}</p>}
      {meeting.link && (
        <a href={meeting.link} target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", marginTop: 4, fontSize: 14, fontWeight: 600, color: "var(--club-text, var(--ink))" }}>
          Join the call
        </a>
      )}
      {meeting.note && <p style={{ margin: "6px 0 0", fontSize: 14, lineHeight: 1.45 }}>{meeting.note}</p>}

      <div className="seg" role="radiogroup" aria-label="Are you coming?" style={{ marginTop: 12 }}>
        {ANSWERS.map((a) => (
          <button key={a.value} type="button" role="radio" aria-checked={mine === a.value} disabled={busy} onClick={() => answer(a.value)}>{a.label}</button>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, fontSize: 13, color: "var(--ink-2)" }}>
        {going.length > 0 && (
          <span className="avatar-stack" aria-hidden="true">
            {going.slice(0, 5).map((r) => <Avatar key={r.user_id} profile={people.get(r.user_id)} size={26} ring={false} />)}
          </span>
        )}
        <span>
          {going.length === 0 ? "No one has said yes yet" : going.length === 1 ? `${going[0].user_id === meId ? "You’re" : `${displayName(people.get(going[0].user_id)).split(" ")[0]} is`} going` : `${going.length} of ${memberCount} going`}
          {maybe ? ` · ${maybe} maybe` : ""}
        </span>
      </div>
      {error && <p className="error" role="alert" style={{ margin: "8px 0 0" }}>{error}</p>}
      {sheet && <MeetingSheet readId={readId} meeting={meeting} onClose={() => setSheet(false)} onDone={async () => { setSheet(false); await load(); onChange?.(); }} />}
    </section>
  );
}

/** Local "YYYY-MM-DDTHH:MM" for a datetime-local input. */
function toLocalInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function MeetingSheet({ readId, meeting, onClose, onDone }: { readId: string; meeting: ClubMeeting | null; onClose: () => void; onDone: () => Promise<void> }) {
  // A week from now at 7pm, unless there's a meeting already.
  const [when, setWhen] = useState(() => {
    if (meeting) return toLocalInput(new Date(meeting.starts_at));
    const d = new Date();
    d.setDate(d.getDate() + 7);
    d.setHours(19, 0, 0, 0);
    return toLocalInput(d);
  });
  const [place, setPlace] = useState(meeting?.place ?? "");
  const [link, setLink] = useState(meeting?.link ?? "");
  const [note, setNote] = useState(meeting?.note ?? "");
  const [busy, setBusy] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const startsAt = new Date(when);
    if (Number.isNaN(startsAt.getTime())) return setError("Pick a day and time");
    if (link.trim() && !/^https:\/\//i.test(link.trim())) return setError("Use a link that starts with https://");
    setBusy(true);
    setError(null);
    try {
      await setMeeting(readId, { startsAt, place, link, note });
      await onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn’t save the meeting");
      setBusy(false);
    }
  }

  async function cancel() {
    setBusy(true);
    try {
      await setMeeting(readId, null);
      await onDone();
    } catch {
      setError("Couldn’t cancel it. Try again.");
      setBusy(false);
    }
  }

  return (
    <div className="sheet-backdrop" onClick={() => !busy && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Meeting" onClick={(e) => e.stopPropagation()}>
        <div className="sheet__grab" />
        <h2 className="g" style={{ margin: 0, fontSize: 24, fontWeight: 400 }}>{meeting ? "Change the meeting" : "Set a meeting"}</h2>
        <div className="stack" style={{ marginTop: 14, gap: 14 }}>
          <div>
            <label htmlFor="m-when" className="field-label">When</label>
            <input id="m-when" className="input" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
          </div>
          <div>
            <label htmlFor="m-place" className="field-label">Where (optional)</label>
            <input id="m-place" className="input" maxLength={200} placeholder="A café, someone’s place…" value={place} onChange={(e) => setPlace(e.target.value)} />
          </div>
          <div>
            <label htmlFor="m-link" className="field-label">Video call link (optional)</label>
            <input id="m-link" className="input" type="url" inputMode="url" maxLength={500} placeholder="https://" value={link} onChange={(e) => setLink(e.target.value)} />
          </div>
          <div>
            <label htmlFor="m-note" className="field-label">Note (optional)</label>
            <textarea id="m-note" className="textarea" maxLength={300} placeholder="Bring snacks, finish part two…" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>Everyone&rsquo;s scores for the book come out when the meeting starts.</p>
          {error && <p className="error" role="alert" style={{ margin: 0 }}>{error}</p>}
          <button className="btn btn--block" disabled={busy} onClick={save}>{busy ? "Saving…" : meeting ? "Save changes" : "Set the meeting"}</button>
          {meeting && (confirmCancel ? (
            <button className="btn btn--block" style={{ background: "var(--error)", color: "var(--on-ink)" }} disabled={busy} onClick={cancel}>Cancel the meeting for everyone</button>
          ) : (
            <button className="link-btn" style={{ minHeight: 44, color: "var(--error)" }} onClick={() => setConfirmCancel(true)}>Cancel the meeting</button>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * The reveal, on the club page: before it opens, who has ranked so far (no
 * scores); after, a link to everyone's scores.
 */
export function RevealRowLink({ clubId, readId, isHost, meId, people, memberCount }: {
  clubId: string;
  readId: string;
  isHost: boolean;
  meId: string;
  people: Map<string, Profile>;
  memberCount: number;
}) {
  const [state, setState] = useState<{ open: boolean; rows: RevealRow[] } | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchReveal(readId).then(setState).catch(() => setState(null));
  }, [readId]);

  if (!state) return null;
  const ranked = state.rows.length;
  const iRanked = state.rows.some((r) => r.user_id === meId);

  async function open() {
    setBusy(true);
    try {
      await openReveal(readId);
      setState(await fetchReveal(readId));
    } catch {
      /* nothing changed; the button stays */
    }
    setBusy(false);
    setConfirm(false);
  }

  return (
    <section aria-label="The reveal" style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--line)" }}>
      {state.open ? (
        <Link href={`/clubs/${clubId}/reveal?read=${readId}`} className="club-row">
          <span style={{ flex: 1, minWidth: 0 }}>
            <strong style={{ display: "block", fontSize: 15 }}>The reveal is open</strong>
            <span className="muted" style={{ fontSize: 13 }}>See how {ranked} of {memberCount} ranked it</span>
          </span>
          <span aria-hidden="true" className="muted">›</span>
        </Link>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {ranked > 0 && (
              <span className="avatar-stack" aria-hidden="true">
                {state.rows.slice(0, 5).map((r) => <Avatar key={r.user_id} profile={people.get(r.user_id)} size={26} ring={false} />)}
              </span>
            )}
            <span style={{ flex: 1, minWidth: 0 }}>
              <strong style={{ display: "block", fontSize: 15 }}>{ranked} of {memberCount} ranked it</strong>
              <span className="muted" style={{ fontSize: 13 }}>
                {iRanked ? "Your score stays hidden until the reveal." : "Rank it on your shelf. Scores stay hidden until the reveal."}
              </span>
            </span>
          </div>
          {isHost && (confirm ? (
            <button className="btn btn--block" style={{ marginTop: 10 }} disabled={busy} onClick={open}>Show everyone&rsquo;s scores now</button>
          ) : (
            <button className="small-btn small-btn--outline" style={{ marginTop: 10 }} onClick={() => setConfirm(true)}>Open the reveal</button>
          ))}
        </>
      )}
    </section>
  );
}
