import type { ReactNode } from "react";
import type { DateProfile } from "@/lib/datingProfile";
import { ACCENT, GROUND, INK, MUTED, OgCover } from "@/lib/og";
import type { PublicBookCard } from "@/lib/public";

/** "My dating profile, by my books" as three Instagram slides (1080×1350). */

export const DATE_SLIDES = 3;
const GREEN = "#2D6A3E";

function Slide({ n, bg, fg, quiet, handle, children }: { n: number; bg: string; fg: string; quiet: string; handle: string | null; children: ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: bg, color: fg, padding: "72px 76px 60px", fontFamily: "Geist" }}>
      <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>{children}</div>
      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "Geist", fontWeight: 600, fontSize: 24, color: quiet }}>
        <span>{n}/{DATE_SLIDES}</span>
        <span>{handle ? `swipe right: readread.app/u/${handle}` : "readread"}</span>
      </div>
    </div>
  );
}

const eyebrow = (color: string) => ({ display: "flex", fontFamily: "Geist", fontWeight: 600, fontSize: 26, letterSpacing: "0.06em", color });
const heading = { display: "flex", fontFamily: "Gloock", fontWeight: 400, fontSize: 96, lineHeight: 0.95, letterSpacing: "-0.015em", marginTop: 14 } as const;

function Flag({ color, check = false }: { color: string; check?: boolean }) {
  return check ? (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12.5l5 5L20 6.5" />
    </svg>
  ) : (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 21V4M5 4h11l-2 4 2 4H5" />
    </svg>
  );
}

function List({ items, color, check }: { items: string[]; color: string; check?: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 46, marginTop: 72 }}>
      {items.map((t) => (
        <div key={t} style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
          <div style={{ display: "flex", marginTop: 6, flexShrink: 0 }}><Flag color={color} check={check} /></div>
          <div style={{ display: "flex", fontFamily: "Brygada", fontWeight: 500, fontSize: 52, lineHeight: 1.2 }}>{t}</div>
        </div>
      ))}
    </div>
  );
}

export function dateSlide(slide: number, p: DateProfile, top: { book: PublicBookCard | null; cover: string | null; tint: string }, handle: string | null): ReactNode {
  if (slide === 1) {
    return (
      <Slide n={1} bg={GROUND} fg={INK} quiet={MUTED} handle={handle}>
        <div style={eyebrow(ACCENT)}>MY DATING PROFILE, BY MY BOOKS</div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 600, marginTop: 30, borderRadius: 36, background: top.tint }}>
          {top.book ? <OgCover book={top.book} src={top.cover} width={340} /> : <div style={{ display: "flex", fontFamily: "Gloock", fontSize: 200, color: "#FFFFFF" }}>?</div>}
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 22, marginTop: 34 }}>
          <div style={{ display: "flex", fontFamily: "Gloock", fontSize: 86, lineHeight: 1, letterSpacing: "-0.015em" }}>{p.name.split(" ")[0]}</div>
          {p.readsLike && <div style={{ display: "flex", fontSize: 34, color: MUTED }}>reads like it&rsquo;s {p.readsLike}</div>}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 22 }}>
          {p.basics.map((b) => (
            <div key={b} style={{ display: "flex", padding: "12px 22px", borderRadius: 999, background: "#ECEBE6", fontSize: 28, fontWeight: 600 }}>{b}</div>
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", marginTop: 30, padding: "26px 30px", borderRadius: 28, background: "#FFFFFF", border: "2px solid #E4E3DE" }}>
          <div style={{ display: "flex", fontSize: 24, fontWeight: 600, letterSpacing: "0.06em", color: MUTED }}>MY IDEAL DATE</div>
          <div style={{ display: "flex", fontFamily: "Brygada", fontWeight: 500, fontSize: 40, lineHeight: 1.2, marginTop: 8 }}>{p.idealDate}</div>
        </div>
      </Slide>
    );
  }
  if (slide === 2) {
    return (
      <Slide n={2} bg={GREEN} fg="#FFFFFF" quiet="rgba(255,255,255,0.72)" handle={handle}>
        <div style={eyebrow("#CFE8D4")}>GREEN FLAGS</div>
        <div style={heading}>why you&rsquo;d swipe right</div>
        <List items={p.green} color="#CFE8D4" check />
      </Slide>
    );
  }
  return (
    <Slide n={3} bg={ACCENT} fg={INK} quiet="rgba(17,17,17,0.72)" handle={handle}>
      <div style={eyebrow(INK)}>RED FLAGS</div>
      <div style={heading}>why you shouldn&rsquo;t</div>
      <List items={p.red} color={INK} />
    </Slide>
  );
}
