"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Avatar, displayName } from "@/components/Avatar";
import { Cover } from "@/components/Cover";
import type { Book } from "@/lib/books";
import { createReadAlong, fetchFollowing, fetchProfiles, inviteToReadAlong, type Profile } from "@/lib/data";

const MAX_FRIENDS = 7;
const NEXT_KEY = "spine:read-along-next";

/** Remember a finished read-along's group so the next book starts with them. */
export function rememberNextGroup(previousId: string, members: string[]) {
  try {
    sessionStorage.setItem(NEXT_KEY, JSON.stringify({ previousId, members }));
  } catch {}
}

function takeNextGroup(): { previousId: string; members: string[] } | null {
  try {
    const raw = sessionStorage.getItem(NEXT_KEY);
    return raw ? (JSON.parse(raw) as { previousId: string; members: string[] }) : null;
  } catch {
    return null;
  }
}

/**
 * Pick friends to read a book with. Also used to invite more people to an
 * existing read-along (pass `readAlongId` and who's already in).
 */
export function ReadAlongStart({
  book, onClose, readAlongId, already = [],
}: {
  book: Book;
  onClose: () => void;
  readAlongId?: string;
  already?: string[];
}) {
  const router = useRouter();
  const [people, setPeople] = useState<Profile[] | null>(null);
  const [next] = useState(() => (readAlongId ? null : takeNextGroup()));
  const [picked, setPicked] = useState<Set<string>>(() => new Set(next?.members ?? []));
  const [q, setQ] = useState("");
  const [target, setTarget] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const alreadyKey = already.join(",");
  useEffect(() => {
    const skip = new Set(alreadyKey.split(","));
    fetchFollowing()
      .then((ids) => fetchProfiles(ids))
      .then((m) => setPeople([...m.values()].filter((p) => p.username && !skip.has(p.id)).sort((a, b) => displayName(a).localeCompare(displayName(b)))))
      .catch(() => setPeople([]));
  }, [alreadyKey]);

  const room = (readAlongId ? 8 - already.length : MAX_FRIENDS) - picked.size;
  const term = q.trim().toLowerCase();
  const shown = useMemo(
    () => (people ?? []).filter((p) => !term || displayName(p).toLowerCase().includes(term) || p.username!.includes(term)),
    [people, term],
  );

  function toggle(id: string) {
    setPicked((cur) => {
      const n = new Set(cur);
      if (n.has(id)) n.delete(id);
      else if (room > 0) n.add(id);
      return n;
    });
  }

  async function go() {
    setBusy(true);
    setError(null);
    try {
      if (readAlongId) {
        await inviteToReadAlong(readAlongId, [...picked]);
        onClose();
      } else {
        const id = await createReadAlong(book.id, [...picked], target || null, next?.previousId ?? null);
        try {
          sessionStorage.removeItem(NEXT_KEY);
        } catch {}
        router.push(`/together/${id}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn’t start it. Try again.");
      setBusy(false);
    }
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="sheet-backdrop" onClick={() => !busy && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Read with friends" onClick={(e) => e.stopPropagation()}>
        <div className="sheet__grab" />
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <Cover book={book} width={44} />
          <div style={{ minWidth: 0 }}>
            <h2 className="d" style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: "-0.03em" }}>
              {readAlongId ? "Invite more friends" : "Read with friends"}
            </h2>
            <p className="muted" style={{ margin: "2px 0 0", fontSize: 13 }}>
              {readAlongId
                ? "They’ll see everyone’s progress and the discussion."
                : next
                  ? "Your group from last time is picked. Add or remove anyone."
                  : "Share progress, talk without spoilers, then compare scores."}
            </p>
          </div>
        </div>

        <input className="input" style={{ width: "100%", marginTop: 16 }} placeholder="Search people you follow" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search people you follow" />

        <ul className="pick-list" aria-label="People you follow">
          {people === null && <li className="muted" style={{ padding: 12, fontSize: 14 }}>Loading…</li>}
          {people && people.length === 0 && (
            <li className="muted" style={{ padding: 12, fontSize: 14 }}>Follow some friends first, then invite them here.</li>
          )}
          {shown.map((p) => {
            const on = picked.has(p.id);
            return (
              <li key={p.id}>
                <button type="button" className="pick-row" aria-pressed={on} onClick={() => toggle(p.id)} disabled={!on && room <= 0}>
                  <Avatar profile={p} size={36} />
                  <span style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                    <span style={{ display: "block", fontWeight: 600 }}>{displayName(p)}</span>
                    <span className="muted" style={{ fontSize: 12 }}>@{p.username}</span>
                  </span>
                  <span className="pick-check" aria-hidden="true">{on ? "✓" : ""}</span>
                </button>
              </li>
            );
          })}
        </ul>

        {!readAlongId && (
          <div className="field" style={{ marginTop: 12 }}>
            <label htmlFor="ra-target">Finish by (optional)</label>
            <input id="ra-target" type="date" className="input" min={today} value={target} onChange={(e) => setTarget(e.target.value)} />
          </div>
        )}

        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn btn--block" style={{ marginTop: 16 }} disabled={busy || picked.size === 0} onClick={go}>
          {busy ? "Starting…" : readAlongId ? `Invite ${picked.size || ""}`.trim() : picked.size ? `Start with ${picked.size} friend${picked.size === 1 ? "" : "s"}` : "Pick at least one friend"}
        </button>
      </div>
    </div>
  );
}
