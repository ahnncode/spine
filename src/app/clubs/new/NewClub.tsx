"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { RequireAuth } from "@/components/Auth";
import { ClubScreen, ClubTile } from "@/components/ClubBits";
import { CLUB_COLORS, createClub, fetchLists, type ClubColor, type ReadingList } from "@/lib/clubs";

export function NewClub() {
  return (
    <RequireAuth>
      <Inner />
    </RequireAuth>
  );
}

const COLOR_NAMES: Record<ClubColor, string> = { ember: "Ember", cobalt: "Cobalt", forest: "Forest", plum: "Plum", ink: "Ink", gold: "Gold", teal: "Teal" };

/** Start a club: name, about, colour, an optional reading list, and who can join. */
function Inner() {
  const router = useRouter();
  const [lists, setLists] = useState<ReadingList[]>([]);
  const [name, setName] = useState("");
  const [about, setAbout] = useState("");
  const [color, setColor] = useState<ClubColor>("ember");
  const [list, setList] = useState<string>("");
  const [locked, setLocked] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchLists().then(setLists).catch(() => {});
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (name.trim().length < 2) return setError("Give the club a name");
    if (locked && password.length < 6) return setError("Use a password of at least 6 characters");
    setBusy(true);
    setError(null);
    try {
      const id = await createClub({ name, description: about, color, list: list || null, password: locked ? password : null });
      router.replace(`/clubs/${id}?pick=1`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn’t start the club");
      setBusy(false);
    }
  }

  return (
    <ClubScreen title="Start a club" back="/clubs">
      <form onSubmit={submit} className="stack" style={{ marginTop: 20, gap: 16 }}>
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <ClubTile name={name || "Club"} color={color} size={56} />
          <div style={{ flex: 1 }}>
            <label htmlFor="club-name" className="field-label">Name</label>
            <input id="club-name" className="input" maxLength={60} value={name} placeholder="Booker Winners Club" onChange={(e) => setName(e.target.value)} />
          </div>
        </div>

        <div>
          <label htmlFor="club-about" className="field-label">What it&rsquo;s about <span className="muted" style={{ fontWeight: 400 }}>Optional</span></label>
          <textarea id="club-about" className="textarea" maxLength={500} value={about} placeholder="Working through every Booker winner, one a month." onChange={(e) => setAbout(e.target.value)} />
        </div>

        <fieldset className="plain-fieldset">
          <legend className="field-label">Colour</legend>
          <div className="tag-list">
            {(Object.keys(CLUB_COLORS) as ClubColor[]).map((c) => (
              <button key={c} type="button" className="swatch" aria-pressed={color === c} aria-label={COLOR_NAMES[c]} onClick={() => setColor(c)} style={{ background: CLUB_COLORS[c].bg }} />
            ))}
          </div>
        </fieldset>

        <fieldset className="plain-fieldset">
          <legend className="field-label">Reading list <span className="muted" style={{ fontWeight: 400 }}>Optional</span></legend>
          <div className="stack" style={{ gap: 8 }} role="radiogroup" aria-label="Reading list">
            {[{ slug: "", name: "No list, we’ll pick freely", description: null }, ...lists].map((l) => (
              <button key={l.slug} type="button" role="radio" aria-checked={list === l.slug} className="choice-row" onClick={() => setList(l.slug)}>
                <span className="choice-row__dot" aria-hidden="true" />
                <span>
                  <strong style={{ display: "block", fontSize: 15 }}>{l.name}</strong>
                  {l.description && <span className="muted" style={{ fontSize: 12 }}>{l.description}</span>}
                </span>
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="plain-fieldset">
          <legend className="field-label">Who can join</legend>
          <div className="seg" role="radiogroup" aria-label="Who can join">
            <button type="button" role="radio" aria-checked={!locked} onClick={() => setLocked(false)}>Anyone</button>
            <button type="button" role="radio" aria-checked={locked} onClick={() => setLocked(true)}>With a password</button>
          </div>
          <p className="muted" style={{ margin: "8px 0 0", fontSize: 12 }}>Everyone can find the club either way. With a password, only people you give it to can get in.</p>
          {locked && (
            <div style={{ marginTop: 10 }}>
              <label htmlFor="club-pass" className="field-label">Password</label>
              <input id="club-pass" className="input" type="text" autoComplete="off" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" />
            </div>
          )}
        </fieldset>

        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn btn--block" disabled={busy}>{busy ? "Starting…" : "Start the club"}</button>
        <p className="muted" style={{ margin: 0, textAlign: "center", fontSize: 12 }}>You&rsquo;ll be the host. Next: pick your first book.</p>
      </form>
    </ClubScreen>
  );
}
