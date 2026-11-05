"use client";

import { useEffect, useState } from "react";
import { coverCandidates, coverColors, dedupeKey, type BookInput } from "@/lib/books";
import { rescueCover } from "@/lib/coverRescue";

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
  const known = coverCandidates(book, width > 90 ? "L" : "M");
  // A replacement found after every known picture failed (see coverRescue).
  const [rescued, setRescued] = useState<{ key: string; url: string } | null>(null);
  const bookKey = dedupeKey(book.title, book.author);
  const candidates = rescued?.key === bookKey && !known.includes(rescued.url) ? [...known, rescued.url] : known;
  // Index of the image being tried; moves on when one is missing or a placeholder.
  const sig = candidates.join("|");
  const [tried, setTried] = useState({ sig, n: 0 });
  const attempt = tried.sig === sig ? tried.n : 0;
  const url = candidates[attempt];
  const failed = attempt >= candidates.length;
  const fail = () => setTried({ sig, n: attempt + 1 });
  const { bg, fg } = coverColors(bookKey);
  const showArt = url && !failed;

  // Had pictures, and all of them failed: try to find a working one.
  const allFailed = failed && known.length > 0 && rescued?.key !== bookKey;
  useEffect(() => {
    if (!allFailed) return;
    let live = true;
    rescueCover(book).then((u) => {
      if (live && u) setRescued({ key: bookKey, url: u });
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allFailed, bookKey]);

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
          key={url}
          decoding="async"
          // Already cached (e.g. loaded before hydration): show it without waiting for onLoad.
          ref={(img) => {
            if (img?.complete && img.naturalWidth >= 10) img.dataset.loaded = "1";
          }}
          onError={fail}
          onLoad={(e) => {
            const img = e.currentTarget as HTMLImageElement;
            // Open Library sometimes returns a 1×1 placeholder.
            if (img.naturalWidth < 10) fail();
            else img.dataset.loaded = "1"; // fades in over the coloured block
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
