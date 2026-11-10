import type { ReactNode } from "react";
import { TYPE_COLOR } from "@/lib/readerTypeCopy";

/**
 * One profile-picture icon per reader type, drawn on the same 48×48 grid as
 * the other avatar icons. `f` is the icon color, `b` the background (used for
 * cut-outs). Each sits on its type's own color.
 */
type Art = (f: string, b: string) => ReactNode;

export const TYPE_ART: Record<string, Art> = {
  // The Pen Pal: a letter, sealed with a heart.
  WHFE: (f, b) => (
    <>
      <rect x="10" y="15" width="28" height="19" rx="2.5" fill={f} />
      <path d="M11 16.5l13 10 13-10" stroke={b} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M24 33.2c-3.2-2.2-4.8-3.9-4.8-5.8a2.4 2.4 0 0 1 4.8-.9 2.4 2.4 0 0 1 4.8.9c0 1.9-1.6 3.6-4.8 5.8z" fill={f} stroke={b} strokeWidth="1.4" />
    </>
  ),
  // The Witness: an open eye.
  WHFC: (f, b) => (
    <>
      <path d="M8 24c4.5-6.8 10-10 16-10s11.5 3.2 16 10c-4.5 6.8-10 10-16 10S12.5 30.8 8 24z" fill={f} />
      <circle cx="24" cy="24" r="6.2" fill={b} />
      <circle cx="24" cy="24" r="3" fill={f} />
      <circle cx="25.6" cy="22.4" r="1" fill={b} />
    </>
  ),
  // The Magpie: a bird with something shiny.
  WHGE: (f, b) => (
    <>
      <path d="M12 29c2-6.5 7-10.5 13-10.5 2.6 0 4.6.9 6 2.3l5-1.3-3 3.8c.2 5.6-4.4 10-10.5 10.2H16l-6.5 5.5 2.7-7.6z" fill={f} />
      <circle cx="29.5" cy="22.6" r="1.2" fill={b} />
      <path d="M17 26.5c2.5 1.3 5.5 1.6 8.5.6" stroke={b} strokeWidth="1.4" strokeLinecap="round" fill="none" />
      <path d="M36 10.5l.9 2.3 2.3.9-2.3.9-.9 2.3-.9-2.3-2.3-.9 2.3-.9z" fill={f} />
    </>
  ),
  // The Sommelier: a wine glass.
  WHGC: (f) => (
    <>
      <path d="M16.5 11h15c.5 8.5-2.2 13.6-7.5 14.2-5.3-.6-8-5.7-7.5-14.2z" fill={f} />
      <rect x="22.8" y="24.5" width="2.4" height="9.5" fill={f} />
      <rect x="17.5" y="33.5" width="13" height="2.6" rx="1.3" fill={f} />
    </>
  ),
  // The Cartographer: a folded map with a route.
  WMFE: (f, b) => (
    <>
      <path d="M9 15l9.5-3 11 3 9.5-3v21l-9.5 3-11-3L9 36z" fill={f} />
      <path d="M18.5 12v21M29.5 15v21" stroke={b} strokeWidth="1.2" opacity="0.6" />
      <path d="M13.5 30c3-1 4-4.5 7.5-5s5 2.2 8-.2" stroke={b} strokeWidth="1.6" strokeLinecap="round" strokeDasharray="0.1 3.2" fill="none" />
      <path d="M31.5 21l3.6 3.6M35.1 21l-3.6 3.6" stroke={b} strokeWidth="1.8" strokeLinecap="round" />
    </>
  ),
  // The Examiner: a magnifying glass.
  WMFC: (f, b) => (
    <>
      <circle cx="21" cy="21" r="10" fill={f} />
      <circle cx="21" cy="21" r="6.6" fill={b} />
      <path d="M17.6 18.5a4.6 4.6 0 0 1 3.4-1.9" stroke={f} strokeWidth="1.6" strokeLinecap="round" fill="none" />
      <rect x="27.5" y="27" width="5" height="13" rx="2.5" fill={f} transform="rotate(-45 30 33.5)" />
    </>
  ),
  // The Polymath: orbits around one bright idea.
  WMGE: (f) => (
    <>
      <ellipse cx="24" cy="24" rx="15" ry="5.6" stroke={f} strokeWidth="2" fill="none" />
      <ellipse cx="24" cy="24" rx="15" ry="5.6" stroke={f} strokeWidth="2" fill="none" transform="rotate(60 24 24)" />
      <ellipse cx="24" cy="24" rx="15" ry="5.6" stroke={f} strokeWidth="2" fill="none" transform="rotate(-60 24 24)" />
      <circle cx="24" cy="24" r="3.4" fill={f} />
    </>
  ),
  // The Scout: binoculars.
  WMGC: (f, b) => (
    <>
      <rect x="15" y="13" width="5" height="9" rx="1.5" fill={f} />
      <rect x="28" y="13" width="5" height="9" rx="1.5" fill={f} />
      <rect x="20" y="19" width="8" height="4" fill={f} />
      <circle cx="16.5" cy="28.5" r="7" fill={f} />
      <circle cx="31.5" cy="28.5" r="7" fill={f} />
      <circle cx="16.5" cy="28.5" r="3.6" fill={b} />
      <circle cx="31.5" cy="28.5" r="3.6" fill={b} />
    </>
  ),
  // The Devotee: a heart held close.
  DHFE: (f, b) => (
    <>
      <path d="M24 37c-8.5-5.6-13-10.3-13-15.6A6.6 6.6 0 0 1 24 18.6a6.6 6.6 0 0 1 13 2.8C37 26.7 32.5 31.4 24 37z" fill={f} />
      <path d="M17 21.5a3.5 3.5 0 0 1 3-2.6" stroke={b} strokeWidth="1.6" strokeLinecap="round" fill="none" />
    </>
  ),
  // The Purist: a cut gem.
  DHFC: (f, b) => (
    <>
      <path d="M15 14h18l6 7.5L24 37 9 21.5z" fill={f} />
      <path d="M9 21.5h30M19 14l-2.5 7.5L24 37l7.5-15.5L29 14M16.5 21.5L24 14l7.5 7.5" stroke={b} strokeWidth="1.3" strokeLinejoin="round" fill="none" />
    </>
  ),
  // The Romantic: a rose.
  DHGE: (f, b) => (
    <>
      <path d="M24 10.5c5.8 0 9 3.6 9 8.3 0 5-4 8.4-9 8.4s-9-3.4-9-8.4c0-4.7 3.2-8.3 9-8.3z" fill={f} />
      <path d="M24 14.5c2.6 0 4 1.6 4 3.6 0 2.2-1.8 3.6-4 3.6M24 14.5c-2.1.4-3.4 2-3.2 4M20 21.6c1.6 1.6 4.8 2 7.6.3" stroke={b} strokeWidth="1.4" strokeLinecap="round" fill="none" />
      <path d="M24 27v11" stroke={f} strokeWidth="2.2" strokeLinecap="round" />
      <path d="M24 33c-2.2-3.3-5.4-4-8-3.2 1 3.1 4.6 4.4 8 3.2zM24 31.5c2-2.6 4.6-3.2 7-2.6-.9 2.6-3.9 3.6-7 2.6z" fill={f} />
    </>
  ),
  // The Connoisseur: a prize rosette.
  DHGC: (f, b) => (
    <>
      <path d="M18.5 27.5L15 39l4.6-2.3L22.5 40l1.5-11.5zM29.5 27.5L33 39l-4.6-2.3L25.5 40 24 28.5z" fill={f} />
      {Array.from({ length: 12 }, (_, i) => (
        <circle key={i} cx={24 + 9.6 * Math.cos((i * Math.PI) / 6)} cy={20 + 9.6 * Math.sin((i * Math.PI) / 6)} r="3.4" fill={f} />
      ))}
      <circle cx="24" cy="20" r="9.6" fill={f} />
      <circle cx="24" cy="20" r="6" fill="none" stroke={b} strokeWidth="1.4" />
      <path d="M24 16.6l1.1 2.2 2.4.3-1.8 1.7.5 2.4-2.2-1.2-2.2 1.2.5-2.4-1.8-1.7 2.4-.3z" fill={b} />
    </>
  ),
  // The Completionist: the whole series, checked off.
  DMFE: (f, b) => (
    <>
      <rect x="10" y="14" width="6" height="22" rx="1" fill={f} />
      <rect x="17.5" y="11" width="6" height="25" rx="1" fill={f} />
      <rect x="25" y="16" width="6" height="20" rx="1" fill={f} />
      <rect x="31.5" y="17" width="6" height="19" rx="1" fill={f} transform="rotate(12 34.5 36)" />
      <path d="M10 31h6M17.5 31h6M25 31h6" stroke={b} strokeWidth="1.2" />
      <path d="M8 38.5h32" stroke={f} strokeWidth="2.2" strokeLinecap="round" />
    </>
  ),
  // The Scholar: a mortarboard.
  DMFC: (f, b) => (
    <>
      <path d="M24 12L42 20l-18 8-18-8z" fill={f} />
      <path d="M15 24v7c0 2.5 4 4.5 9 4.5s9-2 9-4.5v-7l-9 4z" fill={f} />
      <path d="M15 24l9 4 9-4" stroke={b} strokeWidth="1.3" fill="none" />
      <path d="M38 21.5v8.5" stroke={f} strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="38" cy="31.5" r="2" fill={f} />
    </>
  ),
  // The Burrower: one hill, several burrows.
  DMGE: (f, b) => (
    <>
      <path d="M5.5 37C7.5 24.5 15 17 24 17s16.5 7.5 18.5 20z" fill={f} />
      <path d="M12 37v-2.6a3.6 3.6 0 0 1 7.2 0V37z" fill={b} />
      <path d="M20.6 29.5v-2.4a3.4 3.4 0 0 1 6.8 0v2.4z" fill={b} />
      <path d="M28.8 37v-2.6a3.6 3.6 0 0 1 7.2 0V37z" fill={b} />
      <path d="M15.6 34.4c1.2-2.2 3.4-3.6 5.4-3.8M27 30.5c2 .4 3.6 1.8 4.4 3.9" stroke={b} strokeWidth="1.3" strokeLinecap="round" strokeDasharray="0.1 2.6" fill="none" />
    </>
  ),
  // The Skeptic: a raised eyebrow over a narrowed look.
  DMGC: (f, b) => (
    <>
      <path d="M12 21.5c3.5-3 7-3.5 10-2" stroke={f} strokeWidth="2.4" strokeLinecap="round" fill="none" />
      <path d="M27 16.5c3.2-1.6 6.6-1.2 9.5 1.2" stroke={f} strokeWidth="2.4" strokeLinecap="round" fill="none" />
      <path d="M11.5 27c2.5-2.4 7.5-2.4 10 0-2.5 2.4-7.5 2.4-10 0z" fill={f} />
      <path d="M26.5 26c2.5-3.6 7.5-3.6 10 0-2.5 3.6-7.5 3.6-10 0z" fill={f} />
      <circle cx="16.5" cy="27" r="1.3" fill={b} />
      <circle cx="31.5" cy="26" r="1.8" fill={b} />
      <path d="M19 36c3-1.2 6.5-1.2 10 .6" stroke={f} strokeWidth="2.2" strokeLinecap="round" fill="none" />
    </>
  ),
};

/** Profile-picture key for a type's icon: "rt_whfe". */
export function typeIconKey(code: string): string {
  return `rt_${code.toLowerCase()}`;
}

/** The type code behind a type icon key, or null for any other icon. */
export function typeIconCode(icon: string | null | undefined): string | null {
  if (!icon || !icon.startsWith("rt_")) return null;
  const code = icon.slice(3).toUpperCase();
  return code in TYPE_ART ? code : null;
}

/** Draw a type icon on its own color, or null when `icon` isn't one. */
export function typeIconArt(icon: string | null | undefined): { art: ReactNode; bg: string } | null {
  const code = typeIconCode(icon);
  if (!code) return null;
  const { bg, fg } = TYPE_COLOR[code];
  return { art: TYPE_ART[code](fg, bg), bg };
}
