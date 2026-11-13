"use client";

import { useEffect, useState } from "react";
import { appleBooksLink, isAppleArt } from "@/lib/applecovers";
import type { Book } from "@/lib/books";

/**
 * When the cover shown is Apple's artwork, a small link to the book on Apple
 * Books sits under it (Apple's terms pair their artwork with a store link).
 */
export function AppleCoverCredit({ book }: { book: Pick<Book, "title" | "author" | "cover_id" | "cover_url"> }) {
  const apple = !book.cover_id && isAppleArt(book.cover_url);
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!apple) return;
    let alive = true;
    appleBooksLink(book.title, book.author).then((u) => alive && setUrl(u));
    return () => { alive = false; };
  }, [apple, book.title, book.author]);
  if (!apple || !url) return null;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="cover-credit">
      Cover from Apple Books
    </a>
  );
}
