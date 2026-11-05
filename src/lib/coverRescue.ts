import { dedupeKey, type BookInput } from "./books";
import { findAppleCover } from "./applecovers";
import { supabase, supabaseConfigured } from "./supabase";

/**
 * When every known picture for a book fails to load (a dead Open Library id,
 * an Apple link that moved), look the book up on Apple Books once, show that,
 * and save it so everyone gets the fixed cover. Gentle: one lookup at a time,
 * a limited number per visit, each book at most once.
 */
const tried = new Map<string, Promise<string | null>>();
const MAX_PER_VISIT = 20;
const GAP_MS = 1500;
let queue: Promise<unknown> = Promise.resolve();

export function rescueCover(book: BookInput & { id?: string }): Promise<string | null> {
  const key = dedupeKey(book.title, book.author);
  const hit = tried.get(key);
  if (hit) return hit;
  if (tried.size >= MAX_PER_VISIT) return Promise.resolve(null);
  const job = queue.then(async () => {
    const url = await findAppleCover(book.title, book.author).catch(() => null);
    if (url && book.id && supabaseConfigured) {
      await supabase().rpc("repair_book_cover", { p_book: book.id, p_url: url });
    }
    await new Promise((r) => setTimeout(r, GAP_MS));
    return url;
  });
  queue = job.catch(() => null);
  tried.set(key, job);
  return job;
}
