import type { ReactNode } from "react";
import { GROUND, INK, MUTED } from "@/lib/og";
import { withArticle, type AxisResult, type ReaderType } from "@/lib/readerType";

/** "My reader type" as three Instagram slides (1080×1350): the type, why I read, the receipts. */

export const TYPE_SLIDES = 3;

function Slide({ n, bg, fg, quiet, handle, children }: { n: number; bg: string; fg: string; quiet: string; handle: string | null; children: ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: bg, color: fg, padding: "72px 76px 60px", fontFamily: "Geist" }}>
      <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>{children}</div>
      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "Geist", fontWeight: 600, fontSize: 24, color: quiet }}>
        <span>{n}/{TYPE_SLIDES}</span>
        <span>{handle ? `what’s yours? readread.app/u/${handle}` : "what’s yours? readread.app"}</span>
      </div>
    </div>
  );
}

const eyebrow = (color: string) => ({ display: "flex", fontFamily: "Geist", fontWeight: 600, fontSize: 26, letterSpacing: "0.08em", color });

/** One spectrum: both pole names, a track, and a dot where this reader sits. */
function Spectrum({ a, fg, quiet, track }: { a: AxisResult; fg: string; quiet: string; track: string }) {
  const first = a.pct >= 50;
  const [left, right] = first ? [a.pole, a.other] : [a.other, a.pole];
  const strong = (on: boolean) => ({ display: "flex", fontWeight: 600, fontSize: 28, color: on ? fg : quiet });
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={strong(first)}>{left.name}</span>
        <span style={{ display: "flex", fontFamily: "Brygada", fontWeight: 700, fontSize: 30, color: fg }}>
          {a.strength === "balanced" ? "balanced" : `${first ? a.pct : 100 - a.pct}% ${a.pole.name.toLowerCase()}`}
        </span>
        <span style={strong(!first)}>{right.name}</span>
      </div>
      <div style={{ display: "flex", position: "relative", height: 14, borderRadius: 7, background: track }}>
        {/* Fill from the middle out to where this reader sits. */}
        <div style={{ display: "flex", position: "absolute", top: 0, bottom: 0, borderRadius: 7, background: fg, left: `${Math.min(50, 100 - a.pct)}%`, width: `${Math.abs(a.pct - 50)}%` }} />
        <div style={{ display: "flex", position: "absolute", top: -9, width: 32, height: 32, marginLeft: -16, borderRadius: 16, background: fg, left: `${100 - a.pct}%` }} />
      </div>
    </div>
  );
}

export function typeSlide(slide: number, t: ReaderType, name: string, handle: string | null): ReactNode {
  const f = { ...t.family, bg: t.color.bg, fg: t.color.fg, soft: t.color.fg === INK ? "rgba(17,17,17,0.18)" : "rgba(255,255,255,0.28)" };
  if (slide === 1) {
    return (
      <Slide n={1} bg={f.bg} fg={f.fg} quiet={f.fg === INK ? "rgba(17,17,17,0.6)" : "rgba(255,255,255,0.72)"} handle={handle}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <div style={eyebrow(f.fg)}>{`${name.split(" ")[0].toUpperCase()}’S READER TYPE`}</div>
          <div style={eyebrow(f.fg)}>{f.label.toUpperCase()}</div>
        </div>
        <div style={{ display: "flex", fontFamily: "Gloock", fontSize: 250, lineHeight: 0.9, letterSpacing: "0.02em", marginTop: 40 }}>{t.code}</div>
        <div style={{ display: "flex", fontFamily: "Gloock", fontSize: 92, lineHeight: 1, letterSpacing: "-0.015em", marginTop: 18 }}>{t.copy.name}</div>
        <div style={{ display: "flex", fontFamily: "Brygada", fontWeight: 500, fontSize: 44, lineHeight: 1.2, marginTop: 18 }}>{t.copy.tagline}</div>
        <div style={{ display: "flex", fontSize: 30, lineHeight: 1.3, marginTop: 28, opacity: 0.8 }}>{`${f.label} ${f.gist.toLowerCase()}. Driven by ${t.drive.label.toLowerCase()}.`}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 34, marginTop: "auto", marginBottom: 44 }}>
          {t.axes.map((a) => <Spectrum key={a.key} a={a} fg={f.fg} quiet={f.fg === INK ? "rgba(17,17,17,0.55)" : "rgba(255,255,255,0.6)"} track={f.soft} />)}
        </div>
      </Slide>
    );
  }
  if (slide === 2) {
    const d = t.drive;
    const quiet = d.fg === INK ? "rgba(17,17,17,0.62)" : "rgba(255,255,255,0.7)";
    return (
      <Slide n={2} bg={d.bg} fg={d.fg} quiet={quiet} handle={handle}>
        <div style={eyebrow(d.fg)}>WHY I READ</div>
        <div style={{ display: "flex", fontFamily: "Gloock", fontSize: 170, lineHeight: 0.95, letterSpacing: "-0.02em", marginTop: 40 }}>{d.label}</div>
        {t.wing && <div style={{ display: "flex", fontFamily: "Gloock", fontSize: 54, marginTop: 10, color: quiet }}>{`with ${withArticle(t.wing.label.toLowerCase())} wing`}</div>}
        <div style={{ display: "flex", fontFamily: "Brygada", fontWeight: 500, fontSize: 54, lineHeight: 1.18, marginTop: 56 }}>{d.desire}</div>
        <div style={{ display: "flex", flexDirection: "column", marginTop: 40 }}>
          <div style={eyebrow(quiet)}>WHAT LOSES ME</div>
          <div style={{ display: "flex", fontFamily: "Brygada", fontWeight: 500, fontSize: 40, lineHeight: 1.2, marginTop: 10 }}>{d.shadow}</div>
        </div>
        <div style={{ display: "flex", gap: 18, marginTop: "auto", marginBottom: 44 }}>
          {t.stats.map((s) => (
            <div key={s.label} style={{ display: "flex", flexDirection: "column", flex: 1, padding: "24px 26px", borderRadius: 28, background: d.fg === INK ? "rgba(17,17,17,0.08)" : "rgba(255,255,255,0.12)" }}>
              <div style={{ display: "flex", fontFamily: "Brygada", fontWeight: 700, fontSize: 60, lineHeight: 1 }}>{s.value}</div>
              <div style={{ display: "flex", fontSize: 24, fontWeight: 600, marginTop: 10, color: quiet }}>{s.label}</div>
            </div>
          ))}
        </div>
      </Slide>
    );
  }
  return (
    <Slide n={3} bg={GROUND} fg={INK} quiet={MUTED} handle={handle}>
      <div style={eyebrow(MUTED)}>THE RECEIPTS</div>
      <div style={{ display: "flex", fontFamily: "Gloock", fontSize: 84, lineHeight: 1, letterSpacing: "-0.015em", marginTop: 14 }}>{`Why I’m ${t.code}`}</div>
      <div style={{ display: "flex", fontSize: 28, color: MUTED, marginTop: 14 }}>{`Worked out from ${t.bookCount} books I’ve ranked. Not a quiz.`}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 36, marginTop: 56 }}>
        {t.axes.map((a) => (
          <div key={a.key} style={{ display: "flex", gap: 28, alignItems: "flex-start" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, width: 96, height: 96, borderRadius: 24, background: f.bg, color: f.fg, fontFamily: "Gloock", fontSize: 60 }}>{a.pole.letter}</div>
            <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
              <div style={{ display: "flex", fontWeight: 600, fontSize: 26, letterSpacing: "0.04em", color: MUTED }}>{`${a.pole.name.toUpperCase()}${a.strength === "balanced" ? " (JUST)" : ""}`}</div>
              <div style={{ display: "flex", fontFamily: "Brygada", fontWeight: 500, fontSize: 40, lineHeight: 1.18, marginTop: 6 }}>{a.receipts[0] ?? a.pole.blurb}</div>
            </div>
          </div>
        ))}
      </div>
    </Slide>
  );
}
