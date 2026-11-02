import { dedupeKey, type Book, type BookInput } from "./books";
import type { ImportedBook } from "./goodreads";
import { startingOrder } from "./goodreads";
import { BUCKET_ORDER, bucketScores, keyForIndex, renumber, type Bucket } from "./ranking";
import { supabase } from "./supabase";

export type Status = "ranked" | "want" | "unsorted" | "reading";

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
  source: string;
  created_at: string;
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
}

const ENTRY_SELECT =
  "id, user_id, book_id, status, bucket, sort_key, needs_sort, compare_count, stars, finished_on, started_on, ranked_at, source, created_at, book:books(*)";

export async function myId(): Promise<string> {
  const { data } = await supabase().auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new Error("Not signed in");
  return id;
}

function today(): string {
  const d = new Date();
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
  return all;
}

/** Ranked entries in overall order (loved → fine → not for me), with scores. */
export function rankEntries(entries: Entry[]): RankedEntry[] {
  const out: RankedEntry[] = [];
  for (const bucket of BUCKET_ORDER) {
    const inBucket = entries
      .filter((e) => e.status === "ranked" && e.bucket === bucket && e.sort_key !== null)
      .sort((a, b) => (b.sort_key as number) - (a.sort_key as number));
    const scores = bucketScores(inBucket.length, bucket);
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
  for (const b of inputs) {
    const key = dedupeKey(b.title, b.author);
    if (!rows.has(key)) rows.set(key, { ...b, dedupe_key: key });
  }
  const list = [...rows.values()];
  const ids = new Map<string, string>();
  for (let i = 0; i < list.length; i += 200) {
    const chunk = list.slice(i, i + 200);
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

export async function ensureBook(input: BookInput): Promise<string> {
  const ids = await ensureBooks([input]);
  const id = ids.get(dedupeKey(input.title, input.author));
  if (!id) throw new Error("Couldn't save that book");
  // A book first added by an import may be missing art or genres this search has.
  if (input.cover_id || input.genres?.length) await enrichBook(id, input).catch(() => {});
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

/** Fill in cover, genres and year on a catalog book (only where missing). */
export async function enrichBook(id: string, b: BookInput): Promise<void> {
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

/** Mark a book as currently reading (from nothing, or from want-to-read). */
export async function startReading(bookId: string): Promise<void> {
  const uid = await myId();
  const { error } = await supabase()
    .from("shelf_entries")
    .upsert(
      { user_id: uid, book_id: bookId, status: "reading", started_on: today(), bucket: null, sort_key: null },
      { onConflict: "user_id,book_id" },
    );
  if (error) throw error;
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
}): Promise<void> {
  const uid = await myId();
  const { bookId, bucket, index, existing } = opts;
  const list = opts.list;
  let key = keyForIndex(list.map((e) => e.sort_key), index);

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
    needs_sort: false,
    finished_on: existing?.finished_on ?? today(),
    started_on: existing?.started_on ?? null,
    ranked_at: wasRanked ? existing?.ranked_at ?? new Date().toISOString() : new Date().toISOString(),
    source: existing?.source ?? "app",
  };
  const { error } = await supabase().from("shelf_entries").upsert(row, { onConflict: "user_id,book_id" });
  if (error) throw error;
}

/** Swap two neighbours after a quick matchup (lower one won). */
export async function recordMatchup(winner: RankedEntry, loser: RankedEntry): Promise<void> {
  const swap = winner.sort_key < loser.sort_key;
  const updates = [
    { id: winner.id, sort_key: swap ? loser.sort_key : winner.sort_key, compare_count: winner.compare_count + 1, needs_sort: winner.compare_count + 1 < 2 },
    { id: loser.id, sort_key: swap ? winner.sort_key : loser.sort_key, compare_count: loser.compare_count + 1, needs_sort: loser.compare_count + 1 < 2 },
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
): Promise<{ added: number; skipped: number }> {
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
      stars: b.stars,
      finished_on: b.finishedOn,
      started_on: b.status === "reading" ? today() : null,
      // Date read stands in for when it was ranked, so imports don't flood friends' feeds.
      ranked_at: b.status === "ranked" ? (b.finishedOn ? `${b.finishedOn}T12:00:00Z` : "2000-01-01T00:00:00Z") : null,
      source: "goodreads",
    }));

  for (let i = 0; i < rows.length; i += 200) {
    const { error } = await supabase()
      .from("shelf_entries")
      .upsert(rows.slice(i, i + 200), { onConflict: "user_id,book_id", ignoreDuplicates: true });
    if (error) throw error;
    onProgress(0.6 + 0.4 * Math.min(1, (i + 200) / rows.length), "Building your shelf…");
  }
  onProgress(1, "Done");
  return { added: rows.length, skipped: books.length - rows.length };
}

/* ------------------------------ Profiles & follows ----------------------- */

const PROFILE_SELECT = "id, username, display_name, is_private, yearly_goal";

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
    if (error.code === "23514") throw new Error("Usernames are 3–20 lowercase letters, numbers or underscores");
    throw new Error(error.message);
  }
  if (!data?.length) throw new Error("Couldn’t save your profile. Try again in a moment.");
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

export async function recommendations(limit = 20): Promise<Array<{ book: Book; predicted: number; basis: number }>> {
  const { data, error } = await supabase().rpc("recommendations", { p_limit: limit });
  if (error) throw error;
  const rows = (data as Array<{ book_id: string; predicted: string; basis: number }>) || [];
  const books = new Map((await fetchBooks(rows.map((r) => r.book_id))).map((b) => [b.id, b]));
  return rows
    .filter((r) => books.has(r.book_id))
    .map((r) => ({ book: books.get(r.book_id)!, predicted: Number(r.predicted), basis: r.basis }));
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
  book: Book;
}

const SCORED_SELECT = "id, user_id, book_id, bucket, score, overall_rank, ranked_at, book:books(*)";

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

export type FeedItem =
  | { kind: "ranked"; at: string; entry: ScoredEntry }
  | { kind: "reading"; at: string; entry: Entry };

export async function fetchFeed(friendIds: string[]): Promise<FeedItem[]> {
  if (!friendIds.length) return [];
  const [ranked, reading] = await Promise.all([
    supabase()
      .from("ranked_entries")
      .select(SCORED_SELECT)
      .in("user_id", friendIds)
      .not("ranked_at", "is", null)
      .gte("ranked_at", new Date(Date.now() - 1000 * 60 * 60 * 24 * 60).toISOString())
      .order("ranked_at", { ascending: false })
      .limit(60),
    supabase()
      .from("shelf_entries")
      .select(ENTRY_SELECT)
      .in("user_id", friendIds)
      .eq("status", "reading")
      .order("updated_at", { ascending: false })
      .limit(20),
  ]);
  if (ranked.error) throw ranked.error;
  if (reading.error) throw reading.error;
  const items: FeedItem[] = [
    ...((ranked.data as unknown as ScoredEntry[]) || []).map((e) => ({
      kind: "ranked" as const,
      at: e.ranked_at as string,
      entry: { ...e, score: Number(e.score) },
    })),
    ...((reading.data as unknown as Entry[]) || []).map((e) => ({
      kind: "reading" as const,
      at: e.started_on ? `${e.started_on}T12:00:00Z` : e.created_at,
      entry: e,
    })),
  ];
  return items.sort((a, b) => b.at.localeCompare(a.at));
}
