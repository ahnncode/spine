"use client";

import Link from "next/link";
import { useState } from "react";
import { useProfile } from "@/components/Auth";
import { Avatar, displayName } from "@/components/Avatar";
import { ArrowIcon } from "@/components/icons";
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

  const match = !self && same != null ? (same === 4 ? "Same type as you" : `${same} of 4 letters match`) : null;
  const body = (
    <>
      <span className="rt-teaser__code">{theirs.code}</span>
      <span style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
        <span className="eyebrow" style={{ display: "block", color: "inherit", opacity: 0.8 }}>{self ? "Your reader type" : "Reader type"}</span>
        <span className="g" style={{ display: "block", fontSize: 20, lineHeight: 1.1, marginTop: 4 }}>{TYPES[theirs.code].name}</span>
        {match && <span style={{ display: "block", fontSize: 13, marginTop: 4, opacity: 0.85 }}>{match} · Compare</span>}
      </span>
    </>
  );
  return (
    <>
      {self ? (
        <Link href="/you/type" className="rt-teaser rt-teaser--top" style={{ background: c.bg, color: c.fg }}>{body}</Link>
      ) : (
        <button className="rt-teaser rt-teaser--top" style={{ background: c.bg, color: c.fg, width: "100%", border: 0, font: "inherit", cursor: "pointer" }} onClick={() => setOpen(true)} aria-haspopup="dialog">
          {body}
        </button>
      )}
      {open && me && <CompareSheet me={me} mine={mine ?? null} person={person} theirs={theirs} onClose={() => setOpen(false)} />}
    </>
  );
}

/** Each letter in a few words, about someone else. */
const POLE_ABOUT: Record<string, string> = {
  W: "Roams across genres and subjects.",
  D: "Goes deep in the kinds of books they love.",
  H: "Reads for people and feeling.",
  M: "Reads for ideas, puzzles and how things work.",
  F: "One book at a time, all the way to the end.",
  G: "A few books going at once, following their mood.",
  E: "Goes in hoping to love it, and often does.",
  C: "A book has to earn it. Their 9s mean something.",
};

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
        : `${mine === "H" ? "You read" : `${them} reads`} for feeling, ${mine === "H" ? `${them} for` : "you for"} ideas. Swap a favorite.`;
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
        <h2 className="g" style={{ margin: "14px 0 0", textAlign: "center", fontSize: 24, lineHeight: 1.05 }}>{heading}</h2>

        <section className="rt-about" aria-label={`${them}’s reader type`} style={{ background: tc.bg, color: tc.fg }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <span className="g" style={{ fontSize: 20, lineHeight: 1.1 }}>{TYPES[theirs.code].name}</span>
            <span style={{ marginLeft: "auto", fontFamily: "var(--font-book)", fontWeight: 700, fontSize: 15, letterSpacing: "0.08em", opacity: 0.85 }}>{theirs.code}</span>
          </div>
          <p style={{ margin: "4px 0 0", fontSize: 14, lineHeight: 1.35, opacity: 0.9 }}>
            {TYPES[theirs.code].tagline} {FAMILIES[famB].label}: {FAMILIES[famB].gist.toLowerCase()}.
          </p>
          <ul className="rt-about__poles">
            {AXES.map((a, i) => {
              const pole = a.poles.find((x) => x.letter === theirs.code[i]);
              return (
                <li key={a.key}>
                  <span className="rt-about__letter" style={{ background: tc.fg === "#111111" ? "rgba(17,17,17,0.14)" : "rgba(255,255,255,0.2)" }}>{theirs.code[i]}</span>
                  <span><strong>{pole?.name}</strong> · {POLE_ABOUT[theirs.code[i]]}</span>
                </li>
              );
            })}
          </ul>
          <Link href={`/u/${person.username}/type`} className="rt-about__more" style={{ color: "inherit" }}>
            More about {them}&rsquo;s type <ArrowIcon size={14} />
          </Link>
        </section>
        {!mine && (
          <p className="muted" style={{ margin: "12px 0 0", textAlign: "center", fontSize: 14 }}>Rank 5 books to get your own type and see how you compare.</p>
        )}

        {mine && mc && (
          <>
            <div className="type-compare" style={{ borderTop: 0, paddingBottom: 0, fontSize: 12, fontWeight: 600, letterSpacing: "0.06em", color: "var(--muted)" }}>
              <span /><span /><span style={{ textAlign: "center" }}>YOU</span><span style={{ textAlign: "center" }}>{them.toUpperCase().slice(0, 6)}</span>
            </div>
            {AXES.map((a, i) => (
              <div key={a.key} className="type-compare">
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{a.label}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: mine.code[i] === theirs.code[i] ? "var(--success)" : "var(--accent-ink)" }}>
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
