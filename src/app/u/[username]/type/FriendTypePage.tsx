"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { RequireAuth, useProfile } from "@/components/Auth";
import { displayName } from "@/components/Avatar";
import { BackIcon } from "@/components/icons";
import { CardSkeleton } from "@/components/Skeleton";
import { useReaderType } from "@/components/useReaderTypes";
import { fetchProfileByUsername, type Profile } from "@/lib/data";
import { AXES, withArticle } from "@/lib/readerType";
import { DRIVES, FAMILIES, TYPE_COLOR, TYPES, familyKeyOf } from "@/lib/readerTypeCopy";
import { toThey } from "@/lib/theyCopy";

export function FriendTypePage() {
  return (
    <RequireAuth>
      <Inner />
    </RequireAuth>
  );
}

/** Third-person version of each pole's one-liner. */
const POLE_THEY: Record<string, string> = {
  W: "Roams across genres and subjects.",
  D: "Goes deep in the kinds of books they love.",
  H: "Reads for people and feeling.",
  M: "Reads for ideas, puzzles and how things work.",
  F: "One book at a time, all the way to the end.",
  G: "A few books going at once, following their mood.",
  E: "Goes in hoping to love it, and often does.",
  C: "A book has to earn it. Their 9s mean something.",
};

/**
 * A friend's reader type in depth: what each letter means for them, why
 * they read, and what their type is like. Built from their saved type, so
 * there are no receipts from their shelf, just the shape of it.
 */
function Inner() {
  const { username } = useParams<{ username: string }>();
  const router = useRouter();
  const { profile: me } = useProfile();
  const [person, setPerson] = useState<Profile | null | undefined>(undefined);
  useEffect(() => {
    fetchProfileByUsername(username).then(setPerson).catch(() => setPerson(null));
  }, [username]);
  useEffect(() => {
    if (person && me && person.id === me.id) router.replace("/you/type");
  }, [person, me, router]);
  const theirs = useReaderType(person?.id);
  const mine = useReaderType(me?.id);

  const back = (
    <div className="topbar">
      <Link href={`/u/${username}`} className="icon-btn" aria-label="Back"><BackIcon size={20} /></Link>
    </div>
  );

  if (person === undefined || (person && theirs === undefined)) {
    return (
      <div className="app"><main className="screen screen--flow" style={{ paddingTop: 16 }}>{back}<CardSkeleton height={420} /></main></div>
    );
  }
  if (!person || !theirs || !TYPES[theirs.code]) {
    return (
      <div className="app">
        <main className="screen screen--flow" style={{ paddingTop: 16 }}>
          {back}
          <div className="empty">
            <p className="h2">No reader type yet</p>
            <p style={{ margin: 0, fontSize: 14 }}>A type appears once someone has ranked 5 books.</p>
          </div>
        </main>
      </div>
    );
  }

  const first = displayName(person).split(" ")[0];
  const copy = TYPES[theirs.code];
  const color = TYPE_COLOR[theirs.code];
  const fam = FAMILIES[familyKeyOf(theirs.code)];
  const drive = theirs.drive && theirs.drive in DRIVES ? DRIVES[theirs.drive as keyof typeof DRIVES] : null;
  const wing = theirs.wing && theirs.wing in DRIVES ? DRIVES[theirs.wing as keyof typeof DRIVES] : null;
  const same = mine ? [...theirs.code].filter((l, i) => mine.code[i] === l).length : null;

  return (
    <div className="app">
      <main className="screen screen--flow" style={{ paddingTop: 16 }}>
        {back}

        <section className="rt-hero" style={{ background: color.bg, color: color.fg }} aria-labelledby="rt-name">
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <span className="eyebrow" style={{ color: "inherit", opacity: 0.8 }}>{first}&rsquo;s reader type</span>
            <span className="eyebrow" style={{ color: "inherit", opacity: 0.8 }}>{fam.label}</span>
          </div>
          <div className="rt-code" aria-label={theirs.code.split("").join(" ")}>
            {theirs.code.split("").map((l, i) => <span key={i} aria-hidden="true">{l}</span>)}
          </div>
          <h1 id="rt-name" className="g" style={{ margin: 0, fontSize: 40, lineHeight: 1, letterSpacing: "-0.015em" }}>{copy.name}</h1>
          <p className="d" style={{ margin: "10px 0 0", fontSize: 19, lineHeight: 1.3, fontWeight: 500 }}>{copy.tagline}</p>
          <p style={{ margin: "16px 0 0", fontSize: 13, opacity: 0.85 }}>{fam.label}: {fam.gist.toLowerCase()}.</p>
        </section>
        <p className="muted" style={{ fontSize: 13, margin: "10px 0 0" }}>
          From {theirs.book_count} ranked books.{same != null ? ` ${same === 4 ? "Same type as you." : `${same} of 4 letters match yours.`}` : ""}
        </p>

        <h2 className="section-title" style={{ marginTop: 32 }}>What {copy.name.replace(/^The /, "a ")} is like</h2>
        <section className="card" style={{ marginTop: 12 }}>
          <p style={{ margin: 0, fontSize: 16, lineHeight: 1.5 }}>{toThey(copy.about)}</p>
          <div className="eyebrow" style={{ marginTop: 18 }}>Superpower</div>
          <p style={{ margin: "4px 0 0", fontSize: 15, lineHeight: 1.45 }}>{toThey(copy.superpower)}</p>
          <div className="eyebrow" style={{ marginTop: 16 }}>Watch out for</div>
          <p style={{ margin: "4px 0 0", fontSize: 15, lineHeight: 1.45 }}>{toThey(copy.watchOut)}</p>
        </section>

        <h2 className="section-title" style={{ marginTop: 32 }}>{first}&rsquo;s four spectrums</h2>
        <div className="stack" style={{ marginTop: 12 }}>
          {AXES.map((def, i) => {
            const pct = theirs.pcts[i] ?? 50;
            const [left, right] = def.poles;
            const pole = pct >= 50 ? left : right;
            const lean = pct >= 50 ? pct : 100 - pct;
            const balanced = Math.abs(pct - 50) < 7;
            return (
              <section key={def.key} className="card">
                <div className="eyebrow">{def.label}</div>
                <div className="rt-poles">
                  <span className={pct >= 50 ? "on" : undefined}>{left.name}</span>
                  <span className={pct < 50 ? "on" : undefined}>{right.name}</span>
                </div>
                <div className="rt-track" role="img" aria-label={`${def.label}: ${pct}% ${left.name.toLowerCase()}, ${100 - pct}% ${right.name.toLowerCase()}`}>
                  <span className="rt-track__mid" />
                  <span className="rt-track__fill" style={{ left: `${Math.min(50, 100 - pct)}%`, width: `${Math.abs(pct - 50)}%`, background: color.bg }} />
                  <span className="rt-track__dot" style={{ left: `${100 - pct}%`, background: color.bg }} />
                </div>
                <div className="d" style={{ fontWeight: 700, fontSize: 18, marginTop: 12 }}>
                  {balanced ? `Balanced, just ${pole.name.toLowerCase()}` : `${lean}% ${pole.name.toLowerCase()}`}
                </div>
                <p className="muted" style={{ margin: "4px 0 0", fontSize: 14, lineHeight: 1.4 }}>{POLE_THEY[pole.letter]}</p>
                {mine && (
                  <p style={{ margin: "8px 0 0", fontSize: 13, fontWeight: 600, color: mine.code[i] === theirs.code[i] ? "#2D6A3E" : "var(--accent-ink)" }}>
                    {mine.code[i] === theirs.code[i] ? "Same as you" : `You lean ${(def.poles.find((p) => p.letter === mine.code[i])?.name ?? "").toLowerCase()}`}
                  </p>
                )}
              </section>
            );
          })}
        </div>

        {drive && (
          <>
            <h2 className="section-title" style={{ marginTop: 32 }}>Why {first} reads</h2>
            <section className="card" style={{ marginTop: 12, background: drive.bg, borderColor: drive.bg, color: drive.fg }}>
              <div className="eyebrow" style={{ color: "inherit", opacity: 0.75 }}>Core drive</div>
              <div className="g" style={{ fontSize: 40, lineHeight: 1, marginTop: 8 }}>{drive.label}</div>
              {wing && <div className="g" style={{ fontSize: 20, marginTop: 6, opacity: 0.8 }}>with {withArticle(wing.label.toLowerCase())} wing</div>}
              <p className="d" style={{ margin: "14px 0 0", fontSize: 18, lineHeight: 1.3, fontWeight: 500 }}>{toThey(drive.desire)}</p>
              <div className="eyebrow" style={{ color: "inherit", opacity: 0.75, marginTop: 16 }}>What loses them</div>
              <p style={{ margin: "4px 0 0", fontSize: 15 }}>{toThey(drive.shadow)}</p>
            </section>
          </>
        )}

        <Link href={`/u/${username}`} className="btn btn--quiet btn--block" style={{ marginTop: 28 }}>See {first}&rsquo;s profile</Link>
        <Link href={mine ? "/you/type" : "/add"} className="btn btn--block" style={{ marginTop: 10 }}>{mine ? "See your type" : "Rank a book to get yours"}</Link>
      </main>
    </div>
  );
}
