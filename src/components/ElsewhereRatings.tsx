"use client";

import { useEffect, useState } from "react";
import type { Book } from "@/lib/books";
import { outsideRatings, type OutsideRating } from "@/lib/outsideRatings";

/** One quiet line: how the book is rated on other sites (stars out of 5). */
export function ElsewhereRatings({ book }: { book: Pick<Book, "id" | "title" | "author" | "ol_work_key"> }) {
  const { id, title, author, ol_work_key: workKey } = book;
  const [ratings, setRatings] = useState<OutsideRating[] | null>(null);

  useEffect(() => {
    let alive = true;
    outsideRatings({ id, title, author, ol_work_key: workKey }).then((r) => alive && setRatings(r)).catch(() => alive && setRatings([]));
    return () => {
      alive = false;
    };
  }, [id, title, author, workKey]);

  if (!ratings?.length) return null;
  return (
    <p className="elsewhere" aria-label="Ratings on other sites, out of 5 stars">
      <span>Elsewhere</span>
      {ratings.map((r) => (
        <span key={r.source}>
          <span aria-hidden="true" style={{ color: "var(--accent-ink)" }}>★</span>{" "}
          <b>{r.average.toFixed(1)}</b>{" "}
          {r.url ? <a href={r.url} target="_blank" rel="noopener noreferrer" className="elsewhere__link">{r.label}</a> : r.label} ({r.count.toLocaleString()})
        </span>
      ))}
    </p>
  );
}
