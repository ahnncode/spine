import { cacheLife } from "next/cache";

/**
 * Server-side reads of public data (no account): book pages, opt-in profiles,
 * and link previews. Uses the public key; the database decides what's safe.
 */

export interface PublicBookCard {
  title: string;
  author: string | null;
  cover_id: number | null;
  cover_url: string | null;
  isbn13: string | null;
}

export interface PublicBook extends PublicBookCard {
  id: string;
  year: number | null;
  pages: number | null;
  genres: string[];
  avg_score: number | null;
  readers: number;
  loved: number;
  public_readers: { username: string; display_name: string | null; avatar_icon: string | null; avatar_color: string | null; score: number }[];
}

export interface PublicProfile {
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_icon: string | null;
  avatar_color: string | null;
  joined: string;
  ranked: number;
  followers: number;
  top: (PublicBookCard & { book_id: string; score: number; rank: number })[];
  reading: (PublicBookCard & { book_id: string })[];
  badges: string[];
}

export interface ReadAlongCard extends PublicBookCard {
  readers: number;
  revealed: boolean;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const USERNAME = /^[a-z0-9_]{3,20}$/i;

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  try {
    const res = await fetch(`${url}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(args),
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    return ((await res.json()) as T) ?? null;
  } catch {
    return null;
  }
}

export async function getPublicBook(id: string): Promise<PublicBook | null> {
  "use cache";
  cacheLife("minutes");
  if (!UUID.test(id)) return null;
  const b = await rpc<PublicBook>("public_book", { p_id: id });
  return b ? { ...b, avg_score: b.avg_score == null ? null : Number(b.avg_score) } : null;
}

export async function getPublicProfile(username: string): Promise<PublicProfile | null> {
  "use cache";
  cacheLife("minutes");
  if (!USERNAME.test(username)) return null;
  const p = await rpc<PublicProfile>("public_profile", { p_username: username });
  return p ? { ...p, top: p.top.map((t) => ({ ...t, score: Number(t.score) })) } : null;
}

export async function getReadAlongCard(id: string): Promise<ReadAlongCard | null> {
  "use cache";
  cacheLife("minutes");
  if (!UUID.test(id)) return null;
  return rpc<ReadAlongCard>("read_along_card", { p_id: id });
}

export async function getSitemapEntries(): Promise<{ kind: "profile" | "book"; key: string; updated: string }[]> {
  "use cache";
  cacheLife("hours");
  return (await rpc<{ kind: "profile" | "book"; key: string; updated: string }[]>("public_sitemap", {})) ?? [];
}

export const SITE_URL = "https://readspine.app";
