import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { ReactNode } from "react";
import { AVATAR_ART } from "@/components/AvatarArt";
import { AVATAR_COLOR } from "@/lib/avatars";
import { coverCandidates, coverColors, dedupeKey } from "@/lib/books";
import type { PublicBookCard } from "@/lib/public";

/** Shared pieces for link-preview and share-card images. */

export const INK = "#111111";
export const GROUND = "#F7F7F5";
export const ACCENT = "#FF5A1F";
export const MUTED = "#5E5E5A";

type OgFont = { name: string; data: Buffer; weight: 400 | 500 | 600 | 700; style: "normal" };
let fontsPromise: Promise<OgFont[]> | null = null;
/** Gloock for headers, Brygada 1918 for book titles and numbers, Geist for text. */
export function ogFonts() {
  const font = (name: string) => readFile(join(process.cwd(), "assets/fonts", name));
  fontsPromise ??= Promise.all([
    font("gloock-latin-400-normal.woff"),
    font("brygada-1918-latin-500-normal.woff"),
    font("brygada-1918-latin-700-normal.woff"),
    font("geist-latin-400-normal.woff"),
    font("geist-latin-600-normal.woff"),
  ]).then(([gloock, b5, b7, g4, g6]) => [
    { name: "Gloock", data: gloock, weight: 400 as const, style: "normal" as const },
    { name: "Brygada", data: b5, weight: 500 as const, style: "normal" as const },
    { name: "Brygada", data: b7, weight: 700 as const, style: "normal" as const },
    { name: "Geist", data: g4, weight: 400 as const, style: "normal" as const },
    { name: "Geist", data: g6, weight: 600 as const, style: "normal" as const },
  ]);
  return fontsPromise;
}

export function Mark({ s }: { s: number }) {
  const bar = (w: string, color: string) => <div style={{ display: "flex", height: s * 0.15, width: w, borderRadius: s * 0.04, background: color }} />;
  return (
    <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: s * 0.07, width: s, height: s, borderRadius: s * 0.23, background: INK, padding: `0 ${s * 0.2}px` }}>
      {bar("100%", ACCENT)}
      {bar("80%", "#FFFFFF")}
      {bar("60%", "rgba(255,255,255,0.55)")}
    </div>
  );
}

export function Wordmark({ s = 40 }: { s?: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: s * 0.3 }}>
      <Mark s={s} />
      <div style={{ fontFamily: "Gloock", fontWeight: 400, fontSize: s * 0.8, letterSpacing: "-0.015em", color: INK }}>readread</div>
    </div>
  );
}

/** Fetch a cover as a data URL (or null), never taking more than a few seconds. */
export async function coverData(book: PublicBookCard): Promise<string | null> {
  for (const url of coverCandidates(book, "L")) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(3500) });
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 1500) continue; // a blank placeholder
      const type = res.headers.get("content-type")?.split(";")[0] || "image/jpeg";
      if (!/image\/(jpeg|png)/.test(type)) continue;
      return `data:${type};base64,${buf.toString("base64")}`;
    } catch {}
  }
  return null;
}

/** A book cover at a given width (2:3), with readread's drawn cover when there's no art. */
export function OgCover({ book, src, width }: { book: PublicBookCard; src: string | null; width: number }) {
  const height = Math.round(width * 1.5);
  const radius = `${Math.max(2, width * 0.03)}px ${Math.max(4, width * 0.06)}px ${Math.max(4, width * 0.06)}px ${Math.max(2, width * 0.03)}px`;
  const shadow = "0 18px 40px -16px rgba(17,17,17,0.55)";
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} width={width} height={height} alt="" style={{ objectFit: "cover", borderRadius: radius, boxShadow: shadow }} />;
  }
  const { bg, fg } = coverColors(dedupeKey(book.title, book.author));
  const words = book.title.split(/\s+/);
  const longest = Math.max(1, ...words.map((w) => w.length));
  const size = Math.max(10, Math.min(width * 0.15, (width * 0.74) / (longest * 0.6)));
  return (
    <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width, height, background: bg, color: fg, borderRadius: radius, boxShadow: shadow, padding: width * 0.1 }}>
      <div style={{ display: "flex", fontFamily: "Brygada", fontWeight: 700, fontSize: size, lineHeight: 1.02, letterSpacing: "-0.01em" }}>{book.title}</div>
      <div style={{ display: "flex", fontFamily: "Geist", fontSize: Math.max(8, width * 0.07), opacity: 0.8 }}>{book.author ?? ""}</div>
    </div>
  );
}

export function ScoreDisc({ score, size, top = true }: { score: number; size: number; top?: boolean }) {
  const text = score >= 10 ? "10" : score.toFixed(1);
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: size, height: size, borderRadius: size / 2, background: top ? ACCENT : INK, color: top ? INK : "#FFFFFF", fontFamily: "Brygada", fontWeight: 700, fontSize: size * 0.34 }}>
      {text}
    </div>
  );
}

/** A reader's picture: their chosen icon, or initials on a color. */
export function OgAvatar({ name, icon, color, size }: { name: string; icon: string | null; color: string | null; size: number }) {
  const c = AVATAR_COLOR[color ?? ""] ?? null;
  if (icon && AVATAR_ART[icon]) {
    const cc = c ?? AVATAR_COLOR.ink;
    return (
      <svg width={size} height={size} viewBox="0 0 48 48">
        <circle cx="24" cy="24" r="24" fill={cc.bg} />
        {AVATAR_ART[icon](cc.fg, cc.bg) as ReactNode}
      </svg>
    );
  }
  const parts = name.trim().split(/\s+/);
  const initials = ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: size, height: size, borderRadius: size / 2, background: c?.bg ?? "#2D3FE0", color: c?.fg ?? "#FFFFFF", fontFamily: "Gloock", fontWeight: 400, fontSize: size * 0.36 }}>
      {initials}
    </div>
  );
}

export function clamp(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}
