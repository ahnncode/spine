"use client";

import { MentionText } from "@/components/Mentions";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { RequireAuth, useProfile } from "@/components/Auth";
import { ReadAlongStart } from "@/components/ReadAlongStart";
import { activeFor, useReadAlongs } from "@/components/useReadAlongs";
import { Avatar, displayName } from "@/components/Avatar";
import { Name } from "@/components/Badge";
import { BookActions } from "@/components/BookActions";
import { Cover } from "@/components/Cover";
import { BackIcon } from "@/components/icons";
import { EntryThread } from "@/components/EntryThread";
import { ScoreChip } from "@/components/ScoreChip";
import { NoteText, TagList, VibePill } from "@/components/Social";
import { ThoughtsEditor } from "@/components/ThoughtsEditor";
import { TabBar } from "@/components/TabBar";
import type { Book } from "@/lib/books";
import { openLibraryHasCover } from "@/components/useCoverBackfill";
import { findAppleCover } from "@/lib/applecovers";
import {
  fixBookDetails, setBookCover, saveFinishedOn,
  fetchCheckins, type Checkin,
  bookStats, fetchBook, fetchFollowing, fetchProfiles, fetchShelf, friendsOnBook, predictedScore,
  rankEntries, tasteMatches, type Entry, type Match, type Profile, type ScoredEntry,
} from "@/lib/data";
import { GENRE_BY_KEY } from "@/lib/genres";
import { BookSummary } from "@/components/BookSummary";
import { ElsewhereRatings } from "@/components/ElsewhereRatings";
import { FinishedPicker } from "@/components/FinishedPicker";
import { CheckInSheet } from "@/components/CheckInSheet";
import { formatScore } from "@/lib/ranking";
import { BookSkeleton } from "@/components/Skeleton";
import { useCoverTint } from "@/components/useCoverTint";
import { fixBookYear } from "@/lib/bookYear";

export function BookPage() {
  return (
    <RequireAuth>
      <Inner />
    </RequireAuth>
  );
}

interface Social {
  stats: { avg: number | null; readers: number };
  predicted: { score: number | null; basis: number };
  friends: ScoredEntry[];
  profiles: Map<string, Profile>;
  matches: Map<string, Match>;
}

function Inner() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [book, setBook] = useState<Book | null | undefined>(undefined);
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [social, setSocial] = useState<Social | null>(null);
  const [thread, setThread] = useState<string | null>(null);
  const [dating, setDating] = useState(false);
  // Opens the first check-in right after you start a book (also via ?checkin=1).
  const [checkIn, setCheckIn] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of the URL
    if (new URLSearchParams(window.location.search).get("checkin") === "1") setCheckIn(true);
  }, []);
  const [diary, setDiary] = useState<Checkin[]>([]);
  const [editing, setEditing] = useState(false);
  const [fixing, setFixing] = useState(false);
  const [starting, setStarting] = useState(false);
  const { profile: me } = useProfile();
  const { list: readAlongs, people: raPeople } = useReadAlongs();
  const readAlong = book ? activeFor(readAlongs, book.id, me?.id) : undefined;

  const loadShelf = useCallback(async () => setEntries(await fetchShelf()), []);

  useEffect(() => {
    let live = true;
    (async () => {
      const [b] = await Promise.all([fetchBook(id), loadShelf()]);
      if (!live) return;
      setBook(b);
      if (!b) return;
      // No picture anywhere yet? Look once in Apple's catalogue.
      if (!b.cover_url && !b.cover_checked) {
        (b.cover_id ? openLibraryHasCover(b.cover_id) : Promise.resolve(false))
          .then(async (hasArt) => {
            const url = hasArt ? null : await findAppleCover(b.title, b.author);
            await setBookCover(b.id, url);
            if (url && live) setBook((cur) => (cur ? { ...cur, cover_url: url } : cur));
          })
          .catch(() => {});
      }
      const following = await fetchFollowing();
      const [stats, predicted, friends] = await Promise.all([bookStats(id), predictedScore(id), friendsOnBook(id, following)]);
      const ids = friends.map((f) => f.user_id);
      const [profiles, matches] = await Promise.all([fetchProfiles(ids), tasteMatches(ids)]);
      if (live) setSocial({ stats, predicted, friends, profiles, matches });
      fetchCheckins(id).then((c) => live && setDiary(c)).catch(() => {});
    })().catch(() => live && setBook((b) => b ?? null));
    return () => {
      live = false;
    };
  }, [id, loadShelf]);

  const tint = useCoverTint(book);
  const mine = useMemo(() => entries?.find((e) => e.book_id === id) ?? null, [entries, id]);
  const myRanked = useMemo(() => (entries ? rankEntries(entries).find((e) => e.book_id === id) : undefined), [entries, id]);

  // On your shelf with a year that may be a reissue's: check for the original.
  const onShelf = Boolean(mine);
  useEffect(() => {
    if (!book || !onShelf) return;
    let live = true;
    fixBookYear(book).then((y) => {
      if (live && y) setBook((b) => (b ? { ...b, year: y } : b));
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book?.id, onShelf]);

  if (book === null) {
    return (
      <div className="app">
        <main className="screen">
          <div className="empty">
            <p className="h2">We couldn’t find that book</p>
            <Link href="/search" className="btn" style={{ marginTop: 12 }}>Search</Link>
          </div>
        </main>
        <TabBar />
      </div>
    );
  }

  const friends = [...(social?.friends ?? [])].sort(
    (a, b) => (social?.matches.get(b.user_id)?.match ?? -1) - (social?.matches.get(a.user_id)?.match ?? -1),
  );

  return (
    <div className="app">
      <main className="screen" style={{ paddingTop: 0, paddingLeft: 0, paddingRight: 0 }}>
        <div className="book-hero" style={{ ["--tint" as string]: tint ?? "var(--well)", background: tint ? "color-mix(in srgb, var(--tint) var(--tint-mix), var(--ground))" : "var(--well)" }}>
          <div style={{ alignSelf: "stretch" }}>
            <button className="icon-btn" style={{ background: "color-mix(in srgb, var(--surface) 72%, transparent)" }} aria-label="Back" onClick={() => router.back()}>
              <BackIcon size={20} />
            </button>
          </div>
          {book ? <Cover book={book} width={140} /> : <span className="skeleton" style={{ width: 140, height: 210, borderRadius: "3px 6px 6px 3px" }} aria-hidden="true" />}
        </div>

        {!book && <BookSkeleton />}
        {book && (
          <div className="book-hero__fade" style={{ ["--tint" as string]: tint ?? "transparent" }}>
            <h1 className="h1" style={{ fontSize: 32 }}>{book.title}</h1>
            <p className="muted" style={{ margin: "4px 0 0", fontSize: 14 }}>
              {[book.author, book.year, book.pages ? `${book.pages} pages` : null].filter(Boolean).join(" · ")}
            </p>
            {mine && (
              <button className="link-btn" style={{ fontSize: 12, marginTop: 8, color: "var(--muted)", fontWeight: 500 }} onClick={() => setFixing(true)}>
                Title or author wrong? Fix it
              </button>
            )}
            {book.genres?.length > 0 && (
              <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
                {book.genres.map((g) => GENRE_BY_KEY[g] && (
                  <span key={g} className="pill" style={{ background: GENRE_BY_KEY[g].bg, color: GENRE_BY_KEY[g].fg }}>
                    {GENRE_BY_KEY[g].label}
                  </span>
                ))}
              </div>
            )}

            <BookSummary book={book} />

            {readAlong ? (
              <Link href={`/together/${readAlong.id}`} className="card ra-banner">
                <span className="avatar-stack">
                  {readAlong.members.filter((m) => m.state === "joined" && m.user_id !== me?.id).slice(0, 3).map((m) => (
                    <Avatar key={m.user_id} profile={raPeople.get(m.user_id)} size={30} />
                  ))}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontWeight: 700, fontSize: 15 }}>
                    Reading with {readAlong.members.filter((m) => m.state === "joined" && m.user_id !== me?.id).map((m) => displayName(raPeople.get(m.user_id)).split(" ")[0]).join(", ") || "friends"}
                  </span>
                  <span className="muted" style={{ fontSize: 13 }}>Progress, discussion and the verdict →</span>
                </span>
              </Link>
            ) : (
              <button className="btn btn--quiet btn--block" style={{ marginTop: 16 }} onClick={() => setStarting(true)}>
                Read with friends
              </button>
            )}

            {myRanked ? (
              <>
              <div className="card" style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 14 }}>
                <ScoreChip score={myRanked.score} bucket={myRanked.bucket} size={60} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>Your #{myRanked.rank}</div>
                  <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>
                    {social?.predicted.score != null ? `Readers like you: ${formatScore(social.predicted.score)}` : "Your score"}
                  </div>
                  <button className="link-btn" style={{ fontSize: 13, marginTop: 4, fontWeight: 600 }} aria-expanded={dating} onClick={() => setDating((d) => !d)}>
                    {myRanked.finished_on ? `Finished ${formatDay(myRanked.finished_on)}` : "Add when you finished it"} · {dating ? "done" : "change"}
                  </button>
                </div>
              </div>
              {dating && (
                <div className="card" style={{ marginTop: 8 }}>
                  <FinishedPicker
                    value={myRanked.finished_on}
                    onChange={async (v) => {
                      await saveFinishedOn(myRanked.id, v).catch(() => {});
                      await loadShelf();
                    }}
                  />
                </div>
              )}
              </>
            ) : (
              <div className="card" style={{ marginTop: 16, background: "var(--cobalt)", borderColor: "var(--cobalt)", color: "#fff", display: "flex", alignItems: "center", gap: 14 }}>
                <div className="m score" style={{ width: 60, height: 60, background: "#fff", color: "#1d2ba8", fontSize: 20 }}>
                  {social?.predicted.score != null ? formatScore(social.predicted.score) : "?"}
                </div>
                <div>
                  <div style={{ fontWeight: 600 }}>Your predicted score</div>
                  <div style={{ fontSize: 13, color: "#dde1ff", marginTop: 2, lineHeight: 1.35 }}>
                    {social?.predicted.score != null
                      ? `From ${social.predicted.basis} reader${social.predicted.basis === 1 ? "" : "s"} whose taste matches yours`
                      : "Rank more books and we’ll learn your taste"}
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8, marginTop: 8 }}>
              <div className="card" style={{ padding: "12px 14px" }}>
                <div className="m" style={{ fontSize: 20, fontWeight: 700 }}>
                  {friends.length ? formatScore(friends.reduce((s, f) => s + f.score, 0) / friends.length) : "—"}
                </div>
                <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>Friends · {friends.length} ranked</div>
              </div>
              <div className="card" style={{ padding: "12px 14px" }}>
                <div className="m" style={{ fontSize: 20, fontWeight: 700 }}>
                  {social?.stats.avg != null ? formatScore(social.stats.avg) : "—"}
                </div>
                <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                  Everyone · {social?.stats.readers ?? 0} {social?.stats.readers === 1 ? "rank" : "ranks"}
                </div>
              </div>
            </div>
            <ElsewhereRatings book={book} />

            {friends.length > 0 && (
              <>
                <h2 className="h2" style={{ margin: "20px 0 4px" }}>Friends who read it</h2>
                {friends.map((f) => {
                  const p = social?.profiles.get(f.user_id);
                  const m = social?.matches.get(f.user_id);
                  const diff = myRanked ? f.score - myRanked.score : null;
                  return (
                    <div key={f.id} style={{ borderBottom: "1px solid var(--line)", padding: "10px 0" }}>
                      <div className="person-row" style={{ borderBottom: 0, padding: 0 }}>
                        <Avatar profile={p} size={36} link />
                        <div className="person-row__body">
                          <Link href={p?.username ? `/u/${p.username}` : "#"} className="name" style={{ textDecoration: "none" }}><Name profile={p} /></Link>
                          <span className="muted" style={{ fontSize: 12 }}>
                            {[m?.match != null ? `${m.match}% taste match` : null, `#${f.overall_rank} on their shelf`,
                              diff != null && Math.abs(diff) >= 2 ? (diff > 0 ? "liked it more" : "liked it less") : null]
                              .filter(Boolean).join(" · ")}
                          </span>
                        </div>
                        <ScoreChip score={f.score} bucket={f.bucket} size={38} />
                      </div>
                      {(f.tags?.length > 0 || f.note) && (
                        <div style={{ marginTop: 8, paddingLeft: 48, display: "flex", flexDirection: "column", gap: 6 }}>
                          <TagList tags={f.tags ?? []} max={3} />
                          {f.note && <NoteText note={f.note} spoiler={f.note_spoiler} clamp={3} />}
                        </div>
                      )}
                      <div style={{ paddingLeft: 48 }}>
                        <button className="btn btn--ghost" style={{ minHeight: 36, padding: 0, fontSize: 13, color: "var(--cobalt-ink)" }} onClick={() => setThread(f.id)}>
                          Hearts &amp; comments →
                        </button>
                      </div>
                    </div>
                  );
                })}
              </>
            )}

            {mine?.status === "ranked" && (
              <section style={{ marginTop: 20 }}>
                <h2 className="h2">Your thoughts</h2>
                {editing ? (
                  <div style={{ marginTop: 12 }}>
                    <ThoughtsEditor entry={mine} genres={book?.genres} compact onSaved={async () => { await loadShelf(); setEditing(false); }} onDateSaved={loadShelf} />
                  </div>
                ) : (
                  <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
                    <TagList tags={mine.tags ?? []} />
                    {mine.note ? <NoteText note={mine.note} spoiler={mine.note_spoiler} mine /> : !mine.tags?.length && <p className="muted" style={{ margin: 0, fontSize: 14 }}>Nothing yet.</p>}
                    <div style={{ display: "flex", gap: 8 }}>
                      <button className="btn btn--quiet" style={{ minHeight: 40, fontSize: 14 }} onClick={() => setEditing(true)}>
                        {mine.note || mine.tags?.length ? "Edit" : "Add your thoughts"}
                      </button>
                      <button className="btn btn--ghost" style={{ minHeight: 40, fontSize: 14 }} onClick={() => setThread(mine.id)}>Hearts &amp; comments</button>
                    </div>
                  </div>
                )}
              </section>
            )}

            {diary.length > 0 && (
              <section style={{ marginTop: 20 }}>
                <h2 className="h2">Your reading diary</h2>
                <ol style={{ listStyle: "none", margin: "8px 0 0", padding: 0 }}>
                  {diary.map((c) => (
                    <li key={c.id} style={{ display: "flex", gap: 12, padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
                      <span className="m muted" style={{ fontSize: 12, width: 52, flexShrink: 0, paddingTop: 2 }}>
                        {new Date(`${c.checked_on}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                      </span>
                      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-start" }}>
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          {c.progress_pct != null && <span className="m" style={{ fontSize: 13, fontWeight: 700 }}>{c.progress_pct}%</span>}
                          <VibePill vibe={c.vibe} />
                        </div>
                        {c.note && <p className="note" style={{ fontSize: 14 }}><MentionText text={c.note} /></p>}
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
            )}

            <div style={{ marginTop: 24 }}>
              <BookActions bookId={id} entry={mine} onChange={loadShelf} showRemove={Boolean(mine)} onStartedReading={() => setCheckIn(true)} />
            </div>
          </div>
        )}
      </main>
      {thread && <EntryThread entryId={thread} onClose={() => setThread(null)} />}
      {fixing && book && (
        <FixDetails book={book} onClose={() => setFixing(false)} onSaved={(title, author) => { setBook({ ...book, title, author }); setFixing(false); }} />
      )}
      {starting && book && <ReadAlongStart book={book} onClose={() => setStarting(false)} />}
      {checkIn && mine?.status === "reading" && (
        <CheckInSheet entry={mine} onClose={() => setCheckIn(false)} onDone={async () => { await loadShelf(); setCheckIn(false); }} />
      )}
      <TabBar />
    </div>
  );
}

function FixDetails({ book, onClose, onSaved }: { book: Book; onClose: () => void; onSaved: (title: string, author: string | null) => void }) {
  const [title, setTitle] = useState(book.title);
  const [author, setAuthor] = useState(book.author ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const ok = await fixBookDetails(book.id, title, author);
      if (!ok) {
        setError("Other readers have this book too, so its details can’t be changed here.");
        setBusy(false);
        return;
      }
      onSaved(title.trim(), author.trim() || null);
    } catch {
      setError("Couldn’t save that. Try again.");
      setBusy(false);
    }
  }

  return (
    <div className="sheet-backdrop" onClick={() => !busy && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Fix book details" onClick={(e) => e.stopPropagation()}>
        <div className="sheet__grab" />
        <h2 className="g" style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: "-0.01em" }}>Fix book details</h2>
        <p className="muted" style={{ margin: "4px 0 0", fontSize: 13 }}>Book info comes from Open Library, which sometimes has typos.</p>
        <div className="field" style={{ marginTop: 16 }}>
          <label htmlFor="fix-title">Title</label>
          <input id="fix-title" className="input" value={title} maxLength={500} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="field" style={{ marginTop: 16 }}>
          <label htmlFor="fix-author">Author</label>
          <input id="fix-author" className="input" value={author} maxLength={300} onChange={(e) => setAuthor(e.target.value)} />
        </div>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn btn--block" style={{ marginTop: 20 }} disabled={busy || !title.trim()} onClick={save}>{busy ? "Saving…" : "Save"}</button>
      </div>
    </div>
  );
}

function formatDay(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
