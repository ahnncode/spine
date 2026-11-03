"use client";

import { useState } from "react";
import { coverColors, coverUrl, dedupeKey, type BookInput } from "@/lib/books";

interface Props {
  book: BookInput;
  width: number;
  /** Show the generated title/author even when real art loads (never, by default). */
  className?: string;
}

/**
 * Real cover art from Open Library when it exists; otherwise a typographic
 * cover in the app's palette so every shelf still looks designed.
 */
export function Cover({ book, width, className }: Props) {
  const height = Math.round(width * 1.5);
  const url = coverUrl(book, width > 90 ? "L" : "M");
  const [failed, setFailed] = useState(false);
  const { bg, fg } = coverColors(dedupeKey(book.title, book.author));
  const showArt = url && !failed;

  // Shrink the title so its longest word fits the cover instead of being cut off.
  const longestWord = Math.max(1, ...book.title.split(/\s+/).map((w) => w.length));
  const fitSize = (width * 0.74) / (longestWord * 0.6);
  const titleSize = Math.max(6, Math.round(Math.min(width * 0.16, fitSize)));
  const authorSize = Math.max(5, Math.round(width * 0.06));
  const lines = width < 60 ? 4 : 5;

  return (
    <div className={`cover ${className ?? ""}`} style={{ width, height, background: bg, color: fg }}>
      {showArt ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt=""
          loading="lazy"
          onError={() => setFailed(true)}
          onLoad={(e) => {
            // Open Library sometimes returns a 1×1 placeholder.
            if ((e.currentTarget as HTMLImageElement).naturalWidth < 10) setFailed(true);
          }}
        />
      ) : width < 56 ? (
        // Too small for a readable title: a monogram, like a spine stamp.
        <div className="cover__gen" aria-hidden="true" style={{ alignItems: "center", justifyContent: "center", padding: 0 }}>
          <div className="cover__spine" />
          <span className="d" style={{ fontWeight: 800, fontSize: Math.round(width * 0.5), lineHeight: 1 }}>
            {book.title.replace(/^(the|a|an)\s+/i, "").charAt(0).toUpperCase()}
          </span>
        </div>
      ) : (
        <div className="cover__gen" aria-hidden="true">
          <div className="cover__spine" />
          <div className="cover__title" style={{ fontSize: titleSize, WebkitLineClamp: lines }}>
            {book.title}
          </div>
          {width >= 44 && book.author && (
            <div className="cover__author" style={{ fontSize: authorSize }}>
              {book.author}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
