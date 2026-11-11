"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/Auth";
import { ClubScreen, NotAMember, shortDate, useClub } from "@/components/ClubBits";
import { ClubPick } from "@/components/ClubPick";
import { RowsSkeleton } from "@/components/Skeleton";
import { fetchListItems, fetchLists, type ListItem, type ReadingList } from "@/lib/clubs";

export function ListPage() {
  return (
    <RequireAuth>
      <Inner />
    </RequireAuth>
  );
}

/** The club's reading list, with what it has read together, what it's reading now and what's left. */
function Inner() {
  const { id: clubId } = useParams<{ id: string }>();
  const router = useRouter();
  const { data, reload } = useClub(clubId);
  const [list, setList] = useState<ReadingList | null | undefined>(undefined);
  const [items, setItems] = useState<ListItem[] | null>(null);
  const [filter, setFilter] = useState<"all" | "left" | "done">("all");
  const [picking, setPicking] = useState(false);
  const listId = data?.card.list_id ?? null;
  const isHost = data?.role === "host" || data?.role === "cohost";

  useEffect(() => {
    if (data === undefined) return;
    if (!listId) return;
    Promise.all([fetchLists(), fetchListItems(listId)])
      .then(([lists, its]) => { setList(lists.find((l) => l.id === listId) ?? null); setItems(its); })
      .catch(() => { setList(null); setItems([]); });
  }, [data, listId]);

  if (data === undefined) return <ClubScreen title=" " back={`/clubs/${clubId}`}><RowsSkeleton /></ClubScreen>;
  if (!data || !data.role) return <ClubScreen title="Reading list" back={`/clubs/${clubId}`}><NotAMember clubId={clubId} /></ClubScreen>;

  const byPos = new Map(data.reads.filter((r) => r.list_position != null).map((r) => [r.list_position!, r]));
  const done = (items ?? []).filter((it) => byPos.get(it.position)?.finished_at).length;
  const shown = (items ?? []).filter((it) => {
    const r = byPos.get(it.position);
    return filter === "all" ? true : filter === "done" ? Boolean(r) : !r;
  });

  return (
    <ClubScreen eyebrow={data.card.name} title={list?.name ?? "Reading list"} back={`/clubs/${clubId}`}>
      {!listId || list === null ? (
        <div className="empty" style={{ marginTop: 24 }}>
          <p className="h2">No list</p>
          <p style={{ margin: 0, fontSize: 14 }}>This club picks any book it likes.{isHost ? " You can add a list in the club’s settings." : ""}</p>
        </div>
      ) : !items ? (
        <RowsSkeleton />
      ) : (
        <>
          {list?.description && <p className="muted" style={{ margin: "10px 0 0", fontSize: 14, lineHeight: 1.45 }}>{list.description}</p>}
          <p style={{ margin: "10px 0 0", fontSize: 14 }}><strong>{done}</strong> of {items.length} read together</p>
          <div className="seg" role="group" aria-label="Show" style={{ marginTop: 12, gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
            {(["all", "left", "done"] as const).map((f) => (
              <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}>{f === "all" ? "All" : f === "left" ? "Not yet" : "Read together"}</button>
            ))}
          </div>
          <ul className="club-list card" style={{ marginTop: 12, padding: 0 }}>
            {shown.map((it) => {
              const r = byPos.get(it.position);
              const status = r ? (r.finished_at ? <>Read together<br />{shortDate(r.finished_at.slice(0, 10))}</> : "Reading now") : null;
              const body = (
                <>
                  <span className="club-list__year">{it.year}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <strong style={{ display: "block", fontSize: 15 }}>{it.title}</strong>
                    <span className="muted" style={{ fontSize: 12 }}>{[it.author, it.note].filter(Boolean).join(" · ")}</span>
                  </span>
                  {status && <span className={r?.finished_at ? "muted" : undefined} style={{ fontSize: 12, fontWeight: r?.finished_at ? 400 : 700, textAlign: "right", maxWidth: 110 }}>{status}</span>}
                </>
              );
              return (
                <li key={it.position}>
                  {r ? (
                    <button type="button" className="club-list__row" onClick={() => router.push(r.finished_at ? `/clubs/${clubId}/shelf` : `/clubs/${clubId}`)}>{body}</button>
                  ) : (
                    <div className="club-list__row" style={{ cursor: "default" }}>{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
          {isHost && !data.current && (
            <button className="btn btn--block" style={{ marginTop: 16 }} onClick={() => setPicking(true)}>Pick the next book</button>
          )}
        </>
      )}
      <div style={{ height: 40 }} />
      {picking && (
        <ClubPick
          clubId={clubId}
          listId={listId}
          readPositions={[...byPos.keys()]}
          onClose={() => setPicking(false)}
          onDone={async () => { setPicking(false); await reload(); router.push(`/clubs/${clubId}`); }}
        />
      )}
    </ClubScreen>
  );
}
