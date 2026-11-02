import Link from "next/link";
import type { Profile } from "@/lib/data";

const COLORS = ["#2D3FE0", "#0F5257", "#7A2E4D", "#B5452B", "#3E6B48", "#1F3A5F", "#111111"];

function colorFor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (Math.imul(h, 31) + id.charCodeAt(i)) | 0;
  return COLORS[Math.abs(h) % COLORS.length];
}

export function displayName(p: Pick<Profile, "display_name" | "username"> | undefined | null): string {
  return p?.display_name || p?.username || "Reader";
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

export function Avatar({ profile, size = 40, link = false }: { profile: Profile | undefined | null; size?: number; link?: boolean }) {
  const name = displayName(profile);
  const el = (
    <span
      className="avatar"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.35), background: colorFor(profile?.id ?? name) }}
      aria-hidden={link ? undefined : true}
    >
      {initials(name)}
    </span>
  );
  return link && profile?.username ? (
    <Link href={`/u/${profile.username}`} aria-label={name} style={{ textDecoration: "none", flexShrink: 0 }}>
      {el}
    </Link>
  ) : (
    el
  );
}
