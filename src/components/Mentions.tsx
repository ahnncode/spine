"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Avatar, displayName } from "@/components/Avatar";
import { fetchFollowing, fetchProfiles, searchProfiles, type Profile } from "@/lib/data";

const MENTION = /(^|[^A-Za-z0-9_@])@([A-Za-z0-9_]{3,20})/g;

/** Text with @username turned into profile links (or highlighted, inside buttons). */
export function MentionText({ text, links = true }: { text: string; links?: boolean }) {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(MENTION)) {
    const start = (m.index ?? 0) + m[1].length;
    if (start > last) parts.push(text.slice(last, start));
    const name = m[2].toLowerCase();
    parts.push(
      links ? (
        <Link key={start} href={`/u/${name}`} className="mention" onClick={(e) => e.stopPropagation()}>@{m[2]}</Link>
      ) : (
        <span key={start} className="mention">@{m[2]}</span>
      ),
    );
    last = start + m[2].length + 1;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}

// People you follow, loaded once per visit, so suggestions appear instantly.
let followingCache: Promise<Profile[]> | null = null;
function followingProfiles(): Promise<Profile[]> {
  followingCache ??= fetchFollowing()
    .then((ids) => fetchProfiles(ids))
    .then((m) => [...m.values()].filter((p) => p.username))
    .catch(() => {
      followingCache = null;
      return [];
    });
  return followingCache;
}

type Field = HTMLInputElement | HTMLTextAreaElement;

/**
 * @mention suggestions for a text field. Spread `fieldProps` on the input and
 * render `picker` just below it.
 */
export function useMentionPicker<T extends Field>(value: string, setValue: (v: string) => void) {
  const ref = useRef<T>(null);
  const [caret, setCaret] = useState<number | null>(null);
  const track = () => setCaret(ref.current?.selectionStart ?? null);
  const before = caret == null ? "" : value.slice(0, caret);
  const query = /(?:^|\s)@([A-Za-z0-9_]{0,20})$/.exec(before)?.[1] ?? null;

  function pick(username: string) {
    if (caret == null || query == null) return;
    const start = caret - query.length - 1;
    const next = `${value.slice(0, start)}@${username} ${value.slice(caret)}`;
    setValue(next);
    const pos = start + username.length + 2;
    requestAnimationFrame(() => {
      ref.current?.focus();
      ref.current?.setSelectionRange(pos, pos);
      setCaret(pos);
    });
  }

  return {
    fieldProps: { ref, onSelect: track, onKeyUp: track, onClick: track, onBlur: () => setTimeout(() => setCaret(null), 150) },
    picker: query == null ? null : <MentionList query={query} onPick={pick} />,
  };
}

function MentionList({ query, onPick }: { query: string; onPick: (username: string) => void }) {
  const [people, setPeople] = useState<Profile[]>([]);

  useEffect(() => {
    let live = true;
    const q = query.toLowerCase();
    const matches = (p: Profile) =>
      !q || p.username!.startsWith(q) || (p.display_name ?? "").toLowerCase().split(/\s+/).some((w) => w.startsWith(q));
    followingProfiles().then((mine) => live && setPeople(mine.filter(matches).slice(0, 5)));
    // Beyond who you follow, once there's enough to search on.
    const t = q.length >= 2
      ? setTimeout(() => {
          searchProfiles(q)
            .then((found) => {
              if (!live) return;
              setPeople((cur) => {
                const seen = new Set(cur.map((p) => p.id));
                return [...cur, ...found.filter((p) => p.username && !seen.has(p.id))].slice(0, 5);
              });
            })
            .catch(() => {});
        }, 250)
      : undefined;
    return () => {
      live = false;
      if (t) clearTimeout(t);
    };
  }, [query]);

  if (!people.length) return null;
  return (
    <ul className="mention-list" role="listbox" aria-label="Mention someone">
      {people.map((p) => (
        <li key={p.id} role="option" aria-selected={false}>
          {/* onMouseDown keeps the text field focused while picking. */}
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => onPick(p.username!)}>
            <Avatar profile={p} size={28} />
            <span style={{ fontWeight: 600 }}>{displayName(p)}</span>
            <span className="muted">@{p.username}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
