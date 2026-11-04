import { ImageResponse } from "next/og";
import { ACCENT, clamp, coverData, GROUND, INK, MUTED, OgCover, ogFonts, Wordmark } from "@/lib/og";
import { getReadAlongCard } from "@/lib/public";

export const alt = "A read-along on readread";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Link preview for a read-along: the book and how many are reading (never who). */
export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [card, fonts] = await Promise.all([getReadAlongCard(id), ogFonts()]);
  const src = card ? await coverData(card) : null;
  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", background: GROUND, padding: "64px 72px", gap: 64, alignItems: "center", fontFamily: "Geist", color: INK }}>
        {card && <OgCover book={card} src={src} width={300} />}
        <div style={{ display: "flex", flexDirection: "column", flex: 1, height: "100%" }}>
          <Wordmark s={44} />
          <div style={{ display: "flex", flexDirection: "column", marginTop: "auto" }}>
            <div style={{ display: "flex", fontFamily: "GeistMono", fontSize: 22, color: ACCENT, letterSpacing: "0.08em" }}>
              {card?.revealed ? "THE VERDICT IS IN" : "READING TOGETHER"}
            </div>
            <div style={{ display: "flex", marginTop: 14, fontFamily: "Bricolage", fontWeight: 800, fontSize: 68, lineHeight: 0.98, letterSpacing: "-0.04em" }}>{card ? clamp(card.title, 60) : "A read-along"}</div>
            {card?.author && <div style={{ display: "flex", marginTop: 14, fontSize: 30, color: MUTED }}>{clamp(card.author, 50)}</div>}
          </div>
          <div style={{ display: "flex", marginTop: "auto", fontSize: 26 }}>
            {card ? `${card.readers} reader${card.readers === 1 ? "" : "s"} · progress, spoiler-safe chat, and a score reveal` : "Read a book with friends on readread"}
          </div>
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
