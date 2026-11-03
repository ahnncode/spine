import Link from "next/link";
import { AVATAR_ART } from "@/components/AvatarArt";
import { AVATAR_COLOR } from "@/lib/avatars";
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

/** Just the picture: a chosen icon on its color. */
export function AvatarIconArt({ icon, color, size }: { icon: string; color: string; size: number }) {
  const c = AVATAR_COLOR[color] ?? AVATAR_COLOR.ink;
  const art = AVATAR_ART[icon];
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" style={{ display: "block", flexShrink: 0 }}>
      <circle cx="24" cy="24" r="24" fill={c.bg} />
      {art?.(c.fg, c.bg)}
    </svg>
  );
}

type AvatarProfile = Pick<Profile, "id" | "display_name" | "username"> & Partial<Pick<Profile, "avatar_icon" | "avatar_color">>;

export function Avatar({ profile, size = 40, link = false }: { profile: AvatarProfile | undefined | null; size?: number; link?: boolean }) {
  const name = displayName(profile);
  const el =
    profile?.avatar_icon && AVATAR_ART[profile.avatar_icon] ? (
      <span className="avatar avatar--art" style={{ width: size, height: size }} aria-hidden={link ? undefined : true}>
        <AvatarIconArt icon={profile.avatar_icon} color={profile.avatar_color ?? "ink"} size={size} />
      </span>
    ) : (
      <span
        className="avatar"
        style={{
          width: size, height: size, fontSize: Math.round(size * 0.35),
          background: profile?.avatar_color ? AVATAR_COLOR[profile.avatar_color]?.bg ?? colorFor(profile.id) : colorFor(profile?.id ?? name),
          color: profile?.avatar_color ? AVATAR_COLOR[profile.avatar_color]?.fg : undefined,
        }}
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
