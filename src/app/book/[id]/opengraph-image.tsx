import { ImageResponse } from "next/og";
import { ACCENT, clamp, coverData, GROUND, INK, MUTED, OgCover, ogFonts, ScoreDisc, Wordmark } from "@/lib/og";
import { getPublicBook } from "@/lib/public";

export const alt = "A book on ReadRead";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Link preview for a book: its cover, title, and ReadRead score. */
export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [book, fonts] = await Promise.all([getPublicBook(id), ogFonts()]);
  const src = book ? await coverData(book) : null;
  const title = book ? clamp(book.title, 70) : "Rank books, not stars.";
  const titleSize = title.length > 45 ? 56 : title.length > 24 ? 68 : 84;
  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", background: GROUND, padding: "64px 72px", gap: 64, alignItems: "center", fontFamily: "Geist", color: INK }}>
        {book && <OgCover book={book} src={src} width={300} />}
        <div style={{ display: "flex", flexDirection: "column", flex: 1, height: "100%" }}>
          <Wordmark s={44} />
          <div style={{ display: "flex", flexDirection: "column", marginTop: "auto" }}>
            <div style={{ display: "flex", fontFamily: "Bricolage", fontWeight: 800, fontSize: titleSize, lineHeight: 0.98, letterSpacing: "-0.04em" }}>{title}</div>
            {book?.author && <div style={{ display: "flex", marginTop: 16, fontSize: 32, color: MUTED }}>{clamp(book.author, 50)}</div>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 22, marginTop: "auto" }}>
            {book?.avg_score != null ? (
              <>
                <ScoreDisc score={book.avg_score} size={84} top={book.avg_score >= 6.7} />
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <div style={{ display: "flex", fontFamily: "Bricolage", fontWeight: 700, fontSize: 30 }}>ReadRead score</div>
                  <div style={{ display: "flex", fontSize: 22, color: MUTED }}>
                    {book.readers} reader{book.readers === 1 ? "" : "s"} · {book.readers ? Math.round((book.loved / book.readers) * 100) : 0}% loved it
                  </div>
                </div>
              </>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 26, color: INK }}>
                <div style={{ display: "flex", width: 14, height: 14, borderRadius: 7, background: ACCENT }} />
                Rank it on ReadRead
              </div>
            )}
          </div>
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
