import type { ReactNode } from "react";
import { GENRE_BY_KEY } from "@/lib/genres";
import { ACCENT, clamp, GROUND, INK, MUTED, OgCover, ScoreDisc } from "@/lib/og";
import type { PublicBookCard } from "@/lib/public";

/**
 * "My year in books" as four Instagram slides (1080×1350). Made to feel like
 * the reader's own recap, not an ad: readread is only a small mark in the corner.
 */

export const WRAP_SLIDES = 4;
const COBALT = "#2D3FE0";
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export interface WrapBook {
  score: number;
  overall_rank: number;
  finished_on: string;
  book: PublicBookCard & { pages: number | null; genres: string[] | null };
}

export interface WrapData {
  name: string;
  year: number;
  soFar: boolean;
  books: WrapBook[]; // best first
  covers: (string | null)[]; // for the first five
}

function Slide({ n, bg, fg, children }: { n: number; bg: string; fg: string; children: ReactNode }) {
  const quiet = bg === ACCENT ? "rgba(17,17,17,0.72)" : fg === INK ? MUTED : "rgba(255,255,255,0.7)";
  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: bg, color: fg, padding: "80px 80px 64px", fontFamily: "Geist" }}>
      <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>{children}</div>
      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "Geist", fontWeight: 600, fontSize: 22, color: quiet }}>
        <span>{n}/{WRAP_SLIDES}</span>
        <span>readread</span>
      </div>
    </div>
  );
}

const big = (size: number, extra: Record<string, string | number> = {}) => ({
  display: "flex", fontFamily: "Brygada", fontWeight: 700, fontSize: size, letterSpacing: "-0.015em", lineHeight: 0.9, ...extra,
});

/** Slide headings in the header face. */
const head = (size: number, extra: Record<string, string | number> = {}) => ({
  display: "flex", fontFamily: "Gloock", fontWeight: 400, fontSize: size, letterSpacing: "-0.015em", lineHeight: 0.95, ...extra,
});

export function wrapSlide(slide: number, d: WrapData): ReactNode {
  const { books, covers, year } = d;
  const pages = books.reduce((s, b) => s + (b.book.pages ?? 0), 0);
  const label = d.soFar ? `${year}, so far` : `${year}`;

  if (slide === 1) {
    // #1 in the middle, on top.
    const fan = [1, 0, 2].filter((i) => books[i]).map((i) => ({ b: books[i], src: covers[i], i }));
    return (
      <Slide n={1} bg={INK} fg="#FFFFFF">
        <div style={{ display: "flex", fontSize: 34, color: "#C9C8C2" }}>{clamp(d.name, 28)}&apos;s year in books</div>
        <div style={big(260, { marginTop: 18 })}>{year}</div>
        {d.soFar && <div style={{ display: "flex", fontFamily: "Geist", fontWeight: 600, fontSize: 30, color: ACCENT, marginTop: 6 }}>SO FAR</div>}
        <div style={{ display: "flex", gap: 60, marginTop: 50 }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={big(120)}>{books.length}</div>
            <div style={{ display: "flex", fontSize: 32, color: "#C9C8C2", marginTop: 8 }}>{books.length === 1 ? "book" : "books"}</div>
          </div>
          {pages > 0 && (
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={big(120, { color: ACCENT })}>{pages.toLocaleString("en-US")}</div>
              <div style={{ display: "flex", fontSize: 32, color: "#C9C8C2", marginTop: 8 }}>pages</div>
            </div>
          )}
        </div>
        <div style={{ display: "flex", justifyContent: "center", alignItems: "flex-end", marginTop: "auto", marginBottom: 40, height: 360 }}>
          {fan.map(({ b, src, i }) => (
            <div key={b.book.title} style={{ display: "flex", margin: "0 -18px", zIndex: i === 0 ? 2 : 1, transform: `rotate(${i === 0 ? 0 : i === 1 ? -7 : 7}deg) translateY(${i === 0 ? -24 : 0}px)` }}>
              <OgCover book={b.book} src={src} width={i === 0 ? 240 : 200} />
            </div>
          ))}
        </div>
      </Slide>
    );
  }

  if (slide === 2) {
    const top = books.slice(0, 5);
    return (
      <Slide n={2} bg={GROUND} fg={INK}>
        <div style={{ display: "flex", fontFamily: "Geist", fontWeight: 600, fontSize: 28, color: ACCENT, letterSpacing: "0.06em" }}>THE BEST OF {label.toUpperCase()}</div>
        <div style={head(96, { marginTop: 14 })}>my top {top.length}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 22, marginTop: 50 }}>
          {top.map((b, i) => (
            <div key={b.book.title} style={{ display: "flex", alignItems: "center", gap: 28 }}>
              <div style={{ display: "flex", width: 56, fontFamily: "Brygada", fontWeight: 700, fontSize: 52, color: i === 0 ? INK : MUTED }}>{i + 1}</div>
              <OgCover book={b.book} src={covers[i]} width={i === 0 ? 110 : 80} />
              <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
                <div style={{ display: "flex", fontFamily: "Brygada", fontWeight: 700, fontSize: i === 0 ? 46 : 38, lineHeight: 1.02, letterSpacing: "-0.02em" }}>{clamp(b.book.title, 30)}</div>
                <div style={{ display: "flex", fontSize: 26, color: MUTED, marginTop: 4 }}>{clamp(b.book.author ?? "", 32)}</div>
              </div>
              <ScoreDisc score={Number(b.score)} size={i === 0 ? 96 : 78} top={i < 3} />
            </div>
          ))}
        </div>
      </Slide>
    );
  }

  if (slide === 3) {
    const counts = MONTHS.map((_, i) => books.filter((b) => Number(b.finished_on.slice(5, 7)) === i + 1).length);
    const max = Math.max(1, ...counts);
    const busiest = counts.indexOf(Math.max(...counts));
    const longest = [...books].filter((b) => b.book.pages).sort((a, b) => (b.book.pages ?? 0) - (a.book.pages ?? 0))[0];
    const shortest = [...books].filter((b) => b.book.pages).sort((a, b) => (a.book.pages ?? 0) - (b.book.pages ?? 0))[0];
    return (
      <Slide n={3} bg={ACCENT} fg={INK}>
        <div style={{ display: "flex", fontFamily: "Geist", fontWeight: 600, fontSize: 28, letterSpacing: "0.06em" }}>MONTH BY MONTH</div>
        <div style={head(96, { marginTop: 14 })}>how it went</div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 14, height: 520, marginTop: 56 }}>
          {counts.map((c, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1, gap: 12 }}>
              {c > 0 && <div style={{ display: "flex", fontFamily: "Brygada", fontWeight: 700, fontSize: 24 }}>{c}</div>}
              <div style={{ display: "flex", width: "100%", height: Math.max(10, (c / max) * 430), borderRadius: 10, background: c ? INK : "rgba(17,17,17,0.18)" }} />
              <div style={{ display: "flex", fontFamily: "Geist", fontWeight: 600, fontSize: 22 }}>{MONTHS[i][0]}</div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18, marginTop: "auto", marginBottom: 40, fontSize: 34, lineHeight: 1.25 }}>
          {counts[busiest] > 1 && <div style={{ display: "flex" }}>busiest month: {MONTHS[busiest].toLowerCase()} ({counts[busiest]} books)</div>}
          {longest && <div style={{ display: "flex" }}>longest: {clamp(longest.book.title, 28)} ({(longest.book.pages ?? 0).toLocaleString("en-US")} pages)</div>}
          {shortest && shortest !== longest && <div style={{ display: "flex" }}>shortest: {clamp(shortest.book.title, 28)} ({shortest.book.pages} pages)</div>}
        </div>
      </Slide>
    );
  }

  // Slide 4: what I read.
  const genreCounts = Object.entries(
    books.reduce<Record<string, number>>((acc, b) => {
      for (const g of b.book.genres ?? []) if (GENRE_BY_KEY[g]) acc[g] = (acc[g] ?? 0) + 1;
      return acc;
    }, {}),
  ).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const maxG = Math.max(1, ...genreCounts.map(([, n]) => n));
  const authors = new Set(books.map((b) => b.book.author?.toLowerCase()).filter(Boolean)).size;
  const loved = books.filter((b) => Number(b.score) >= 6.7).length;
  return (
    <Slide n={4} bg={COBALT} fg="#FFFFFF">
      <div style={{ display: "flex", fontFamily: "Geist", fontWeight: 600, fontSize: 28, letterSpacing: "0.06em", color: "#E7E9FD" }}>WHAT I READ</div>
      <div style={head(96, { marginTop: 14 })}>{genreCounts[0] ? `mostly ${GENRE_BY_KEY[genreCounts[0][0]].label.toLowerCase()}` : "a bit of everything"}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 30, marginTop: 70 }}>
        {genreCounts.map(([g, n]) => (
          <div key={g} style={{ display: "flex", alignItems: "center", gap: 24 }}>
            <div style={{ display: "flex", width: 220, fontSize: 34 }}>{GENRE_BY_KEY[g].label.toLowerCase()}</div>
            <div style={{ display: "flex", flex: 1, height: 52 }}>
              <div style={{ display: "flex", width: `${(n / maxG) * 100}%`, height: 52, borderRadius: 10, background: GENRE_BY_KEY[g].bg === COBALT ? "#FFFFFF" : GENRE_BY_KEY[g].bg }} />
            </div>
            <div style={{ display: "flex", width: 60, justifyContent: "flex-end", fontFamily: "Brygada", fontWeight: 700, fontSize: 30 }}>{n}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 60, marginTop: "auto", marginBottom: 40 }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={big(100)}>{authors}</div>
          <div style={{ display: "flex", fontSize: 30, color: "#E7E9FD", marginTop: 8 }}>different authors</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={big(100, { color: ACCENT })}>{loved}</div>
          <div style={{ display: "flex", fontSize: 30, color: "#E7E9FD", marginTop: 8 }}>{loved === 1 ? "book I loved" : "books I loved"}</div>
        </div>
      </div>
    </Slide>
  );
}
