"use client";

import { MentionText } from "@/components/Mentions";
import { useState } from "react";
import { setHeart, type HeartState, type TargetType } from "@/lib/data";
import { TAG_LABEL, VIBE_LABEL } from "@/lib/thoughts";
import { CommentIcon, HeartIcon } from "./icons";

/** One-tap heart with a count. Optimistic: flips immediately, rolls back on error. */
export function HeartButton({ type, id, initial, onChange }: { type: TargetType; id: string; initial?: HeartState; onChange?: (s: HeartState) => void }) {
  const [state, setState] = useState<HeartState>(initial ?? { count: 0, mine: false });
  const [busy, setBusy] = useState(false);
  const [popped, setPopped] = useState(false);

  async function toggle() {
    if (busy) return;
    setPopped(!state.mine);
    const next = { count: state.count + (state.mine ? -1 : 1), mine: !state.mine };
    setState(next);
    setBusy(true);
    try {
      await setHeart(type, id, next.mine);
      onChange?.(next);
    } catch {
      setState(state);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button className="action-btn action-btn--heart" data-pop={popped && state.mine ? "on" : undefined} aria-pressed={state.mine} aria-label={`${state.mine ? "Remove heart" : "Heart"}${state.count ? `, ${state.count}` : ""}`} onClick={toggle}>
      <HeartIcon size={17} filled={state.mine} />
      {state.count > 0 && <span>{state.count}</span>}
    </button>
  );
}

export function CommentButton({ count, onClick }: { count: number; onClick: () => void }) {
  return (
    <button className="action-btn" onClick={onClick} aria-label={`Comments${count ? `, ${count}` : ""}`}>
      <CommentIcon size={17} />
      {count > 0 ? <span>{count}</span> : <span style={{ fontWeight: 500 }}>Reply</span>}
    </button>
  );
}

/** A note, blurred behind a tap when it's marked as a spoiler (unless it's yours). */
export function NoteText({ note, spoiler, mine = false, clamp, links = true }: { note: string; spoiler: boolean; mine?: boolean; clamp?: number; links?: boolean }) {
  const [shown, setShown] = useState(!spoiler || mine);
  const style = clamp
    ? { display: "-webkit-box", WebkitLineClamp: clamp, WebkitBoxOrient: "vertical" as const, overflow: "hidden" }
    : undefined;
  if (shown) {
    return (
      <div>
        {spoiler && <span className="tag-pill" style={{ display: "inline-block", marginBottom: 6 }}>Spoilers</span>}
        <p className="note" style={style}><MentionText text={note} links={links} /></p>
      </div>
    );
  }
  return (
    <div className="note--spoiler">
      <p className="note" aria-hidden="true" style={style}>{note}</p>
      <button onClick={() => setShown(true)}>Contains spoilers · tap to read</button>
    </div>
  );
}

export function TagList({ tags, max = 6 }: { tags: string[]; max?: number }) {
  const shown = tags.filter((t) => TAG_LABEL[t]).slice(0, max);
  if (!shown.length) return null;
  return (
    <div className="tag-list">
      {shown.map((t) => <span key={t} className="tag-pill">{TAG_LABEL[t]}</span>)}
    </div>
  );
}

export function VibePill({ vibe }: { vibe: string | null }) {
  if (!vibe || !VIBE_LABEL[vibe]) return null;
  return <span className="tag-pill" style={{ background: "var(--cobalt-soft)", color: "var(--cobalt-ink)" }}>{VIBE_LABEL[vibe]}</span>;
}
