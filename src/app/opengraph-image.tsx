import { ImageResponse } from "next/og";
import { ogFonts } from "@/lib/og";

export const alt = "readread: rank books, not stars";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const fonts = await ogFonts();

const BOOKS = [
  { rank: 1, title: "Middlemarch", author: "George Eliot", letter: "M", bg: "#3E6B48", fg: "#F4F0E6", score: "10", top: true },
  { rank: 2, title: "Lonesome Dove", author: "Larry McMurtry", letter: "L", bg: "#B5452B", fg: "#FBEFE3", score: "9.3", top: true },
  { rank: 3, title: "Piranesi", author: "Susanna Clarke", letter: "P", bg: "#1F3A5F", fg: "#F2EBDD", score: "8.8", top: false },
];

function Mark({ s }: { s: number }) {
  const bar = (w: string, color: string) => (
    <div style={{ display: "flex", height: s * 0.15, width: w, borderRadius: s * 0.04, background: color }} />
  );
  return (
    <div
      style={{
        display: "flex", flexDirection: "column", justifyContent: "center", gap: s * 0.07,
        width: s, height: s, borderRadius: s * 0.23, background: "#111111", padding: `0 ${s * 0.2}px`,
      }}
    >
      {bar("100%", "#FF5A1F")}
      {bar("80%", "#FFFFFF")}
      {bar("60%", "rgba(255,255,255,0.55)")}
    </div>
  );
}

/** The link preview people see when readread.app is shared. */
export default function Image() {
  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", background: "#F7F7F5", color: "#111111", padding: "72px 80px", alignItems: "center", gap: 64, fontFamily: "Geist" }}>
        <div style={{ display: "flex", flexDirection: "column", flex: 1, height: "100%" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <Mark s={56} />
            <div style={{ fontFamily: "Gloock", fontWeight: 400, fontSize: 44, letterSpacing: "-0.015em" }}>readread</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", marginTop: "auto", fontFamily: "Gloock", fontWeight: 400, fontSize: 96, lineHeight: 0.92, letterSpacing: "-0.015em" }}>
            <span>Rank books,</span>
            <span>not stars.</span>
          </div>
          <div style={{ display: "flex", marginTop: 26, fontSize: 26, lineHeight: 1.35, color: "#3D3D3A" }}>
            Rank books against each other, and see what your friends can’t put down.
          </div>
          <div style={{ display: "flex", marginTop: "auto", fontFamily: "Geist", fontWeight: 600, fontSize: 20, color: "#5E5E5A" }}>readread.app</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", width: 400, background: "#FFFFFF", border: "1px solid #E4E3DE", borderRadius: 28, padding: 10, gap: 4 }}>
          {BOOKS.map((b) => (
            <div key={b.rank} style={{ display: "flex", alignItems: "center", gap: 16, padding: "14px 16px", borderRadius: 20, background: b.rank === 3 ? "#FFF1EA" : "transparent" }}>
              <div style={{ display: "flex", width: 22, fontFamily: "Brygada", fontWeight: 700, fontSize: 18, color: "#5E5E5A" }}>{b.rank}</div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 48, height: 72, borderRadius: "3px 7px 7px 3px", background: b.bg, color: b.fg, fontFamily: "Gloock", fontWeight: 400, fontSize: 26 }}>
                {b.letter}
              </div>
              <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
                <div style={{ fontFamily: "Brygada", fontWeight: 700, fontSize: 22 }}>{b.title}</div>
                <div style={{ fontSize: 16, color: "#5E5E5A" }}>{b.author}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 56, height: 56, borderRadius: 28, background: b.top ? "#FF5A1F" : "#111111", color: b.top ? "#111111" : "#FFFFFF", fontFamily: "Brygada", fontWeight: 700, fontSize: 18 }}>
                {b.score}
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
    {
      ...size,
      fonts,
    },
  );
}
