"use client";

import Link from "next/link";
import { useState } from "react";
import { useProfile } from "@/components/Auth";
import { Avatar, displayName } from "@/components/Avatar";
import { useReaderType } from "@/components/useReaderTypes";
import type { Profile, StoredReaderType } from "@/lib/data";
import { AXES } from "@/lib/readerType";
import { FAMILIES, TYPE_COLOR, TYPES, familyKeyOf } from "@/lib/readerTypeCopy";

type Person = Pick<Profile, "id" | "username" | "display_name" | "avatar_icon" | "avatar_color">;

/**
 * Someone's reader type on their profile: a small pill in their type colour,
 * and a line on how many letters match yours. Tapping it compares the two.
 */
export function ReaderTypePill({ person }: { person: Person }) {
  const { profile: me } = useProfile();
  const theirs = useReaderType(person.id);
  const mine = useReaderType(me?.id);
  const [open, setOpen] = useState(false);
  if (!theirs || !TYPES[theirs.code]) return null;
  const c = TYPE_COLOR[theirs.code];
  const self = me?.id === person.id;
  const same = mine ? [...theirs.code].filter((l, i) => mine.code[i] === l).length : null;

  const pill = (
    <>
      <span className="type-pill__code">{theirs.code}</span>
      <span className="type-pill__name">{TYPES[theirs.code].name}</span>
    </>
  );
  return (
    <div style={{ marginTop: 8 }}>
      {self ? (
        <Link href="/you/type" className="type-pill" style={{ background: c.bg, color: c.fg, textDecoration: "none" }}>{pill}</Link>
      ) : (
        <button className="type-pill" style={{ background: c.bg, color: c.fg }} onClick={() => setOpen(true)} aria-haspopup="dialog">
          {pill}
        </button>
      )}
      {!self && same != null && (
        <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
          {same === 4 ? "Same type as you" : `${same} of 4 letters match yours`}
        </div>
      )}
      {open && me && <CompareSheet me={me} mine={mine ?? null} person={person} theirs={theirs} onClose={() => setOpen(false)} />}
    </div>
  );
}

/** One line per spectrum on what a match or a difference means in practice. */
function note(axis: number, mine: string, theirs: string, them: string): string {
  const same = mine === theirs;
  switch (axis) {
    case 0:
      return same
        ? mine === "W" ? "You both roam. Expect a lot of “wait, you read that?”" : "You both go deep. Trade your corners."
        : `${mine === "W" ? "You bring" : `${them} brings`} the range; ${mine === "W" ? `${them} brings` : "you bring"} the deep cuts.`;
    case 1:
      return same
        ? mine === "H" ? "You both read for people and feeling." : "Ideas first, for both of you."
        : `${mine === "H" ? "You read" : `${them} reads`} for feeling, ${mine === "H" ? `${them} for` : "you for"} ideas. Swap a favourite.`;
    case 2:
      return same
        ? mine === "F" ? "Two one-at-a-time finishers: an easy read-along pace." : "Two jugglers. Give read-alongs a loose deadline."
        : "Reading together? Set the pace by chapters, not days.";
    default:
      return same
        ? mine === "E" ? "You both love easily. The recommendations will flow." : "Two tough critics. A shared 9 means a lot."
        : mine === "E" ? `${them}’s 9 is your 10. Ask what they loved, not what they liked.` : `Your 9 is ${them}’s 10. Ask what they loved, not what they liked.`;
  }
}

function CompareSheet({ me, mine, person, theirs, onClose }: {
  me: Person;
  mine: StoredReaderType | null;
  person: Person;
  theirs: StoredReaderType;
  onClose: () => void;
}) {
  const them = displayName(person).split(" ")[0];
  const tc = TYPE_COLOR[theirs.code];
  const mc = mine ? TYPE_COLOR[mine.code] : null;
  const same = mine ? [...theirs.code].filter((l, i) => mine.code[i] === l).length : 0;
  const famA = mine ? familyKeyOf(mine.code) : null;
  const famB = familyKeyOf(theirs.code);
  const heading = !mine
    ? `${them} is ${TYPES[theirs.code].name}`
    : mine.code === theirs.code
      ? `Twin types: ${TYPES[theirs.code].name}`
      : famA === famB
        ? `Two ${FAMILIES[famB].label}`
        : `${TYPES[mine.code].name} meets ${TYPES[theirs.code].name.replace("The ", "the ")}`;
  const flip: Record<string, string> = { W: "D", D: "W", E: "C", C: "E" };
  const matched = mine && `${flip[mine.code[0]]}${mine.code[1]}${mine.code[2]}${flip[mine.code[3]]}` === theirs.code;

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={`Compare reader types with ${them}`} onClick={(e) => e.stopPropagation()}>
        <div className="sheet__grab" />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginTop: 14 }}>
          <Avatar profile={me} size={64} />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 74, height: 74, margin: "0 -12px", borderRadius: "50%", background: "var(--ink)", color: "var(--on-ink)", border: "5px solid var(--surface)", position: "relative", fontFamily: "var(--font-book)", fontWeight: 700, fontSize: 24 }}>
            {mine ? `${same}/4` : "?"}
          </div>
          <Avatar profile={person} size={64} />
        </div>
        <h2 className="g" style={{ margin: "14px 0 0", textAlign: "center", fontSize: 26, lineHeight: 1.05 }}>{heading}</h2>
        <p className="muted" style={{ margin: "6px 0 0", textAlign: "center", fontSize: 14 }}>
          {mine ? TYPES[theirs.code].tagline : "Rank 5 books to get your own type and see how you compare."}
        </p>

        {mine && mc && (
          <>
            <div className="type-compare" style={{ borderTop: 0, paddingBottom: 0, fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", color: "var(--muted)" }}>
              <span /><span /><span style={{ textAlign: "center" }}>YOU</span><span style={{ textAlign: "center" }}>{them.toUpperCase().slice(0, 6)}</span>
            </div>
            {AXES.map((a, i) => (
              <div key={a.key} className="type-compare">
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{a.label}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: mine.code[i] === theirs.code[i] ? "#2D6A3E" : "var(--accent-ink)" }}>
                    {mine.code[i] === theirs.code[i] ? "Same" : "Different"}
                  </span>
                </div>
                <div style={{ fontSize: 13, lineHeight: 1.35, color: "var(--ink-2)" }}>{note(i, mine.code[i], theirs.code[i], them)}</div>
                <div className="type-compare__letter" style={{ background: mc.bg, color: mc.fg }}>{mine.code[i]}</div>
                <div className="type-compare__letter" style={{ background: tc.bg, color: tc.fg }}>{theirs.code[i]}</div>
              </div>
            ))}
            {matched && (
              <p style={{ margin: "14px 0 0", fontSize: 14, fontWeight: 600, textAlign: "center" }}>
                You&rsquo;re each other&rsquo;s book-club match.
              </p>
            )}
          </>
        )}

        <Link href={mine ? "/you/type" : "/add"} className="btn btn--block" style={{ marginTop: 18 }}>
          {mine ? "See your type" : "Rank a book"}
        </Link>
      </div>
    </div>
  );
}
