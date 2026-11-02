"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState, useEffect, type ReactNode } from "react";
import { RequireAuth, useProfile } from "@/components/Auth";
import { Name } from "@/components/Badge";
import { Cover } from "@/components/Cover";
import { BackIcon, CloseIcon, LockIcon, SearchIcon } from "@/components/icons";
import { ScoreChip } from "@/components/ScoreChip";
import { TabBar } from "@/components/TabBar";
import { WantButton } from "@/components/WantButton";
import { fetchMyBlocks, fetchProfileByUsername, fetchShelf, rankEntries, type Entry, type Profile, type RankedEntry } from "@/lib/data";
import { GENRES } from "@/lib/genres";
import { BUCKETS, formatScore, type Bucket } from "@/lib/ranking";

export function LibraryPage() {
  return (
    <RequireAuth>
      <Inner />
    </RequireAuth>
  );
}

type Tab = "ranked" | "reading" | "want";
type Sort = "rank" | "recent" | "title" | "author" | "disagree";
type Overlap = "all" | "unread" | "both";

const SORT_LABEL: Record<Sort, string> = {
  rank: "Their ranking",
  recent: "Recently read",
  title: "Title A–Z",
  author: "Author A–Z",
  disagree: "Biggest disagreement",
};

interface Loaded {
  profile: Profile;
  theirs: Entry[];
  mine: Entry[];
  hidden: "private" | "blocked" | null;
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button className="filter-chip" aria-pressed={on} onClick={onClick}>
      {children}
    </button>
  );
}

function Inner() {
  const { username } = useParams<{ username: string }>();
  const { profile: me } = useProfile();
  const router = useRouter();
  const [data, setData] = useState<Loaded | null | undefined>(undefined);
  const [tab, setTab] = useState<Tab>("ranked");
  const [q, setQ] = useState("");
  const [tier, setTier] = useState<Bucket | null>(null);
  const [genre, setGenre] = useState<string | null>(null);
  const [year, setYear] = useState<string | null>(null);
  const [overlap, setOverlap] = useState<Overlap>("all");
  const [sort, setSort] = useState<Sort>("rank");

  useEffect(() => {
    (async () => {
      const profile = await fetchProfileByUsername(username);
      if (!profile) return setData(null);
      const isMe = profile.id === me?.id;
      const blocks = isMe ? new Set<string>() : await fetchMyBlocks();
      if (blocks.has(profile.id)) return setData({ profile, theirs: [], mine: [], hidden: "blocked" });
      const [theirs, mine] = await Promise.all([fetchShelf(profile.id), isMe ? Promise.resolve([]) : fetchShelf()]);
      setData({ profile, theirs, mine, hidden: profile.is_private && !isMe ? "private" : null });
    })().catch(() => setData(null));
  }, [username, me?.id]);

  const isMe = data?.profile.id === me?.id;
  const ranked = useMemo(() => rankEntries(data?.theirs ?? []), [data]);
  const myRanked = useMemo(() => new Map(rankEntries(data?.mine ?? []).map((e) => [e.book_id, e])), [data]);
  const myStatus = useMemo(() => new Map((data?.mine ?? []).map((e) => [e.book_id, e.status])), [data]);
  const reading = useMemo(() => (data?.theirs ?? []).filter((e) => e.status === "reading"), [data]);
  const want = useMemo(
    () => (data?.theirs ?? []).filter((e) => e.status === "want").sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [data],
  );

  const source: (Entry | RankedEntry)[] = tab === "ranked" ? ranked : tab === "reading" ? reading : want;
  const genresPresent = useMemo(() => GENRES.filter((g) => source.some((e) => e.book.genres?.includes(g.key))), [source]);
  const years = useMemo(
    () => [...new Set(ranked.map((e) => e.finished_on?.slice(0, 4)).filter((y): y is string => Boolean(y)))].sort().reverse().slice(0, 8),
    [ranked],
  );

  const term = q.trim().toLowerCase();
  let shown = source.filter((e) => {
    if (term && !`${e.book.title} ${e.book.author ?? ""}`.toLowerCase().includes(term)) return false;
    if (genre && !e.book.genres?.includes(genre)) return false;
    if (tab === "ranked") {
      if (tier && e.bucket !== tier) return false;
      if (year && !e.finished_on?.startsWith(year)) return false;
    }
    if (!isMe && overlap === "unread" && myStatus.has(e.book_id) && myStatus.get(e.book_id) !== "want") return false;
    if (!isMe && overlap === "both" && !myRanked.has(e.book_id)) return false;
    return true;
  });
  const effectiveSort: Sort = tab !== "ranked" && (sort === "rank" || sort === "recent" || sort === "disagree") ? "rank" : sort;
  if (effectiveSort === "recent") shown = [...shown].sort((a, b) => (b.finished_on ?? b.ranked_at ?? "").localeCompare(a.finished_on ?? a.ranked_at ?? ""));
  if (effectiveSort === "title") shown = [...shown].sort((a, b) => a.book.title.localeCompare(b.book.title));
  if (effectiveSort === "author") shown = [...shown].sort((a, b) => (a.book.author ?? "").localeCompare(b.book.author ?? ""));
  if (effectiveSort === "disagree") {
    const gap = (e: Entry | RankedEntry) => {
      const mine = myRanked.get(e.book_id);
      return mine && "score" in e ? Math.abs(e.score - mine.score) : -1;
    };
    shown = [...shown].filter((e) => myRanked.has(e.book_id)).sort((a, b) => gap(b) - gap(a));
  }

  const filtersOn = Boolean(term || tier || genre || year || overlap !== "all");
  function clear() {
    setQ(""); setTier(null); setGenre(null); setYear(null); setOverlap("all");
  }
  const sorts: Sort[] = tab === "ranked" ? (isMe ? ["rank", "recent", "title", "author"] : ["rank", "recent", "title", "author", "disagree"]) : ["rank", "title", "author"];

  if (data === null) {
    return (
      <div className="app">
        <main className="screen">
          <div className="empty"><p className="h2">No reader called @{username}</p><Link href="/people" className="btn" style={{ marginTop: 12 }}>Find people</Link></div>
        </main>
        <TabBar />
      </div>
    );
  }

  return (
    <div className="app">
      <main className="screen">
        <div className="topbar">
          <button className="icon-btn" aria-label="Back" onClick={() => router.back()}><BackIcon size={20} /></button>
        </div>
        {!data ? <div aria-busy="true" style={{ minHeight: 200 }} /> : (
          <>
            <p className="eyebrow" style={{ marginTop: 8 }}>
              <Link href={`/u/${data.profile.username}`} style={{ color: "inherit", textDecoration: "none" }}>@{data.profile.username}</Link>
            </p>
            <h1 className="h1" style={{ fontSize: 30 }}>
              {isMe ? "Your library" : <><Name profile={data.profile} markSize={18} />&rsquo;s library</>}
            </h1>

            {data.hidden === "blocked" ? (
              <div className="empty"><p className="h2">You blocked this reader</p></div>
            ) : data.hidden === "private" ? (
              <div className="empty"><LockIcon size={22} /><p className="h2" style={{ marginTop: 8 }}>This shelf is private</p></div>
            ) : (
              <>
                <div className="segmented" role="tablist" aria-label="Shelf" style={{ marginTop: 16 }}>
                  {([["ranked", "Ranked", ranked.length], ["reading", "Reading", reading.length], ["want", "Want", want.length]] as const).map(([id, label, n]) => (
                    <button key={id} role="tab" aria-selected={tab === id} onClick={() => { setTab(id); setGenre(null); }}>
                      {label}<span className="count">{n}</span>
                    </button>
                  ))}
                </div>

                <div className="search-box" style={{ marginTop: 12 }}>
                  <SearchIcon size={18} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} />
                  <input
                    className="input"
                    style={{ width: "100%", paddingLeft: 42, paddingRight: q ? 44 : 16 }}
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Search titles and authors"
                    aria-label="Search this library"
                    autoCapitalize="none"
                  />
                  {q && (
                    <button className="icon-btn" aria-label="Clear search" onClick={() => setQ("")}
                      style={{ position: "absolute", right: 4, top: "50%", transform: "translateY(-50%)", width: 36, height: 36 }}>
                      <CloseIcon size={16} />
                    </button>
                  )}
                </div>

                <div className="filter-row" aria-label="Filters">
                  {!isMe && (
                    <>
                      <Chip on={overlap === "unread"} onClick={() => setOverlap(overlap === "unread" ? "all" : "unread")}>Not read by you</Chip>
                      {tab === "ranked" && <Chip on={overlap === "both"} onClick={() => setOverlap(overlap === "both" ? "all" : "both")}>You&rsquo;ve both read</Chip>}
                    </>
                  )}
                  {tab === "ranked" && (Object.keys(BUCKETS) as Bucket[]).map((b) => (
                    <Chip key={b} on={tier === b} onClick={() => setTier(tier === b ? null : b)}>{BUCKETS[b].label}</Chip>
                  ))}
                </div>
                {(genresPresent.length > 1 || (tab === "ranked" && years.length > 1)) && (
                  <div className="filter-row" style={{ marginTop: 8 }}>
                    {tab === "ranked" && years.map((y) => <Chip key={y} on={year === y} onClick={() => setYear(year === y ? null : y)}>{y}</Chip>)}
                    {genresPresent.map((g) => <Chip key={g.key} on={genre === g.key} onClick={() => setGenre(genre === g.key ? null : g.key)}>{g.label}</Chip>)}
                  </div>
                )}

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 14, gap: 10 }}>
                  <span className="m muted" style={{ fontSize: 12 }}>
                    {shown.length} {shown.length === 1 ? "book" : "books"}
                    {filtersOn && <> · <button className="link-btn" onClick={clear}>Clear filters</button></>}
                  </span>
                  <label className="sort-select">
                    <span className="visually-hidden">Sort by</span>
                    <select value={effectiveSort} onChange={(e) => setSort(e.target.value as Sort)}>
                      {sorts.map((s) => <option key={s} value={s}>{SORT_LABEL[s]}</option>)}
                    </select>
                  </label>
                </div>

                {shown.length === 0 ? (
                  <div className="empty">
                    <p className="h2">{source.length ? "No books match" : tab === "want" ? "Nothing saved yet" : tab === "reading" ? "Not reading anything right now" : "Nothing ranked yet"}</p>
                    {filtersOn && <button className="btn btn--quiet" style={{ marginTop: 12 }} onClick={clear}>Clear filters</button>}
                  </div>
                ) : (
                  <ol style={{ listStyle: "none", margin: "6px 0 0", padding: 0 }}>
                    {shown.map((e) => {
                      const mine = myRanked.get(e.book_id);
                      const status = myStatus.get(e.book_id);
                      const r = "rank" in e ? (e as RankedEntry) : null;
                      const sub = !isMe && mine
                        ? `You: ${formatScore(mine.score)}${r && Math.abs(r.score - mine.score) >= 2 ? (r.score > mine.score ? " · they liked it more" : " · you liked it more") : ""}`
                        : !isMe && status === "reading" ? "You’re reading this"
                        : e.status === "reading" && e.progress_pct != null ? `${e.book.author ?? ""} · ${e.progress_pct}%`
                        : e.book.author;
                      return (
                        <li key={e.id} style={{ display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid var(--line)" }}>
                          <Link href={`/book/${e.book_id}`} className="book-row" style={{ flex: 1, minWidth: 0, borderBottom: 0 }}>
                            {r && <span className={`book-row__rank ${r.rank <= 3 ? "book-row__rank--top" : ""}`}>{r.rank}</span>}
                            <Cover book={e.book} width={44} />
                            <span className="book-row__body">
                              <span className="book-row__title" style={{ display: "block" }}>{e.book.title}</span>
                              <span className="book-row__sub" style={{ display: "block" }}>{sub}</span>
                            </span>
                            {r && <ScoreChip score={r.score} bucket={r.bucket} />}
                          </Link>
                          {!isMe && (!status || status === "want") && <WantButton bookId={e.book_id} compact initialSaved={status === "want"} />}
                        </li>
                      );
                    })}
                  </ol>
                )}
              </>
            )}
          </>
        )}
      </main>
      <TabBar />
    </div>
  );
}
