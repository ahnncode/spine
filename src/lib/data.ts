import { dedupeKey, type Book, type BookInput } from "./books";
import type { ImportedBook } from "./goodreads";
import { startingOrder } from "./goodreads";
import { BUCKET_ORDER, bucketScores, keyForIndex, renumber, type Bucket } from "./ranking";
import { supabase } from "./supabase";

export type Status = "ranked" | "want" | "unsorted";

export interface Entry {
  id: string;
  book_id: string;
  status: Status;
  bucket: Bucket | null;
  sort_key: number | null;
  needs_sort: boolean;
  compare_count: number;
  stars: number | null;
  finished_on: string | null;
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

const ENTRY_SELECT =
  "id, book_id, status, bucket, sort_key, needs_sort, compare_count, stars, finished_on, source, created_at, book:books(*)";

async function userId(): Promise<string> {
  const { data } = await supabase().auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new Error("Not signed in");
  return id;
}

export async function fetchShelf(): Promise<Entry[]> {
  const uid = await userId();
  const all: Entry[] = [];
  // Page through in case of very large shelves.
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
      .upsert(chunk, { onConflict: "dedupe_key", ignoreDuplicates: true });
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
  return id;
}

export async function fetchBook(id: string): Promise<Book | null> {
  const { data, error } = await supabase().from("books").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as Book | null;
}

/* ------------------------------ Shelf writes ----------------------------- */

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function addToWant(bookId: string): Promise<void> {
  const uid = await userId();
  const { error } = await supabase()
    .from("shelf_entries")
    .upsert(
      { user_id: uid, book_id: bookId, status: "want", source: "app" },
      { onConflict: "user_id,book_id", ignoreDuplicates: true },
    );
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
  const uid = await userId();
  const { bookId, bucket, index, existing } = opts;
  let list = opts.list;
  let key = keyForIndex(list.map((e) => e.sort_key), index);

  if (key === null) {
    const keys = renumber(list.length);
    await Promise.all(
      list.map((e, i) => supabase().from("shelf_entries").update({ sort_key: keys[i] }).eq("id", e.id)),
    );
    list = list.map((e, i) => ({ ...e, sort_key: keys[i] }));
    key = keyForIndex(keys, index) as number;
  }

  const row = {
    user_id: uid,
    book_id: bookId,
    status: "ranked" as const,
    bucket,
    sort_key: key,
    needs_sort: false,
    finished_on: existing?.finished_on ?? today(),
    source: existing?.source ?? "app",
  };
  const { error } = await supabase().from("shelf_entries").upsert(row, { onConflict: "user_id,book_id" });
  if (error) throw error;
}

/** Swap two neighbours after a quick matchup (lower one won). */
export async function recordMatchup(winner: RankedEntry, loser: RankedEntry): Promise<void> {
  const swap = winner.sort_key < loser.sort_key;
  const updates = [
    {
      id: winner.id,
      sort_key: swap ? loser.sort_key : winner.sort_key,
      compare_count: winner.compare_count + 1,
      needs_sort: winner.compare_count + 1 < 2,
    },
    {
      id: loser.id,
      sort_key: swap ? winner.sort_key : loser.sort_key,
      compare_count: loser.compare_count + 1,
      needs_sort: loser.compare_count + 1 < 2,
    },
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
  const uid = await userId();
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
