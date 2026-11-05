import type { Book } from "./books";
import { lookup } from "./openlibrary";
import { supabase } from "./supabase";

const checked = new Set<string>();

/**
 * Books saved from a reissue or an ebook can carry that edition's year
 * (Pet Sematary as 2014). Ask Open Library for the book's first-published
 * year and, if it's earlier, save that instead. Once per book per visit.
 */
export async function fixBookYear(book: Book): Promise<number | null> {
  if (checked.has(book.id)) return null;
  checked.add(book.id);
  const found = await lookup(book.title, book.author).catch(() => null);
  const year = found?.year;
  if (!year || year < 1000 || (book.year && year >= book.year)) return null;
  const { data } = await supabase().rpc("set_book_year", { p_book: book.id, p_year: year });
  return data ? year : null;
}
