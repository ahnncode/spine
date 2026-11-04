import { ImageResponse } from "next/og";
import { clamp, coverData, GROUND, INK, MUTED, OgAvatar, OgCover, ogFonts, Wordmark } from "@/lib/og";
import { getPublicProfile } from "@/lib/public";

export const alt = "A reader on ReadRead";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Link preview for a profile: who they are and their top three (only for public profiles). */
export default async function Image({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const [p, fonts] = await Promise.all([getPublicProfile(username), ogFonts()]);
  const top = p ? p.top.slice(0, 3) : [];
  const covers = await Promise.all(top.map((b) => coverData(b)));
  const name = p ? p.display_name || p.username : `@${username.toLowerCase()}`;
  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", background: GROUND, padding: "64px 72px", gap: 48, alignItems: "center", fontFamily: "Geist", color: INK }}>
        <div style={{ display: "flex", flexDirection: "column", flex: 1, height: "100%" }}>
          <Wordmark s={44} />
          <div style={{ display: "flex", alignItems: "center", gap: 26, marginTop: "auto" }}>
            <OgAvatar name={name} icon={p?.avatar_icon ?? null} color={p?.avatar_color ?? null} size={128} />
            <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
              <div style={{ display: "flex", fontFamily: "Bricolage", fontWeight: 800, fontSize: name.length > 18 ? 52 : 64, lineHeight: 1, letterSpacing: "-0.04em" }}>{clamp(name, 28)}</div>
              <div style={{ display: "flex", marginTop: 10, fontSize: 26, color: MUTED }}>
                {p ? `@${p.username} · ${p.ranked} ranked` : "is ranking books on ReadRead"}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", marginTop: "auto", fontSize: 28, lineHeight: 1.35, color: "#3D3D3A" }}>
            {p?.bio ? `“${clamp(p.bio, 110)}”` : "Rank books, not stars. Compare taste with friends."}
          </div>
        </div>
        {top.length > 0 && (
          <div style={{ display: "flex", alignItems: "flex-end", width: 430, height: 420, position: "relative" }}>
            {top.map((b, i) => (
              <div key={b.book_id} style={{ display: "flex", position: "absolute", left: i * 120, bottom: i === 0 ? 40 : i === 1 ? 20 : 0, transform: `rotate(${(i - 1) * 4}deg)` }}>
                <OgCover book={b} src={covers[i]} width={190} />
                <div style={{ display: "flex", position: "absolute", top: -20, left: 14, padding: "4px 14px", borderRadius: 999, border: "3px solid #F7F7F5", background: i === 0 ? "#FF5A1F" : INK, color: i === 0 ? INK : "#fff", fontFamily: "GeistMono", fontSize: 22 }}>#{i + 1}</div>
              </div>
            )).reverse()}
          </div>
        )}
      </div>
    ),
    { ...size, fonts },
  );
}
