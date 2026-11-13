import { dedupeKey, sanitizeBook, type Book, type BookInput } from "./books";
import type { ImportedBook } from "./goodreads";
import { startingOrder } from "./goodreads";
import type { BadgeStatus } from "./badges";
import { BUCKET_ORDER, bucketForScore, bucketScores, keyForIndex, renumber, type Bucket } from "./ranking";
import { findAppleAuthor } from "./applecovers";
import { authorToCheck, lookup } from "./openlibrary";
import { rankedInApp } from "./stats";
import { supabase } from "./supabase";
import { isRemoving } from "./toast";

export type Status = "ranked" | "want" | "unsorted" | "reading" | "paused" | "dropped";

/** Read, listened (audiobook), or both. */
export type Format = "read" | "listen" | "both";
export type ProgressUnit = "chapter" | "page" | "percent";

/** Short label for each shelf state, as shown on pills. */
export const STATUS_LABEL: Record<Status, string> = {
  ranked: "Ranked",
  want: "Saved",
  reading: "Reading",
  unsorted: "To rank",
  paused: "Put aside",
  dropped: "Didn’t finish",
};
export const isListened = (f: Format | null | undefined) => f === "listen" || f === "both";

export interface Entry {
  id: string;
  user_id: string;
  book_id: string;
  status: Status;
  bucket: Bucket | null;
  sort_key: number | null;
  needs_sort: boolean;
  compare_count: number;
  stars: number | null;
  finished_on: string | null;
  started_on: string | null;
  ranked_at: string | null;
  progress_pct: number | null;
  /** How this book's progress is tracked: chapter (default), page or percent. */
  progress_unit?: ProgressUnit;
  progress_chapter?: number | null;
  chapter_total?: number | null;
  last_checkin_on: string | null;
  /** A score you set yourself (your first few books); others fill in around it. */
  manual_score: number | null;
  /** Your thoughts: a short review, quick tags, and whether it spoils the book. */
  note: string | null;
  tags: string[];
  note_spoiler: boolean;
  /** How you took it in. Doesn't affect ranking. */
  format: Format;
  /** Put aside or dropped: when, why, and an optional note. */
  stopped_at?: string | null;
  stop_reason?: string | null;
  stop_note?: string | null;
  stop_note_spoiler?: boolean;
  /** A drop posts to the feed unless turned off. */
  stop_shared?: boolean;
  /** Ranked after being dropped: stays true so stats still know. */
  did_not_finish?: boolean;
  /** Picked back up after dropping it ("giving it another go"). */
  retrying?: boolean;
  source: string;
  created_at: string;
  updated_at?: string;
  book: Book;
}

/** A ranked entry with its overall rank and score worked out. */
export interface RankedEntry extends Entry {
  rank: number;
  score: number;
  bucket: Bucket;
  sort_key: number;
}

export interface Profile {
  id: string;
  username: string | null;
  display_name: string | null;
  is_private: boolean;
  yearly_goal: number | null;
  /** When they joined; joining in readread's first year earns the Early Adopter mark. */
  created_at?: string | null;
  /** A short status line anyone can see. */
  bio?: string | null;
  /** Chosen profile picture: an icon on a color (both null = initials). */
  avatar_icon?: string | null;
  avatar_color?: string | null;
  /** Visible on the web to people without an account. */
  public_profile?: boolean;
}

const ENTRY_SELECT =
  "id, user_id, book_id, status, bucket, sort_key, needs_sort, compare_count, stars, finished_on, started_on, ranked_at, progress_pct, progress_unit, progress_chapter, chapter_total, last_checkin_on, manual_score, note, tags, note_spoiler, format, stopped_at, stop_reason, stop_note, stop_note_spoiler, stop_shared, did_not_finish, retrying, source, created_at, updated_at, book:books(*)";

export async function myId(): Promise<string> {
  const { data } = await supabase().auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new Error("Not signed in");
  return id;
}

/** Today's date (or `daysAgo` before it) as YYYY-MM-DD, in the reader's time zone. */
export function today(daysAgo = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/* ------------------------------ Shelf reads ------------------------------ */

/** Every shelf entry for a reader (yours by default). Private shelves come back empty. */
export async function fetchShelf(userId?: string): Promise<Entry[]> {
  const uid = userId ?? (await myId());
  const all: Entry[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase()
      .from("shelf_entries")
      .select(ENTRY_SELECT)
      .eq("user_id", uid)
      .range(from, from + 999);
    if (error) throw error;
    all.push(...((data as unknown as Entry[]) || []));
    if (!data || data.length < 1000) break;
  }
  // Books removed a moment ago (still inside their Undo window) stay hidden.
  return userId ? all : all.filter((e) => !isRemoving(e.id));
}

/** Ranked entries in overall order (loved → fine → not for me), with scores. */
export function rankEntries(entries: Entry[]): RankedEntry[] {
  const out: RankedEntry[] = [];
  for (const bucket of BUCKET_ORDER) {
    const inBucket = entries
      .filter((e) => e.status === "ranked" && e.bucket === bucket && e.sort_key !== null)
      .sort((a, b) => (b.sort_key as number) - (a.sort_key as number));
    const scores = bucketScores(
      inBucket.map((e) => (e.manual_score == null ? null : Number(e.manual_score))),
      bucket,
    );
    inBucket.forEach((e, i) =>
      out.push({ ...e, bucket, sort_key: e.sort_key as number, score: scores[i], rank: 0 }),
    );
  }
  out.forEach((e, i) => (e.rank = i + 1));
  return out;
}

export function bucketList(entries: Entry[], bucket: Bucket, excludeBookId?: string): RankedEntry[] {
  return rankEntries(entries).filter((e) => e.bucket === bucket && e.book_id !== excludeBookId);
}

/* ------------------------------ Books ------------------------------------ */

/** Make sure each book exists in the catalog; returns ids keyed by dedupe key. */
export async function ensureBooks(inputs: BookInput[]): Promise<Map<string, string>> {
  const rows = new Map<string, BookInput & { dedupe_key: string }>();
  for (const raw of inputs) {
    const b = sanitizeBook(raw);
    const key = dedupeKey(b.title, b.author);
    if (!rows.has(key)) rows.set(key, { ...b, dedupe_key: key });
  }
  const ids = new Map<string, string>();
  // Books we already have under another spelling, an old merged title, or
  // the same Open Library work: use those instead of making a second copy.
  const all = [...rows.values()];
  for (let i = 0; i < all.length; i += 200) {
    const chunk = all.slice(i, i + 200);
    const { data } = await supabase().rpc("resolve_books", {
      p_keys: chunk.map((c) => c.dedupe_key),
      p_works: chunk.map((c) => c.ol_work_key ?? null),
    });
    for (const r of (data ?? []) as { dedupe_key: string; book_id: string | null }[]) if (r.book_id) ids.set(r.dedupe_key, r.book_id);
  }
  const list = all.filter((b) => !ids.has(b.dedupe_key));
  // Chunks of 80 keep the lookup URL well under server limits, even with long titles.
  for (let i = 0; i < list.length; i += 80) {
    const chunk = list.slice(i, i + 80);
    const { error } = await supabase()
      .from("books")
      .upsert(chunk, { onConflict: "dedupe_key", ignoreDuplicates: true, defaultToNull: false });
    if (error) throw error;
    const { data, error: selErr } = await supabase()
      .from("books")
      .select("id, dedupe_key")
      .in("dedupe_key", chunk.map((c) => c.dedupe_key));
    if (selErr) throw selErr;
    for (const r of data || []) ids.set(r.dedupe_key, r.id);
  }
  return ids;
}

/** Wait at most `ms` for a promise; null if it's slower or fails. */
function within<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([p.catch(() => null), new Promise<null>((r) => setTimeout(() => r(null), ms))]);
}

export async function ensureBook(raw: BookInput): Promise<string> {
  let input = raw;
  // Authors Open Library lists in another script, or in an uncertain order:
  // use the English spelling from Apple's catalogue when it confirms one.
  const spellings = authorToCheck(raw);
  if (spellings) {
    const english = await within(findAppleAuthor(raw.title, spellings), 2500);
    if (english) input = { ...raw, author: english };
  }
  const ids = await ensureBooks([input]);
  const id = ids.get(dedupeKey(input.title, input.author));
  if (!id) throw new Error("Couldn't save that book");
  if (input.genres?.length) {
    // A book first added by an import may be missing art or genres this search has.
    await enrichBook(id, input).catch(() => {});
  } else {
    // Quick search results leave out subjects (they're slow to fetch), so fill
    // in genres with a full lookup in the background.
    void lookup(input.title, input.author)
      .then((found) => enrichBook(id, found ? { ...found, cover_id: input.cover_id ?? found.cover_id } : input))
      .catch(() => {});
  }
  return id;
}

export async function fetchBook(id: string): Promise<Book | null> {
  const { data, error } = await supabase().from("books").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as Book | null;
}

export async function fetchBooks(ids: string[]): Promise<Book[]> {
  if (!ids.length) return [];
  const { data, error } = await supabase().from("books").select("*").in("id", ids);
  if (error) throw error;
  return (data as Book[]) || [];
}

/** A book's "about" blurb, if we've looked it up (`checked`: when we last looked). */
export async function fetchBookDescription(bookId: string): Promise<{ description: string | null; source: string | null; checked: string } | null> {
  const { data, error } = await supabase()
    .from("book_descriptions")
    .select("description, source, checked_at")
    .eq("book_id", bookId)
    .maybeSingle();
  if (error) throw error;
  return data ? { description: data.description, source: data.source, checked: data.checked_at } : null;
}

export async function saveBookDescription(bookId: string, text: string | null, source: "openlibrary" | "apple" | null): Promise<void> {
  const { error } = await supabase().rpc("set_book_description", { p_book: bookId, p_text: text, p_source: source });
  if (error) throw error;
}

/** Fill in cover, genres and year on a catalog book (only where missing). */
export async function enrichBook(id: string, raw: BookInput): Promise<void> {
  const b = sanitizeBook(raw);
  const { error } = await supabase().rpc("enrich_book", {
    p_book: id,
    p_cover: b.cover_id ?? null,
    p_genres: b.genres ?? [],
    p_year: b.year ?? null,
    p_pages: b.pages ?? null,
    p_work: b.ol_work_key ?? null,
  });
  if (error) throw error;
}

/** Pick a genre for a book Open Library couldn't place (only works while it has none). */
export async function setBookGenre(bookId: string, genre: string): Promise<boolean> {
  const { data, error } = await supabase().rpc("set_book_genre", { p_book: bookId, p_genre: genre });
  if (error) throw error;
  return Boolean(data);
}

/** Save backup cover art for a book (null records that there isn't any). */
/** Read, listened or both, for one shelf entry. */
export async function setFormat(entryId: string, format: Format): Promise<void> {
  const { error } = await supabase().from("shelf_entries").update({ format }).eq("id", entryId);
  if (error) throw error;
}

export async function setBookCover(bookId: string, url: string | null): Promise<void> {
  const { error } = await supabase().rpc("set_book_cover", { p_book: bookId, p_url: url });
  if (error) throw error;
}

/** Replace an author name written in another script with its English spelling. */
export async function setBookAuthor(bookId: string, author: string): Promise<boolean> {
  const { data, error } = await supabase().rpc("set_book_author", { p_book: bookId, p_author: author });
  if (error) throw error;
  return Boolean(data);
}

/** Correct a book's title/author (only if nobody else has it, or you fixed it before). */
export async function fixBookDetails(bookId: string, title: string, author: string): Promise<boolean> {
  const { data, error } = await supabase().rpc("fix_book_details", { p_book: bookId, p_title: title, p_author: author });
  if (error) throw error;
  return Boolean(data);
}

/* ------------------------------ Shelf writes ----------------------------- */

export async function addToWant(bookId: string): Promise<void> {
  const uid = await myId();
  const { error } = await supabase()
    .from("shelf_entries")
    .upsert(
      { user_id: uid, book_id: bookId, status: "want", source: "app" },
      { onConflict: "user_id,book_id", ignoreDuplicates: true },
    );
  if (error) throw error;
}

/** Add books you've read but haven't ranked yet (they wait in "To rank"). */
export async function addToRank(bookIds: string[]): Promise<void> {
  if (!bookIds.length) return;
  const uid = await myId();
  const { error } = await supabase()
    .from("shelf_entries")
    .upsert(
      bookIds.map((book_id) => ({ user_id: uid, book_id, status: "unsorted", source: "app" })),
      { onConflict: "user_id,book_id", ignoreDuplicates: true },
    );
  if (error) throw error;
}

/** Mark a book as currently reading (from nothing, or from want-to-read). */
export async function startReading(bookId: string): Promise<void> {
  const uid = await myId();
  // Never turn a ranked book back into "reading" — that would drop its ranking.
  const { data: current } = await supabase().from("shelf_entries").select("status").eq("user_id", uid).eq("book_id", bookId).maybeSingle();
  if (current?.status === "ranked" || current?.status === "reading") return;
  // Put aside or dropped: carry on where they left off instead of starting over.
  if (current?.status === "paused" || current?.status === "dropped") {
    const { data: row } = await supabase().from("shelf_entries").select("id").eq("user_id", uid).eq("book_id", bookId).single();
    return resumeBook(row!.id, { startOver: false, fromDrop: current.status === "dropped" });
  }
  const { error } = await supabase()
    .from("shelf_entries")
    .upsert(
      { user_id: uid, book_id: bookId, status: "reading", started_on: today(), bucket: null, sort_key: null },
      { onConflict: "user_id,book_id" },
    );
  if (error) throw error;
}

/** Put a book you're reading aside: progress is kept; the reason and note stay private. */
export async function pauseBook(entryId: string, opts: { reason?: string | null; note?: string | null } = {}): Promise<void> {
  const { error } = await supabase()
    .from("shelf_entries")
    .update({
      status: "paused",
      stopped_at: new Date().toISOString(),
      stop_reason: opts.reason || null,
      stop_note: opts.note?.trim() ? opts.note.trim().slice(0, 280) : null,
      stop_note_spoiler: false,
      stop_shared: false,
      retrying: false,
    })
    .eq("id", entryId);
  if (error) throw error;
}

/** Didn't finish it: progress is kept, it stays off the ranked list, and it can post to the feed. */
export async function dropBook(
  entryId: string,
  opts: { reason?: string | null; note?: string | null; spoiler?: boolean; shared?: boolean } = {},
): Promise<void> {
  const { error } = await supabase()
    .from("shelf_entries")
    .update({
      status: "dropped",
      stopped_at: new Date().toISOString(),
      stop_reason: opts.reason || null,
      stop_note: opts.note?.trim() ? opts.note.trim().slice(0, 280) : null,
      stop_note_spoiler: Boolean(opts.spoiler),
      stop_shared: opts.shared ?? true,
      retrying: false,
    })
    .eq("id", entryId);
  if (error) throw error;
}

/**
 * Back to Reading from put aside or didn't finish: carry on from where they
 * stopped, or start over (old check-ins stay in the diary either way).
 */
export async function resumeBook(entryId: string, opts: { startOver?: boolean; fromDrop?: boolean; share?: boolean } = {}): Promise<void> {
  const fields: Record<string, unknown> = {
    status: "reading",
    stopped_at: null,
    stop_reason: null,
    stop_note: null,
    stop_note_spoiler: false,
    // "Giving it another go" posts only when they chose to share it.
    retrying: Boolean(opts.fromDrop && opts.share),
  };
  if (opts.startOver) Object.assign(fields, { progress_pct: null, progress_chapter: 0, started_on: today() });
  const { error } = await supabase().from("shelf_entries").update(fields).eq("id", entryId);
  if (error) throw error;
}

/**
 * A reading check-in: "I read some of this today", optionally with progress.
 * One per book per day (a second one updates the first).
 */
export async function checkIn(
  bookId: string,
  progressPct: number | null,
  extras: {
    note?: string | null;
    vibe?: string | null;
    unit?: ProgressUnit;
    chapter?: number | null;
    chapterTotal?: number | null;
  } = {},
): Promise<void> {
  const uid = await myId();
  const day = today();
  const pct = progressPct == null ? null : Math.max(0, Math.min(100, Math.round(progressPct)));
  const note = extras.note?.trim() ? extras.note.trim().slice(0, 280) : null;
  const total = extras.chapterTotal && extras.chapterTotal > 0 ? Math.min(999, Math.round(extras.chapterTotal)) : null;
  const chapter = extras.chapter != null ? Math.max(0, Math.min(total ?? 999, Math.round(extras.chapter))) : null;
  const { error } = await supabase()
    .from("reading_checkins")
    .upsert(
      { user_id: uid, book_id: bookId, checked_on: day, progress_pct: pct, chapter, chapter_total: chapter != null ? total : null, note, vibe: extras.vibe ?? null },
      { onConflict: "user_id,book_id,checked_on" },
    );
  if (error) throw error;
  const fields: Record<string, unknown> = { last_checkin_on: day };
  if (pct != null) fields.progress_pct = pct;
  if (extras.unit) fields.progress_unit = extras.unit;
  if (chapter != null) fields.progress_chapter = chapter;
  if (total != null) fields.chapter_total = total;
  const { error: e2 } = await supabase().from("shelf_entries").update(fields).eq("user_id", uid).eq("book_id", bookId);
  if (e2) throw e2;
}

/** Share a book's chapter count with other readers, if nobody has yet. */
export async function suggestChapters(bookId: string, chapters: number): Promise<void> {
  await supabase().rpc("suggest_book_chapters", { p_book: bookId, p_chapters: Math.round(chapters) });
}

/** Days you checked in on any book (the past ~14 months is plenty for streaks). */
export async function fetchCheckinDays(): Promise<string[]> {
  const uid = await myId();
  const since = new Date(Date.now() - 1000 * 60 * 60 * 24 * 430).toISOString().slice(0, 10);
  const { data, error } = await supabase()
    .from("reading_checkins")
    .select("checked_on")
    .eq("user_id", uid)
    .gte("checked_on", since)
    .limit(5000);
  if (error) throw error;
  return (data || []).map((r) => r.checked_on as string);
}

/* ------------------------------ Reader types ----------------------------- */

/** A reader's saved type, as others see it. pcts = Range, Lens, Rhythm, Bar (0–100 toward W, H, F, E). */
export interface StoredReaderType {
  user_id: string;
  code: string;
  pcts: number[];
  drive: string;
  wing: string | null;
  book_count: number;
}

/** Saved types for these readers (private or blocked readers are left out). */
export async function fetchReaderTypes(ids: string[]): Promise<StoredReaderType[]> {
  if (!ids.length) return [];
  const { data, error } = await supabase()
    .from("reader_types")
    .select("user_id, code, pcts, drive, wing, book_count")
    .in("user_id", ids);
  if (error) throw error;
  return (data as StoredReaderType[]) || [];
}

export async function saveMyReaderType(t: Omit<StoredReaderType, "user_id">): Promise<void> {
  const uid = await myId();
  const { error } = await supabase()
    .from("reader_types")
    .upsert({ user_id: uid, ...t, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) throw error;
}

/**
 * Every reader type you've had, oldest first (your current one included).
 * Each one earns its profile-picture icon.
 */
export async function fetchMyTypeCodes(): Promise<string[]> {
  const uid = await myId();
  const [hist, now] = await Promise.all([
    supabase().from("reader_type_history").select("code, recorded_at").eq("user_id", uid).order("recorded_at", { ascending: true }).limit(500),
    supabase().from("reader_types").select("code").eq("user_id", uid).limit(1),
  ]);
  const codes = ((hist.data as Array<{ code: string }> | null) ?? []).map((r) => r.code);
  const current = (now.data as Array<{ code: string }> | null)?.[0]?.code;
  if (current) codes.push(current);
  return [...new Set(codes)];
}

/**
 * How many books you've put down part-way: moved from reading back to saved,
 * or removed while reading. Null if the history can't be read.
 */
export async function fetchAbandonedCount(): Promise<number | null> {
  const uid = await myId();
  const { count, error } = await supabase()
    .from("shelf_events")
    .select("id", { count: "exact", head: true })
    .eq("user_id", uid)
    .eq("from_status", "reading")
    .or("to_status.eq.want,event.eq.removed");
  return error ? null : count ?? 0;
}

export async function moveToWant(entryId: string): Promise<void> {
  const { error } = await supabase()
    .from("shelf_entries")
    .update({ status: "want", started_on: null })
    .eq("id", entryId);
  if (error) throw error;
}

export async function removeEntry(entryId: string): Promise<void> {
  const { error } = await supabase().from("shelf_entries").delete().eq("id", entryId);
  if (error) throw error;
}

/**
 * Save a placement: the book goes into `bucket` at `index` of that bucket's
 * list (best first, without the book itself). Renumbers the bucket if the
 * neighbours' keys are too close to split.
 */
export async function placeBook(opts: {
  bookId: string;
  bucket: Bucket;
  index: number;
  list: RankedEntry[];
  existing: Entry | null;
  /** A score set by hand (first few books only). */
  manualScore?: number | null;
  /** When they finished it (null: don't remember). Left out: keep what's saved, or today. */
  finishedOn?: string | null;
  /** Leave it flagged for Sharpen (quick-rated books are only roughly placed). */
  needsSort?: boolean;
  /** Backlog rating: don't post to friends' feeds (dates it by when it was read). */
  quiet?: boolean;
}): Promise<{ sortKey: number; renumbered: boolean }> {
  const uid = await myId();
  const { bookId, bucket, index, existing } = opts;
  const list = opts.list;
  let key = keyForIndex(list.map((e) => e.sort_key), index);
  const renumbered = key === null;

  if (key === null) {
    const keys = renumber(list.length);
    await Promise.all(
      list.map((e, i) => supabase().from("shelf_entries").update({ sort_key: keys[i] }).eq("id", e.id)),
    );
    key = keyForIndex(keys, index) as number;
  }

  const wasRanked = existing?.status === "ranked";
  const row = {
    user_id: uid,
    book_id: bookId,
    status: "ranked" as const,
    bucket,
    sort_key: key,
    needs_sort: opts.needsSort ?? false,
    // Re-ranking by head-to-head replaces any score set by hand.
    manual_score: opts.manualScore ?? null,
    finished_on: opts.finishedOn !== undefined ? opts.finishedOn : existing?.finished_on ?? today(),
    started_on: existing?.started_on ?? null,
    // Ranked after dropping it ("rank it anyway"): stats still know it wasn't finished.
    ...(existing?.status === "dropped" ? { did_not_finish: true } : {}),
    // Finishing a book that was put aside: it's done, so the pause is over.
    ...(existing?.status === "paused" ? { stopped_at: null, stop_reason: null, stop_note: null } : {}),
    ranked_at: wasRanked
      ? existing?.ranked_at ?? new Date().toISOString()
      : opts.quiet
        ? existing?.finished_on ? `${existing.finished_on}T12:00:00Z` : "2000-01-01T00:00:00Z"
        : new Date().toISOString(),
    source: existing?.source ?? "app",
  };
  const { error } = await supabase().from("shelf_entries").upsert(row, { onConflict: "user_id,book_id" });
  if (error) throw error;
  return { sortKey: key, renumbered };
}

/**
 * Your top picks, best first, become the top of Loved in that order. You chose
 * the order, so they count as settled (no longer rough).
 */
export async function setTopPicks(entries: Entry[], bookIds: string[]): Promise<void> {
  const loved = entries.filter((e) => e.status === "ranked" && e.bucket === "loved" && e.sort_key !== null);
  const top = Math.max(0, ...loved.map((e) => e.sort_key as number));
  const byBook = new Map(loved.map((e) => [e.book_id, e]));
  const picks = bookIds.map((id) => byBook.get(id)).filter((e): e is Entry => Boolean(e));
  for (let i = 0; i < picks.length; i++) {
    const { error } = await supabase()
      .from("shelf_entries")
      .update({ sort_key: top + (picks.length - i) * 1024, needs_sort: false, manual_score: null })
      .eq("id", picks[i].id);
    if (error) throw error;
  }
}

/** Put a quick-rated book back the way it was (undo). */
export async function restoreEntry(before: Entry): Promise<void> {
  const { error } = await supabase()
    .from("shelf_entries")
    .update({
      status: before.status, bucket: before.bucket, sort_key: before.sort_key, manual_score: before.manual_score,
      needs_sort: before.needs_sort, ranked_at: before.ranked_at,
    })
    .eq("id", before.id);
  if (error) throw error;
}

/** Where a score out of 10 lands: its tier, and the spot below every book scored higher. */
export function quickSpot(entries: Entry[], bookId: string, score: number): { bucket: Bucket; index: number; list: RankedEntry[] } {
  const bucket = bucketForScore(score);
  const list = bucketList(entries, bucket, bookId);
  const at = list.findIndex((e) => e.score < score);
  return { bucket, index: at === -1 ? list.length : at, list };
}

/**
 * Rank a book by giving it a number instead of head-to-heads. The score is
 * kept as set; the book stays flagged so Sharpen can fine-tune it later.
 */
export async function quickRate(opts: {
  entries: Entry[];
  bookId: string;
  score: number;
  existing: Entry | null;
  quiet?: boolean;
  finishedOn?: string | null;
}): Promise<{ bucket: Bucket; sortKey: number; renumbered: boolean }> {
  const score = Math.round(Math.max(0, Math.min(10, opts.score)) * 10) / 10;
  const { bucket, index, list } = quickSpot(opts.entries, opts.bookId, score);
  const r = await placeBook({
    bookId: opts.bookId, bucket, index, list, existing: opts.existing,
    manualScore: score, needsSort: true, quiet: opts.quiet, finishedOn: opts.finishedOn,
  });
  return { bucket, ...r };
}

/** Swap two neighbours after a quick matchup (lower one won). */
export async function recordMatchup(winner: RankedEntry, loser: RankedEntry): Promise<void> {
  const swap = winner.sort_key < loser.sort_key;
  // If the order flips, any hand-set scores on these two no longer fit; let position decide.
  const anchor = (e: RankedEntry) => (swap ? null : e.manual_score);
  const updates = [
    { id: winner.id, sort_key: swap ? loser.sort_key : winner.sort_key, compare_count: winner.compare_count + 1, needs_sort: winner.compare_count + 1 < 2, manual_score: anchor(winner) },
    { id: loser.id, sort_key: swap ? winner.sort_key : loser.sort_key, compare_count: loser.compare_count + 1, needs_sort: loser.compare_count + 1 < 2, manual_score: anchor(loser) },
  ];
  for (const u of updates) {
    const { id, ...fields } = u;
    const { error } = await supabase().from("shelf_entries").update(fields).eq("id", id);
    if (error) throw error;
  }
}

/* ------------------------------ Import ----------------------------------- */

export async function importGoodreads(
  books: ImportedBook[],
  existing: Entry[],
  onProgress: (fraction: number, label: string) => void,
): Promise<{ added: number; skipped: number; dated: number }> {
  const uid = await myId();
  onProgress(0.05, "Adding books to the catalog…");
  const ids = await ensureBooks(books.map((b) => b.book));
  onProgress(0.6, "Building your shelf…");

  const already = new Set(existing.map((e) => e.book_id));

  // Imported ranked books go below anything already ranked in-app.
  const order = startingOrder(books);
  const keyFor = new Map<string, number>();
  for (const bucket of BUCKET_ORDER) {
    const current = existing.filter((e) => e.status === "ranked" && e.bucket === bucket && e.sort_key !== null);
    const floor = current.length ? Math.min(...current.map((e) => e.sort_key as number)) - 1 : 0;
    order[bucket].forEach((b, i) => keyFor.set(b.key, floor - i));
  }

  const rows = books
    .map((b) => ({ b, bookId: ids.get(b.key) }))
    .filter((x): x is { b: ImportedBook; bookId: string } => Boolean(x.bookId) && !already.has(x.bookId!))
    .map(({ b, bookId }) => ({
      user_id: uid,
      book_id: bookId,
      status: b.status,
      bucket: b.bucket,
      sort_key: b.status === "ranked" ? keyFor.get(b.key) ?? 0 : null,
      needs_sort: b.status === "ranked",
      stars: b.stars ? Math.max(1, Math.min(5, Math.round(b.stars))) : null,
      // A book they stopped wasn't finished, so it doesn't count toward a year's reading.
      finished_on: b.status === "paused" || b.status === "dropped" ? null : b.finishedOn,
      started_on: b.status === "reading" ? today() : null,
      // Date read stands in for when it was ranked, so imports don't flood friends' feeds.
      ranked_at: b.status === "ranked" ? (b.finishedOn ? `${b.finishedOn}T12:00:00Z` : "2000-01-01T00:00:00Z") : null,
      note: b.review,
      format: b.format,
      source: b.source,
      // Stopped books keep the file's date if it has one; imports never post to the feed.
      ...(b.status === "paused" || b.status === "dropped"
        ? { stopped_at: b.finishedOn ? `${b.finishedOn}T12:00:00Z` : null, stop_shared: false }
        : {}),
    }));

  for (let i = 0; i < rows.length; i += 200) {
    const { error } = await supabase()
      .from("shelf_entries")
      .upsert(rows.slice(i, i + 200), { onConflict: "user_id,book_id", ignoreDuplicates: true });
    if (error) throw error;
    onProgress(0.6 + 0.4 * Math.min(1, (i + 200) / rows.length), "Building your shelf…");
  }
  // Books already on your shelf with no finish date get the one from the file,
  // so re-importing fills in dates (Wrapped and yearly stats need them).
  const missing = new Map(existing.filter((e) => !e.finished_on && (e.status === "ranked" || e.status === "unsorted")).map((e) => [e.book_id, e.id]));
  const fills = books
    .map((b) => ({ id: missing.get(ids.get(b.key) ?? ""), date: b.finishedOn }))
    .filter((x): x is { id: string; date: string } => Boolean(x.id && x.date));
  for (const f of fills) {
    await supabase().from("shelf_entries").update({ finished_on: f.date }).eq("id", f.id).is("finished_on", null);
  }
  // Same for audiobooks: books already here (as Read) that the file says you listened to.
  const byBook = new Map(existing.map((e) => [e.book_id, e]));
  const heard = books
    .filter((b) => b.format === "listen")
    .map((b) => byBook.get(ids.get(b.key) ?? ""))
    .filter((e): e is Entry => Boolean(e) && e!.format === "read");
  for (const e of heard) {
    await supabase().from("shelf_entries").update({ format: "listen" }).eq("id", e.id).eq("format", "read");
  }
  onProgress(1, "Done");
  return { added: rows.length, skipped: books.length - rows.length, dated: fills.length };
}

/* ------------------------------ Profiles & follows ----------------------- */

const PROFILE_SELECT = "id, username, display_name, is_private, yearly_goal, created_at, bio, avatar_icon, avatar_color, public_profile";

export async function fetchMyProfile(): Promise<Profile | null> {
  const uid = await myId();
  const { data, error } = await supabase().from("profiles").select(PROFILE_SELECT).eq("id", uid).maybeSingle();
  if (error) throw error;
  return data as Profile | null;
}

export async function updateMyProfile(fields: Partial<Omit<Profile, "id">>): Promise<void> {
  const uid = await myId();
  // Upsert, so an account that somehow has no profile row still gets one.
  const { data, error } = await supabase()
    .from("profiles")
    .upsert({ id: uid, ...fields }, { onConflict: "id", defaultToNull: false })
    .select("id");
  if (error) {
    if (error.code === "23505") throw new Error("That username is taken");
    if (error.code === "42501" && /unlocks/.test(error.message)) throw new Error(error.message);
    if (error.code === "23514") throw new Error("Usernames are 3–20 lowercase letters, numbers or underscores");
    throw new Error(error.message);
  }
  if (!data?.length) throw new Error("Couldn’t save your profile. Try again in a moment.");
}

/** Permanently delete the signed-in account, its shelf and its follows. */
export async function deleteMyAccount(): Promise<void> {
  const { error } = await supabase().rpc("delete_my_account");
  if (error) throw new Error(error.message);
  await supabase().auth.signOut();
}

/** Whether a username is free (or already yours). */
export async function usernameAvailable(username: string): Promise<boolean> {
  const uid = await myId();
  const { data, error } = await supabase().from("profiles").select("id").eq("username", username).maybeSingle();
  if (error) throw error;
  return !data || data.id === uid;
}

export async function fetchProfileByUsername(username: string): Promise<Profile | null> {
  const { data, error } = await supabase()
    .from("profiles")
    .select(PROFILE_SELECT)
    .eq("username", username.toLowerCase())
    .maybeSingle();
  if (error) throw error;
  return data as Profile | null;
}

export async function fetchProfiles(ids: string[]): Promise<Map<string, Profile>> {
  if (!ids.length) return new Map();
  const { data, error } = await supabase().from("profiles").select(PROFILE_SELECT).in("id", ids);
  if (error) throw error;
  return new Map(((data as Profile[]) || []).map((p) => [p.id, p]));
}

export async function searchProfiles(q: string): Promise<Profile[]> {
  const term = q.trim().replace(/[%_,()]/g, "");
  if (term.length < 2) return [];
  const { data, error } = await supabase()
    .from("profiles")
    .select(PROFILE_SELECT)
    .not("username", "is", null)
    .or(`username.ilike.%${term}%,display_name.ilike.%${term}%`)
    .limit(20);
  if (error) throw error;
  return (data as Profile[]) || [];
}

export async function fetchFollowing(userId?: string): Promise<string[]> {
  const uid = userId ?? (await myId());
  const { data, error } = await supabase().from("follows").select("followee_id").eq("follower_id", uid);
  if (error) throw error;
  return (data || []).map((r) => r.followee_id as string);
}

export async function followCounts(userId: string): Promise<{ followers: number; following: number }> {
  const [a, b] = await Promise.all([
    supabase().from("follows").select("*", { count: "exact", head: true }).eq("followee_id", userId),
    supabase().from("follows").select("*", { count: "exact", head: true }).eq("follower_id", userId),
  ]);
  return { followers: a.count ?? 0, following: b.count ?? 0 };
}

/** Whether they follow you back. */
export async function followsMe(userId: string): Promise<boolean> {
  const uid = await myId();
  const { count } = await supabase().from("follows").select("*", { count: "exact", head: true }).eq("follower_id", userId).eq("followee_id", uid);
  return (count ?? 0) > 0;
}

export interface FollowPerson extends Pick<Profile, "id" | "username" | "display_name" | "avatar_icon" | "avatar_color" | "created_at"> {
  i_follow: boolean;
  follows_me: boolean;
}

/** Someone's followers or following: yours, or a mutual follow's. `null` when not allowed. */
export async function followList(userId: string, kind: "followers" | "following"): Promise<FollowPerson[] | null> {
  const { data, error } = await supabase().rpc("follow_list", { p_user: userId, p_kind: kind });
  if (error) throw error;
  const r = data as { allowed: boolean; people: FollowPerson[] };
  return r.allowed ? r.people : null;
}

export async function follow(userId: string): Promise<void> {
  const { error } = await supabase().from("follows").insert({ followee_id: userId });
  if (error && error.code !== "23505") throw error;
}

export async function unfollow(userId: string): Promise<void> {
  const uid = await myId();
  const { error } = await supabase().from("follows").delete().eq("follower_id", uid).eq("followee_id", userId);
  if (error) throw error;
}

/* ------------------------------ Social scores ---------------------------- */

export async function bookStats(bookId: string): Promise<{ avg: number | null; readers: number }> {
  const { data, error } = await supabase().rpc("book_stats", { p_book: bookId });
  if (error) throw error;
  const row = (data as Array<{ avg_score: string | null; readers: number }>)?.[0];
  return { avg: row?.avg_score != null ? Number(row.avg_score) : null, readers: row?.readers ?? 0 };
}

export async function predictedScore(bookId: string): Promise<{ score: number | null; basis: number }> {
  const { data, error } = await supabase().rpc("predicted_score", { p_book: bookId });
  if (error) throw error;
  const row = (data as Array<{ predicted: string | null; basis: number }>)?.[0];
  return { score: row?.predicted != null ? Number(row.predicted) : null, basis: row?.basis ?? 0 };
}

export interface Match {
  match: number | null;
  overlap: number;
}

export async function tasteMatches(userIds: string[]): Promise<Map<string, Match>> {
  if (!userIds.length) return new Map();
  const { data, error } = await supabase().rpc("taste_matches", { p_users: userIds });
  if (error) throw error;
  return new Map(
    ((data as Array<{ user_id: string; match: number | null; overlap: number }>) || []).map((r) => [
      r.user_id,
      { match: r.match, overlap: r.overlap },
    ]),
  );
}

export async function similarReaders(limit = 20): Promise<Array<{ user_id: string; match: number; overlap: number }>> {
  const { data, error } = await supabase().rpc("similar_readers", { p_limit: limit });
  if (error) throw error;
  return (data as Array<{ user_id: string; match: number; overlap: number }>) || [];
}

/** Public readers to follow, even before you share three books with anyone. */
export async function suggestedReaders(limit = 12): Promise<Array<{ user_id: string; shared: number; ranked: number }>> {
  const { data, error } = await supabase().rpc("suggested_readers", { p_limit: limit });
  if (error) throw error;
  return (data as Array<{ user_id: string; shared: number; ranked: number }>) || [];
}

/** Each reader's top three books, for showing taste at a glance. */
export async function topThreeFor(userIds: string[]): Promise<Map<string, Book[]>> {
  const out = new Map<string, Book[]>();
  if (!userIds.length) return out;
  const { data, error } = await supabase()
    .from("ranked_entries")
    .select("user_id, overall_rank, book:books(*)")
    .in("user_id", userIds.slice(0, 50))
    .lte("overall_rank", 3)
    .order("overall_rank");
  if (error) throw error;
  for (const r of (data as unknown as Array<{ user_id: string; book: Book }>) || []) out.set(r.user_id, [...(out.get(r.user_id) ?? []), r.book]);
  return out;
}

export type RecSource = "match" | "genre" | "loved";
export type Rec = { book: Book; predicted: number; basis: number; source: RecSource; genre: string | null };

/**
 * Discover picks. Readers who rank like you come first ("match": predicted is
 * your likely score). Until there are enough of those, the list is topped up
 * with books readers loved in your favorite genres ("genre") and the
 * best-loved books on readread ("loved"); for those, predicted is the
 * readers' average.
 */
export async function recommendations(limit = 20): Promise<Rec[]> {
  const { data, error } = await supabase().rpc("recommendations", { p_limit: limit });
  if (error) throw error;
  const rows = (data as Array<{ book_id: string; predicted: string; basis: number; source?: RecSource; genre?: string | null }>) || [];
  const books = new Map((await fetchBooks(rows.map((r) => r.book_id))).map((b) => [b.id, b]));
  return rows
    .filter((r) => books.has(r.book_id))
    .map((r) => ({ book: books.get(r.book_id)!, predicted: Number(r.predicted), basis: r.basis, source: r.source ?? "match", genre: r.genre ?? null }));
}

/** A friend's ranked entry as the database scores it. */
export interface ScoredEntry {
  id: string;
  user_id: string;
  book_id: string;
  bucket: Bucket;
  score: number;
  overall_rank: number;
  ranked_at: string | null;
  created_at: string;
  source: string | null;
  note: string | null;
  tags: string[];
  note_spoiler: boolean;
  format: Format;
  book: Book;
}

const SCORED_SELECT = "id, user_id, book_id, bucket, score, overall_rank, ranked_at, created_at, source, note, tags, note_spoiler, format, book:books(*)";

/** How the people you follow ranked any of these books (for "you split on" cards). */
export async function friendsRankedOn(bookIds: string[], friendIds: string[]): Promise<ScoredEntry[]> {
  if (!bookIds.length || !friendIds.length) return [];
  const { data, error } = await supabase()
    .from("ranked_entries")
    .select(SCORED_SELECT)
    .in("user_id", friendIds.slice(0, 200))
    .in("book_id", bookIds.slice(0, 200))
    .limit(500);
  if (error) throw error;
  return ((data as unknown as ScoredEntry[]) || []).map((e) => ({ ...e, score: Number(e.score) }));
}

/** Books ranked this month by you and the people you follow, counted per person. */
export async function rankedThisMonth(userIds: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (!userIds.length) return counts;
  const d = new Date();
  const start = new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
  const { data, error } = await supabase()
    .from("ranked_entries")
    .select("user_id, source, ranked_at, created_at")
    .in("user_id", userIds.slice(0, 300))
    .gte("ranked_at", start)
    .limit(2000);
  if (error) throw error;
  for (const r of (data as Array<{ user_id: string; source: string | null; ranked_at: string | null; created_at: string }>) || []) {
    if (rankedInApp(r)) counts.set(r.user_id, (counts.get(r.user_id) ?? 0) + 1);
  }
  return counts;
}

/** People you follow who ranked this book. */
export async function friendsOnBook(bookId: string, friendIds: string[]): Promise<ScoredEntry[]> {
  if (!friendIds.length) return [];
  const { data, error } = await supabase()
    .from("ranked_entries")
    .select(SCORED_SELECT)
    .eq("book_id", bookId)
    .in("user_id", friendIds);
  if (error) throw error;
  return ((data as unknown as ScoredEntry[]) || []).map((e) => ({ ...e, score: Number(e.score) }));
}

export interface Checkin {
  id: string;
  user_id: string;
  book_id: string;
  checked_on: string;
  progress_pct: number | null;
  chapter?: number | null;
  chapter_total?: number | null;
  note: string | null;
  vibe: string | null;
  created_at: string;
  book: Book;
}

const CHECKIN_SELECT = "id, user_id, book_id, checked_on, progress_pct, chapter, chapter_total, note, vibe, created_at, book:books(*)";

export type FeedItem =
  | { kind: "ranked"; at: string; entry: ScoredEntry }
  | { kind: "checkin"; at: string; checkin: Checkin }
  | { kind: "reading"; at: string; entry: Entry }
  | { kind: "dropped"; at: string; entry: Entry };

export function feedUser(item: FeedItem): string {
  return item.kind === "checkin" ? item.checkin.user_id : item.entry.user_id;
}

export async function fetchFeed(
  friendIds: string[] | "everyone",
  opts: { days?: number; limit?: number; exclude?: string } = {},
): Promise<FeedItem[]> {
  if (friendIds !== "everyone" && !friendIds.length) return [];
  const everyone = friendIds === "everyone";
  const since = new Date(Date.now() - 1000 * 60 * 60 * 24 * (opts.days ?? 60)).toISOString();
  const limit = opts.limit ?? 60;
  // "Everyone" leans on row security: only public shelves (and your own) come back.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const who = (q: any) => (everyone ? (opts.exclude ? q.neq("user_id", opts.exclude) : q) : q.in("user_id", friendIds));
  const [ranked, reading, checkins, dropped] = await Promise.all([
    who(supabase().from("ranked_entries").select(SCORED_SELECT))
      .not("ranked_at", "is", null)
      .gte("ranked_at", since)
      .order("ranked_at", { ascending: false })
      // Room for imported rankings, which are filtered out below.
      .limit(limit * 2),
    who(supabase().from("shelf_entries").select(ENTRY_SELECT))
      .eq("status", "reading")
      // Friends' current reads stay up however long they take; strangers' only while fresh.
      .gte("updated_at", everyone ? since : "1970-01-01")
      .order("updated_at", { ascending: false })
      .limit(20),
    who(supabase().from("reading_checkins").select(CHECKIN_SELECT))
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(limit),
    // Books someone didn't finish and chose to share. Pausing never posts.
    who(supabase().from("shelf_entries").select(ENTRY_SELECT))
      .eq("status", "dropped")
      .eq("stop_shared", true)
      .gte("stopped_at", since)
      .order("stopped_at", { ascending: false })
      .limit(20),
  ]);
  if (dropped.error) throw dropped.error;
  if (ranked.error) throw ranked.error;
  if (reading.error) throw reading.error;
  if (checkins.error) throw checkins.error;

  const cis = (checkins.data as unknown as Checkin[]) || [];
  // Only show a check-in when there's something to see: a note, a vibe, or progress.
  const interesting = cis.filter((c) => c.note || c.vibe || c.progress_pct != null);
  const checkedIn = new Set(cis.map((c) => `${c.user_id}:${c.book_id}`));

  const items: FeedItem[] = [
    // Rankings that came in with an import are history, not news (and would
    // flood the feed); a book imported and then finished here still posts.
    ...((ranked.data as unknown as ScoredEntry[]) || []).filter((e) => rankedInApp(e)).slice(0, limit).map((e) => ({
      kind: "ranked" as const,
      at: e.ranked_at as string,
      entry: { ...e, score: Number(e.score), tags: e.tags ?? [] },
    })),
    ...interesting.map((c) => ({ kind: "checkin" as const, at: c.created_at, checkin: c })),
    // "Started reading" only when there's no check-in for that book yet.
    ...((reading.data as unknown as Entry[]) || [])
      .filter((e) => !checkedIn.has(`${e.user_id}:${e.book_id}`))
      .map((e) => ({
        kind: "reading" as const,
        // "Giving it another go" is news from when they picked it back up.
        at: e.retrying && e.updated_at ? e.updated_at : e.started_on ? `${e.started_on}T12:00:00Z` : e.created_at,
        entry: e,
      })),
    ...((dropped.data as unknown as Entry[]) || []).map((e) => ({ kind: "dropped" as const, at: e.stopped_at as string, entry: e })),
  ];
  // A row without a date can't be placed in time; leave it out rather than break the feed.
  const dated = items.filter((i) => typeof i.at === "string");
  dated.sort((a, b) => b.at.localeCompare(a.at));
  if (!everyone) return dated;
  // Strangers: a few posts each, so one busy reader doesn't fill the page.
  const per = new Map<string, number>();
  return dated.filter((i) => {
    const u = i.kind === "checkin" ? i.checkin.user_id : i.entry.user_id;
    per.set(u, (per.get(u) ?? 0) + 1);
    return (per.get(u) ?? 0) <= 3;
  });
}

/** Check-ins on one book (yours or a friend's), newest first, for the reading diary. */
export async function fetchCheckins(bookId: string, userId?: string): Promise<Checkin[]> {
  const uid = userId ?? (await myId());
  const { data, error } = await supabase()
    .from("reading_checkins")
    .select(CHECKIN_SELECT)
    .eq("user_id", uid)
    .eq("book_id", bookId)
    .order("checked_on", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data as unknown as Checkin[]) || [];
}

/* ------------------------------ Thoughts --------------------------------- */

export async function saveThoughts(
  entryId: string,
  t: { note: string | null; tags: string[]; spoiler: boolean; finishedOn?: string | null },
): Promise<void> {
  const fields: Record<string, unknown> = {
    note: t.note?.trim() ? t.note.trim().slice(0, 2000) : null,
    tags: t.tags.slice(0, 6),
    note_spoiler: Boolean(t.note?.trim()) && t.spoiler,
  };
  if (t.finishedOn !== undefined) fields.finished_on = t.finishedOn;
  const { error } = await supabase().from("shelf_entries").update(fields).eq("id", entryId);
  if (error) throw error;
}

/** Change just the date a book was finished (null: don't remember). */
export async function saveFinishedOn(entryId: string, finishedOn: string | null): Promise<void> {
  const { error } = await supabase().from("shelf_entries").update({ finished_on: finishedOn }).eq("id", entryId);
  if (error) throw error;
}

/* ------------------------------ Hearts & comments ------------------------ */

export type TargetType = "entry" | "checkin" | "read_along" | "chapter_comment" | "pick_poll" | "club_comment";
export interface HeartState {
  count: number;
  mine: boolean;
}

/** Hearts on a set of posts, keyed "type:id". */
export async function fetchHearts(targets: Array<{ type: TargetType; id: string }>): Promise<Map<string, HeartState>> {
  const out = new Map<string, HeartState>();
  if (!targets.length) return out;
  const uid = await myId();
  const ids = [...new Set(targets.map((t) => t.id))];
  for (let i = 0; i < ids.length; i += 150) {
    const { data, error } = await supabase()
      .from("reactions")
      .select("target_type, target_id, user_id")
      .in("target_id", ids.slice(i, i + 150));
    if (error) throw error;
    for (const r of data || []) {
      const key = `${r.target_type}:${r.target_id}`;
      const cur = out.get(key) ?? { count: 0, mine: false };
      cur.count++;
      if (r.user_id === uid) cur.mine = true;
      out.set(key, cur);
    }
  }
  return out;
}

export async function setHeart(type: TargetType, id: string, on: boolean): Promise<void> {
  if (on) {
    const { error } = await supabase().from("reactions").insert({ target_type: type, target_id: id });
    if (error && error.code !== "23505") throw new Error(error.message);
  } else {
    const uid = await myId();
    const { error } = await supabase().from("reactions").delete().eq("user_id", uid).eq("target_type", type).eq("target_id", id);
    if (error) throw error;
  }
}

export interface Comment {
  id: string;
  user_id: string;
  target_owner: string;
  body: string;
  created_at: string;
}

export async function fetchComments(entryId: string): Promise<Comment[]> {
  const { data, error } = await supabase()
    .from("comments")
    .select("id, user_id, target_owner, body, created_at")
    .eq("target_type", "entry")
    .eq("target_id", entryId)
    .order("created_at", { ascending: true })
    .limit(300);
  if (error) throw error;
  return (data as Comment[]) || [];
}

export async function commentCounts(entryIds: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (!entryIds.length) return out;
  const { data, error } = await supabase()
    .from("comments")
    .select("target_id")
    .eq("target_type", "entry")
    .in("target_id", entryIds.slice(0, 150));
  if (error) throw error;
  for (const r of data || []) out.set(r.target_id, (out.get(r.target_id) ?? 0) + 1);
  return out;
}

export async function addComment(entryId: string, body: string): Promise<void> {
  const text = body.trim().slice(0, 1000);
  if (!text) return;
  const { error } = await supabase().from("comments").insert({ target_type: "entry", target_id: entryId, body: text });
  if (error) throw new Error(/react to that/.test(error.message) ? "You can’t comment on this." : error.message);
}

export async function deleteComment(id: string): Promise<void> {
  const { error } = await supabase().from("comments").delete().eq("id", id);
  if (error) throw error;
}

/** One ranked entry by id, as the database scores it (for comment threads). */
export async function fetchScoredEntry(id: string): Promise<ScoredEntry | null> {
  const { data, error } = await supabase().from("ranked_entries").select(SCORED_SELECT).eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const e = data as unknown as ScoredEntry;
  return { ...e, score: Number(e.score), tags: e.tags ?? [] };
}

/**
 * The post a comment thread hangs off: a ranking, or a book someone didn't
 * finish (shared to the feed). Dropped ones come back flagged, with no score.
 */
export type ThreadEntry = ScoredEntry & Partial<Pick<Entry, "progress_unit" | "progress_chapter" | "chapter_total" | "stop_reason" | "stop_note" | "stop_note_spoiler">> & { progress_pct?: number | null; dropped?: boolean };

export async function fetchThreadEntry(id: string): Promise<ThreadEntry | null> {
  const ranked = await fetchScoredEntry(id);
  if (ranked) return ranked;
  const { data, error } = await supabase().from("shelf_entries").select(ENTRY_SELECT).eq("id", id).eq("status", "dropped").maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const e = data as unknown as Entry;
  return { ...e, tags: e.tags ?? [], score: 0, overall_rank: 0, bucket: e.bucket ?? "disliked", dropped: true } as unknown as ThreadEntry;
}

/* ------------------------------ Weekly picks ----------------------------- */

export interface WeeklyPick {
  id: string;
  kind: "mystery" | "wildcard";
  reason: string | null;
  predicted: number | null;
  basis: number;
  revealed: boolean;
  response: "want" | "reading" | "skip" | null;
  hints: { genres: string[]; decade: number | null; pages: number | null; initial: string };
  book: (Pick<Book, "id" | "title" | "author" | "cover_id" | "isbn13" | "genres"> & { cover_url?: string | null; year: number | null; pages: number | null }) | null;
}
export type WeeklyPicks = { locked: true; ranked: number } | { locked: false; picks: WeeklyPick[] };

/** This week's mystery pick and wildcard (made on the spot if needed). */
export async function fetchWeeklyPicks(): Promise<WeeklyPicks> {
  const { data, error } = await supabase().rpc("my_weekly_picks");
  if (error) throw error;
  const rows = (data ?? []) as Array<WeeklyPick | { locked: true; ranked: number }>;
  const lock = rows.find((r): r is { locked: true; ranked: number } => "locked" in r);
  if (lock) return lock;
  return { locked: false, picks: rows as WeeklyPick[] };
}

export async function revealPick(id: string): Promise<void> {
  const { error } = await supabase().rpc("reveal_pick", { p_id: id });
  if (error) throw error;
}

export async function respondToPick(id: string, response: "want" | "reading" | "skip"): Promise<void> {
  const { error } = await supabase().rpc("respond_pick", { p_id: id, p_response: response });
  if (error) throw error;
}

/* ------------------------------ Notifications ---------------------------- */

export interface Notification {
  id: string;
  actor_id: string;
  kind: "reaction" | "comment" | "follow" | "badge" | "mention" | "poke" | "read_along" | "picks" | "ask" | "room" | "club" | "growth";
  /** For read-along notifications: invite, joined, message or verdict. */
  detail?: string | null;
  /** For badge notifications: which badge. */
  badge?: string | null;
  target_type: TargetType | "club_read" | "club" | null;
  target_id: string | null;
  created_at: string;
  read_at: string | null;
}

export async function fetchNotifications(): Promise<Notification[]> {
  const uid = await myId();
  const { data, error } = await supabase()
    .from("notifications")
    .select("id, actor_id, kind, badge, detail, target_type, target_id, created_at, read_at")
    .eq("user_id", uid)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data as Notification[]) || [];
}

/** Unread hearts and comments on your posts: what's new since you last looked. */
export async function fetchUnreadReactions(): Promise<Notification[]> {
  const uid = await myId();
  const { data, error } = await supabase()
    .from("notifications")
    .select("id, actor_id, kind, badge, detail, target_type, target_id, created_at, read_at")
    .eq("user_id", uid)
    .in("kind", ["reaction", "comment", "ask"])
    .neq("actor_id", uid)
    .is("read_at", null)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data as Notification[]) || [];
}

/** Mark these notifications read (the reactions card, once seen or dismissed). */
export async function markNotificationsRead(ids: string[]): Promise<void> {
  if (!ids.length) return;
  const { error } = await supabase().from("notifications").update({ read_at: new Date().toISOString() }).in("id", ids);
  if (error) throw error;
}

/** Comments other readers left on your posts since a moment, newest first. */
export async function fetchCommentsOnMe(since: string): Promise<Array<Comment & { target_id: string }>> {
  const uid = await myId();
  const { data, error } = await supabase()
    .from("comments")
    .select("id, user_id, target_owner, target_id, body, created_at")
    .eq("target_owner", uid)
    .neq("user_id", uid)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data as Array<Comment & { target_id: string }>) || [];
}

export async function unreadCount(): Promise<number> {
  const uid = await myId();
  const { count, error } = await supabase()
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", uid)
    .is("read_at", null);
  if (error) throw error;
  return count ?? 0;
}

export async function markAllRead(): Promise<void> {
  const uid = await myId();
  const { error } = await supabase()
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", uid)
    .is("read_at", null);
  if (error) throw error;
}

/** Check-ins by id (for notifications that point at one). */
export async function fetchCheckinsById(ids: string[]): Promise<Map<string, Checkin>> {
  if (!ids.length) return new Map();
  const { data, error } = await supabase().from("reading_checkins").select(CHECKIN_SELECT).in("id", ids);
  if (error) throw error;
  return new Map(((data as unknown as Checkin[]) || []).map((c) => [c.id, c]));
}

/* ------------------------------ Blocking & reports ----------------------- */

export async function fetchMyBlocks(): Promise<Set<string>> {
  const uid = await myId();
  const { data, error } = await supabase().from("blocks").select("blocked_id").eq("blocker_id", uid);
  if (error) throw error;
  return new Set((data || []).map((r) => r.blocked_id as string));
}

export async function block(userId: string): Promise<void> {
  const { error } = await supabase().from("blocks").insert({ blocked_id: userId });
  if (error && error.code !== "23505") throw error;
}

export async function unblock(userId: string): Promise<void> {
  const uid = await myId();
  const { error } = await supabase().from("blocks").delete().eq("blocker_id", uid).eq("blocked_id", userId);
  if (error) throw error;
}

export async function report(targetType: "comment" | "entry" | "checkin" | "profile" | "chapter_comment" | "club_comment", targetId: string, reason?: string): Promise<void> {
  const { error } = await supabase()
    .from("reports")
    .insert({ target_type: targetType, target_id: targetId, reason: reason?.trim().slice(0, 500) || null });
  if (error) throw error;
}

/* ------------------------------ Moderation ------------------------------- */

export type ReportTarget = "comment" | "entry" | "checkin" | "profile" | "chapter_comment" | "club_comment";

export type OpenReport = {
  target_type: ReportTarget;
  target_id: string;
  reports: number;
  reasons: string[];
  first_at: string;
  last_at: string;
  author_id: string | null;
  author_name: string | null;
  author_username: string | null;
  body: string | null;
  link: string | null;
  author_reports: number;
};

/** Whether you can moderate. */
export async function isAdmin(): Promise<boolean> {
  const { data, error } = await supabase().rpc("is_admin");
  return !error && data === true;
}

/** Number of reported things waiting. Always 0 for anyone who isn't an admin. */
export async function adminReportCount(): Promise<number> {
  const { data, error } = await supabase().rpc("admin_open_report_count");
  if (error) return 0;
  return (data as number) ?? 0;
}

/** Open reports grouped by what was reported. Throws for non-admins. */
export async function adminReports(): Promise<OpenReport[]> {
  const { data, error } = await supabase().rpc("admin_reports");
  if (error) throw error;
  return (data ?? []) as OpenReport[];
}

/** Keep it (dismiss) or take it down (remove). */
export async function resolveReport(type: ReportTarget, targetId: string, action: "dismiss" | "remove"): Promise<void> {
  const { error } = await supabase().rpc("admin_resolve_report", { p_type: type, p_target: targetId, p_action: action });
  if (error) throw error;
}

/* --------------------------- Growth (admins) ----------------------------- */

export type GrowthWeek = {
  week_start: string;
  partial: boolean;
  signups: number;
  signups_invited: number;
  signups_outside: number;
  active_rankers: number;
  active_readers: number;
  matchups: number;
  importers: number;
  imported_books: number;
  d7_cohort: number;
  d7_back: number;
  d30_cohort: number;
  d30_back: number;
};

export type GrowthTotals = {
  readers: number;
  readers_outside: number;
  invited: number;
  importers: number;
  imported_books: number;
  imported_placed: number;
  ranked_books: number;
  matchups: number;
};

/** Week-by-week growth numbers, newest first. Leaves out admins and test accounts. Throws for non-admins. */
export async function adminGrowth(weeks = 12): Promise<GrowthWeek[]> {
  const { data, error } = await supabase().rpc("admin_growth", { p_weeks: weeks });
  if (error) throw error;
  return ((data ?? []) as GrowthWeek[]).map((w) => ({ ...w, week_start: String(w.week_start).slice(0, 10) }));
}

export type GrowthSource = { source: string; campaign: string | null; signups: number; rankers: number; d7_cohort: number; d7_back: number };

/** Signups in the last `days` days by where they came from (utm_source, invite or direct). Throws for non-admins. */
export async function adminGrowthSources(days = 90): Promise<GrowthSource[]> {
  const { data, error } = await supabase().rpc("admin_growth_sources", { p_days: days });
  if (error) throw error;
  return (data ?? []) as GrowthSource[];
}

/** All-time totals. Throws for non-admins. */
export async function adminGrowthTotals(): Promise<GrowthTotals> {
  const { data, error } = await supabase().rpc("admin_growth_totals");
  if (error) throw error;
  return ((data ?? []) as GrowthTotals[])[0];
}

/* -------------------------------- Pokes ---------------------------------- */

/** Nudge someone you follow about their reading (once a day each). */
export async function poke(userId: string): Promise<"ok" | "already" | "not_allowed"> {
  const { data, error } = await supabase().rpc("poke", { p_user: userId });
  if (error) throw error;
  return data as "ok" | "already" | "not_allowed";
}

/** Whether you've already poked them today (days are UTC, like the database). */
export async function pokedToday(userId: string): Promise<boolean> {
  const { data, error } = await supabase()
    .from("pokes")
    .select("day")
    .eq("to_id", userId)
    .eq("day", new Date().toISOString().slice(0, 10))
    .limit(1);
  if (error) return false;
  return Boolean(data?.length);
}

/* -------------------------------- Badges --------------------------------- */

/** Award any badges you've newly earned and get progress on all of them. */
export async function refreshBadges(): Promise<BadgeStatus[]> {
  const { data, error } = await supabase().rpc("refresh_badges");
  if (error) throw error;
  return ((data as { badge_key: string; progress: number | string; goal: number | string; earned: string | null; fresh: boolean }[]) || []).map((r) => ({
    key: r.badge_key,
    progress: Number(r.progress),
    goal: Number(r.goal),
    earned: r.earned,
    fresh: r.fresh,
  }));
}

/** Badges someone has earned, brought up to date first (empty for shelves you can't see). */
export async function fetchBadges(userId: string): Promise<{ key: string; earned_at: string }[]> {
  const { data, error } = await supabase().rpc("profile_badges", { p_user: userId });
  if (error) throw error;
  return ((data as { badge: string; earned_at: string }[]) || []).map((r) => ({ key: r.badge, earned_at: r.earned_at }));
}

/** Remember a head-to-head answer for the year-end Wrap. Fire and forget. */
export function logMatchup(winnerBook: string, loserBook: string, opts: { tie?: boolean; context?: "placement" | "sharpen" } = {}): void {
  if (winnerBook === loserBook) return;
  void supabase()
    .from("matchups")
    .insert({ winner_book: winnerBook, loser_book: loserBook, tie: opts.tie ?? false, context: opts.context ?? "placement" })
    .then(() => {}, () => {});
}

/** Count head-to-heads you answered (for the Decisive badge). Fire and forget. */
export function countHeadToHeads(n: number): void {
  if (n <= 0) return;
  void supabase().rpc("add_head_to_heads", { n: Math.min(n, 20) }).then(() => {}, () => {});
}

/* ------------------------------- Invites --------------------------------- */

const REF_KEY = "spine:ref";

/** Remember who invited this browser, until sign-up finishes. */
export function rememberReferrer(username: string): void {
  try {
    localStorage.setItem(REF_KEY, username.toLowerCase());
  } catch {}
}

/** The inviter remembered in this browser, if any. */
export function pendingReferrer(): string | null {
  try {
    return localStorage.getItem(REF_KEY);
  } catch {
    return null;
  }
}

/** Friends who joined with your link, and how many have ranked 3 books. */
export async function myInvites(): Promise<{ joined: number; qualified: number }> {
  const { data, error } = await supabase().rpc("my_invites");
  if (error) throw error;
  const row = ((data as { joined: number; qualified: number }[]) || [])[0];
  return { joined: row?.joined ?? 0, qualified: row?.qualified ?? 0 };
}

/** Credit whoever invited you, once. Safe to call more than once. */
export async function claimPendingReferral(): Promise<void> {
  let ref: string | null = null;
  try {
    ref = localStorage.getItem(REF_KEY);
  } catch {}
  if (!ref) return;
  await supabase().rpc("claim_referral", { p_username: ref }).then(() => {}, () => {});
  try {
    localStorage.removeItem(REF_KEY);
  } catch {}
}

const SOURCE_KEY = "readread:source";

/** Remember where this browser first came from (kept 30 days; the first link wins). */
export function rememberSignupSource(source: string, campaign: string | null): void {
  try {
    const old = JSON.parse(localStorage.getItem(SOURCE_KEY) || "null") as { at: number } | null;
    if (old && Date.now() - old.at < 30 * 86400000) return;
    localStorage.setItem(SOURCE_KEY, JSON.stringify({ source: source.slice(0, 40), campaign: campaign?.slice(0, 60) ?? null, at: Date.now() }));
  } catch {}
}

/** Save where a new reader came from on their profile, once. Safe to call more than once. */
export async function claimSignupSource(): Promise<void> {
  let v: { source: string; campaign: string | null } | null = null;
  try {
    v = JSON.parse(localStorage.getItem(SOURCE_KEY) || "null");
  } catch {}
  if (!v?.source) return;
  await supabase().rpc("set_signup_source", { p_source: v.source, p_campaign: v.campaign }).then(() => {}, () => {});
  try {
    localStorage.removeItem(SOURCE_KEY);
  } catch {}
}

/** Public: the name to show on an invite page. */
type Inviter = { display_name: string | null; username: string; avatar_icon?: string | null; avatar_color?: string | null };
export async function inviteInfo(username: string): Promise<Inviter | null> {
  const { data, error } = await supabase().rpc("invite_info", { p_username: username });
  if (error) throw error;
  return ((data as Inviter[]) || [])[0] ?? null;
}

export function inviteUrl(username: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "https://readread.app";
  return `${origin}/join/${username}`;
}

/* ------------------------------ Read-alongs ------------------------------ */

export type MemberState = "invited" | "joined" | "declined" | "left";

export interface ReadAlong {
  id: string;
  book_id: string;
  /** Null if the person who started it has since deleted their account. */
  created_by: string | null;
  target_date: string | null;
  previous_id: string | null;
  revealed_at: string | null;
  created_at: string;
  book: Book;
  members: { user_id: string; state: MemberState; joined_at: string | null }[];
}

export interface ReadAlongProgress {
  user_id: string;
  state: MemberState;
  shelf_status: Entry["status"] | null;
  progress_pct: number | null;
  last_checkin_on: string | null;
  /** Hidden (null) until everyone has ranked, except your own. */
  score: number | null;
  ranked: boolean;
}

export interface ReadAlongMessage {
  id: string;
  read_along_id: string;
  user_id: string;
  body: string;
  progress_pct: number;
  created_at: string;
}

const READ_ALONG_SELECT =
  "id, book_id, created_by, target_date, previous_id, revealed_at, created_at, book:books(*), members:read_along_members(user_id, state, joined_at)";

export async function createReadAlong(bookId: string, userIds: string[], target: string | null, previous: string | null): Promise<string> {
  const { data, error } = await supabase().rpc("create_read_along", {
    p_book: bookId, p_users: userIds, p_target: target, p_previous: previous,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function fetchReadAlong(id: string): Promise<ReadAlong | null> {
  const { data, error } = await supabase().from("read_alongs").select(READ_ALONG_SELECT).eq("id", id).maybeSingle();
  if (error) throw error;
  return data as unknown as ReadAlong | null;
}

/** Read-alongs you're in or invited to, newest first. */
export async function fetchMyReadAlongs(): Promise<ReadAlong[]> {
  const uid = await myId();
  const { data: mine, error: e1 } = await supabase()
    .from("read_along_members")
    .select("read_along_id")
    .eq("user_id", uid)
    .in("state", ["invited", "joined"]);
  if (e1) throw e1;
  const ids = (mine ?? []).map((m) => m.read_along_id as string);
  if (!ids.length) return [];
  const { data, error } = await supabase().from("read_alongs").select(READ_ALONG_SELECT).in("id", ids).order("created_at", { ascending: false });
  if (error) throw error;
  return (data as unknown as ReadAlong[]) || [];
}

export async function readAlongProgress(id: string): Promise<ReadAlongProgress[]> {
  const { data, error } = await supabase().rpc("read_along_progress", { p_id: id });
  if (error) throw error;
  return ((data as ReadAlongProgress[]) || []).map((r) => ({ ...r, score: r.score == null ? null : Number(r.score) }));
}

export async function fetchReadAlongMessages(id: string): Promise<ReadAlongMessage[]> {
  const { data, error } = await supabase()
    .from("read_along_messages")
    .select("id, read_along_id, user_id, body, progress_pct, created_at")
    .eq("read_along_id", id)
    .order("created_at", { ascending: true })
    .limit(500);
  if (error) throw error;
  return (data as ReadAlongMessage[]) || [];
}

export async function postReadAlongMessage(id: string, body: string): Promise<ReadAlongMessage> {
  const { data, error } = await supabase()
    .from("read_along_messages")
    .insert({ read_along_id: id, body: body.trim() })
    .select("id, read_along_id, user_id, body, progress_pct, created_at")
    .single();
  if (error) throw new Error(error.message);
  return data as ReadAlongMessage;
}

export async function deleteReadAlongMessage(messageId: string): Promise<void> {
  const { error } = await supabase().from("read_along_messages").delete().eq("id", messageId);
  if (error) throw error;
}

export async function respondReadAlong(id: string, join: boolean): Promise<void> {
  const { error } = await supabase().rpc("respond_read_along", { p_id: id, p_join: join });
  if (error) throw error;
}

export async function leaveReadAlong(id: string): Promise<void> {
  const { error } = await supabase().rpc("leave_read_along", { p_id: id });
  if (error) throw error;
}

export async function inviteToReadAlong(id: string, userIds: string[]): Promise<number> {
  const { data, error } = await supabase().rpc("invite_to_read_along", { p_id: id, p_users: userIds });
  if (error) throw error;
  return (data as number) ?? 0;
}

export interface FeedReadAlong {
  id: string;
  book_id: string;
  members: string[];
  created_at: string;
  revealed_at: string | null;
}

/** Read-alongs friends started or finished recently (for the feed). */
export async function feedReadAlongs(): Promise<FeedReadAlong[]> {
  const { data, error } = await supabase().rpc("feed_read_alongs", { p_days: 60 });
  if (error) return [];
  return (data as FeedReadAlong[]) || [];
}

/* ------------------------------ Ask a friend ----------------------------- */

export interface PickPoll {
  id: string;
  user_id: string;
  book_ids: string[];
  note: string | null;
  created_at: string;
  closes_at: string;
  closed_at: string | null;
  chosen_book: string | null;
}

export interface PickVote {
  poll_id: string;
  voter_id: string;
  book_id: string;
  reason: string | null;
  created_at: string;
}

const POLL_SELECT = "id, user_id, book_ids, note, created_at, closes_at, closed_at, chosen_book";

/** Open: not closed and inside its 48 hours. */
export function pollOpen(p: PickPoll, now = Date.now()): boolean {
  return !p.closed_at && new Date(p.closes_at).getTime() > now;
}

/** Ask the people who follow you to pick between 2 and 4 books. Closes any poll you had open. */
export async function askFriends(bookIds: string[], note: string): Promise<string> {
  const { data, error } = await supabase().rpc("ask_friends", { p_books: bookIds, p_note: note.trim() || null });
  if (error) throw error;
  return data as string;
}

export async function fetchPoll(id: string): Promise<PickPoll | null> {
  const { data, error } = await supabase().from("pick_polls").select(POLL_SELECT).eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as PickPoll | null) ?? null;
}

/** Your most recent poll, open or not. */
export async function fetchMyLatestPoll(): Promise<PickPoll | null> {
  const uid = await myId();
  const { data, error } = await supabase().from("pick_polls").select(POLL_SELECT).eq("user_id", uid).order("created_at", { ascending: false }).limit(1);
  if (error) throw error;
  return ((data as PickPoll[]) ?? [])[0] ?? null;
}

/** Open polls from people you follow (the database only shows you theirs). */
export async function fetchFriendsOpenPolls(): Promise<PickPoll[]> {
  const uid = await myId();
  const { data, error } = await supabase()
    .from("pick_polls")
    .select(POLL_SELECT)
    .neq("user_id", uid)
    .is("closed_at", null)
    .gt("closes_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) throw error;
  return (data as PickPoll[]) ?? [];
}

/** Votes on a poll you can see the votes of: yours, or one you voted on. */
export async function fetchPollVotes(pollIds: string[]): Promise<PickVote[]> {
  if (!pollIds.length) return [];
  const { data, error } = await supabase().from("pick_votes").select("poll_id, voter_id, book_id, reason, created_at").in("poll_id", pollIds);
  if (error) throw error;
  return (data as PickVote[]) ?? [];
}

/** Vote (or change your vote) on a friend's poll. */
export async function votePoll(pollId: string, bookId: string, reason?: string): Promise<void> {
  const uid = await myId();
  const { error } = await supabase()
    .from("pick_votes")
    .upsert({ poll_id: pollId, voter_id: uid, book_id: bookId, reason: reason?.trim() || null }, { onConflict: "poll_id,voter_id" });
  if (error) throw error;
}

/** Close your poll early, optionally with the book you went with. */
export async function closeMyPoll(pollId: string, chosen?: string): Promise<void> {
  const { error } = await supabase().rpc("close_my_poll", { p_poll: pollId, p_chosen: chosen ?? null });
  if (error) throw error;
}

/* ------------------------------ Chapter rooms ---------------------------- */

export interface RoomComment {
  id: string;
  user_id: string;
  book_id: string;
  chapter: number;
  parent_id: string | null;
  body: string;
  created_at: string;
}

const ROOM_SELECT = "id, user_id, book_id, chapter, parent_id, body, created_at";
/** Chapter 0 is the whole-book room, open once you've finished. */
export const WHOLE_BOOK = 0;
/** reached_chapter() for a finished book. */
export const FINISHED = 999;

/** The furthest chapter you've reached in a book (999 when finished), or null. */
export async function reachedChapter(bookId: string): Promise<number | null> {
  const { data, error } = await supabase().rpc("reached_chapter", { p_book: bookId });
  if (error) throw error;
  return (data as number | null) ?? null;
}

/** Comment counts for each of a book's rooms, open to you or not. */
export async function fetchRoomCounts(bookId: string): Promise<Map<number, { comments: number; latest: string }>> {
  const { data, error } = await supabase().rpc("chapter_room_counts", { p_book: bookId });
  if (error) throw error;
  return new Map(((data as Array<{ chapter: number; comments: number; latest: string }>) ?? []).map((r) => [r.chapter, { comments: Number(r.comments), latest: r.latest }]));
}

/** One room's comments, oldest first (the database only returns rooms you've reached). */
export async function fetchRoom(bookId: string, chapter: number): Promise<RoomComment[]> {
  const { data, error } = await supabase()
    .from("chapter_comments")
    .select(ROOM_SELECT)
    .eq("book_id", bookId)
    .eq("chapter", chapter)
    .order("created_at", { ascending: true })
    .limit(500);
  if (error) throw error;
  return (data as RoomComment[]) ?? [];
}

export async function fetchRoomCommentsById(ids: string[]): Promise<Map<string, RoomComment>> {
  if (!ids.length) return new Map();
  const { data, error } = await supabase().from("chapter_comments").select(ROOM_SELECT).in("id", ids);
  if (error) throw error;
  return new Map(((data as RoomComment[]) ?? []).map((c) => [c.id, c]));
}

export async function postRoomComment(bookId: string, chapter: number, body: string, parentId?: string | null): Promise<RoomComment> {
  const { data, error } = await supabase()
    .from("chapter_comments")
    .insert({ book_id: bookId, chapter, body: body.trim(), parent_id: parentId ?? null })
    .select(ROOM_SELECT)
    .single();
  if (error) throw new Error(error.message.includes("row-level security") ? "You can post here once you’ve reached this chapter." : error.message);
  return data as RoomComment;
}

export async function deleteRoomComment(id: string): Promise<void> {
  const { error } = await supabase().from("chapter_comments").delete().eq("id", id);
  if (error) throw error;
}
