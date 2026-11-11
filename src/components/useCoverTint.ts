"use client";

import { useEffect, useState } from "react";
import { coverCandidates, coverColors, dedupeKey, type BookInput } from "@/lib/books";

// Sampled colour per cover, or "" when the art loaded but couldn't be read.
const cache = new Map<string, string>();

const FALLBACK = "fallback";
const PROXY_HOSTS = /^https:\/\/(covers\.openlibrary\.org|is\d-ssl\.mzstatic\.com|books\.google\.com)\//;

/** Average a cover down to one colour, nudged away from grey so it reads as a tint. */
function sample(img: HTMLImageElement): string | null {
  try {
    const c = document.createElement("canvas");
    c.width = 12;
    c.height = 18;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, 12, 18);
    const d = ctx.getImageData(0, 0, 12, 18).data;
    // Weight saturated pixels more, so a white cover with a red title reads red.
    let r = 0, g = 0, b = 0, w = 0;
    for (let i = 0; i < d.length; i += 4) {
      const max = Math.max(d[i], d[i + 1], d[i + 2]);
      const min = Math.min(d[i], d[i + 1], d[i + 2]);
      const weight = 1 + ((max - min) / 255) * 4;
      r += d[i] * weight; g += d[i + 1] * weight; b += d[i + 2] * weight; w += weight;
    }
    if (!w) return null;
    return `rgb(${Math.round(r / w)}, ${Math.round(g / w)}, ${Math.round(b / w)})`;
  } catch {
    return null; // cross-origin image without CORS: canvas is tainted
  }
}

/**
 * The colour to tint a book's page with: sampled from its real cover when the
 * image allows it, the generated cover's colour when there's no art, and
 * null (neutral) while loading or when the art can't be read.
 */
export function useCoverTint(book: BookInput | null | undefined): string | null {
  const fallback = book ? coverColors(dedupeKey(book.title, book.author)).bg : null;
  const urls = book ? coverCandidates(book, "M") : [];
  const key = urls.join("|");
  const [tint, setTint] = useState<{ key: string; color: string } | null>(null);

  useEffect(() => {
    if (!key) return;
    const hit = cache.get(key);
    if (hit !== undefined) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTint({ key, color: hit });
      return;
    }
    let live = true;
    const list = key.split("|");
    const tryAt = (i: number) => {
      if (!live) return;
      if (i >= list.length) {
        // No real art: the generated cover shows, so use its colour.
        cache.set(key, FALLBACK);
        setTint({ key, color: FALLBACK });
        return;
      }
      const img = new Image();
      // Known cover hosts go through our own route so the pixels are readable.
      const proxied = PROXY_HOSTS.test(list[i]);
      if (!proxied) img.crossOrigin = "anonymous";
      img.decoding = "async";
      img.onload = () => {
        if (!live) return;
        if (img.naturalWidth < 10) return tryAt(i + 1);
        const color = sample(img) ?? "";
        cache.set(key, color);
        setTint({ key, color });
      };
      img.onerror = () => {
        if (proxied) return tryAt(i + 1); // our route says there's no cover here
        // Failed with CORS on: is the art there but just unreadable? Then stay neutral.
        const probe = new Image();
        probe.onload = () => {
          if (!live) return;
          if (probe.naturalWidth < 10) return tryAt(i + 1);
          cache.set(key, "");
          setTint({ key, color: "" });
        };
        probe.onerror = () => tryAt(i + 1);
        probe.src = list[i];
      };
      img.src = proxied ? `/api/cover?u=${encodeURIComponent(list[i])}` : list[i];
    };
    tryAt(0);
    return () => {
      live = false;
    };
  }, [key]);

  if (!key) return fallback;
  if (tint?.key !== key) return null; // still looking: stay neutral
  return tint.color === FALLBACK ? fallback : tint.color || null;
}
