import type { ReactNode } from "react";

/**
 * Profile-picture icons, drawn on a 48×48 grid to sit inside a circle.
 * `f` is the icon color, `b` the background (used for cut-outs).
 */
type Art = (f: string, b: string) => ReactNode;

export const AVATAR_ART: Record<string, Art> = {
  book: (f, b) => (
    <>
      <path d="M10 16.5c4.6-1.8 9.2-1.6 13.2 1.2v17.6c-4-2.6-8.6-2.9-13.2-1.1z" fill={f} />
      <path d="M38 16.5c-4.6-1.8-9.2-1.6-13.2 1.2v17.6c4-2.6 8.6-2.9 13.2-1.1z" fill={f} />
      <path d="M13.5 21.5c2.6-.6 5-.4 7 .6M13.5 25.5c2.6-.6 5-.4 7 .6M27.5 22.1c2-1 4.4-1.2 7-.6M27.5 26.1c2-1 4.4-1.2 7-.6" stroke={b} strokeWidth="1.3" strokeLinecap="round" fill="none" />
    </>
  ),
  moon: (f) => (
    <>
      <path d="M29.5 11.5a13 13 0 1 0 7.6 20.6 11 11 0 0 1-7.6-20.6z" fill={f} />
      <path d="M33.5 13.5l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9z" fill={f} />
    </>
  ),
  sun: (f) => (
    <>
      <circle cx="24" cy="24" r="7.5" fill={f} />
      {Array.from({ length: 8 }, (_, i) => (
        <rect key={i} x="22.6" y="9" width="2.8" height="6" rx="1.4" fill={f} transform={`rotate(${i * 45} 24 24)`} />
      ))}
    </>
  ),
  leaf: (f, b) => (
    <>
      <path d="M13 35c0-13 8.5-21.5 23-23 0 14.5-8.5 23-23 23z" fill={f} />
      <path d="M14.5 33.5L30 18M21 27h5.5M24.8 23.2v-5" stroke={b} strokeWidth="1.6" strokeLinecap="round" fill="none" />
    </>
  ),
  peaks: (f, b) => (
    <>
      <path d="M21 35l9.5-14L41 35z" fill={f} opacity="0.55" />
      <path d="M7 35l11.5-19L30 35z" fill={f} />
      <path d="M18.5 16l-4 6.6 2.3-1.2 1.7 1.8 1.7-1.8 2.3 1.2z" fill={b} opacity="0.5" />
      <circle cx="34" cy="14.5" r="3" fill={f} />
    </>
  ),
  wave: (f) => (
    <>
      <path d="M8 27c3.5 0 4.5-4 8-4s4.5 4 8 4 4.5-4 8-4 4.5 4 8 4" stroke={f} strokeWidth="3.2" strokeLinecap="round" fill="none" />
      <path d="M8 34c3.5 0 4.5-4 8-4s4.5 4 8 4 4.5-4 8-4 4.5 4 8 4" stroke={f} strokeWidth="3.2" strokeLinecap="round" fill="none" opacity="0.55" />
      <path d="M12 18c2.5 0 3.2-3 5.8-3s3.3 3 5.8 3" stroke={f} strokeWidth="2.4" strokeLinecap="round" fill="none" opacity="0.8" />
    </>
  ),
  star: (f) => (
    <path d="M24 9.5l4.1 8.8 9.6 1.1-7.1 6.6 1.9 9.5L24 30.8l-8.5 4.7 1.9-9.5-7.1-6.6 9.6-1.1z" fill={f} stroke={f} strokeWidth="1.5" strokeLinejoin="round" />
  ),
  mug: (f, b) => (
    <>
      <path d="M12 21h19v9a7 7 0 0 1-7 7h-5a7 7 0 0 1-7-7z" fill={f} />
      <path d="M31 23.5h2.2a4 4 0 0 1 0 8H31" stroke={f} strokeWidth="2.6" fill="none" />
      <path d="M17.5 11.5c-1.5 1.6 1.5 3 0 5M22 10.5c-1.5 1.6 1.5 3 0 5M26.5 11.5c-1.5 1.6 1.5 3 0 5" stroke={f} strokeWidth="1.8" strokeLinecap="round" fill="none" />
      <path d="M16 26h11" stroke={b} strokeWidth="1.4" strokeLinecap="round" opacity="0.5" />
    </>
  ),
  cat: (f, b) => (
    <>
      <path d="M12 15l5.5 4.2a14 14 0 0 1 13 0L36 15l-.6 9.5A12 11 0 1 1 12.6 24.5z" fill={f} />
      <ellipse cx="19.5" cy="27" rx="1.7" ry="2.3" fill={b} />
      <ellipse cx="28.5" cy="27" rx="1.7" ry="2.3" fill={b} />
      <path d="M22.6 31.2h2.8l-1.4 1.4z" fill={b} />
      <path d="M8 30l7 .8M8.5 34l6.8-1.3M40 30l-7 .8M39.5 34l-6.8-1.3" stroke={f} strokeWidth="1.2" strokeLinecap="round" />
    </>
  ),
  specs: (f) => (
    <>
      <circle cx="16.5" cy="26" r="6.5" stroke={f} strokeWidth="3" fill="none" />
      <circle cx="31.5" cy="26" r="6.5" stroke={f} strokeWidth="3" fill="none" />
      <path d="M22 24.5c1.2-1.4 2.8-1.4 4 0M10.2 24l-3-4.5M37.8 24l3-4.5" stroke={f} strokeWidth="2.6" strokeLinecap="round" fill="none" />
    </>
  ),

  owl: (f, b) => (
    <>
      <path d="M13 14l5 4a13 13 0 0 1 12 0l5-4v15a11 11 0 0 1-22 0z" fill={f} />
      <circle cx="19" cy="25" r="4.6" fill={b} />
      <circle cx="29" cy="25" r="4.6" fill={b} />
      <circle cx="19" cy="25" r="2" fill={f} />
      <circle cx="29" cy="25" r="2" fill={f} />
      <path d="M22.5 30h3L24 32.5z" fill={b} />
      <path d="M18 36.5c2 .8 4 .8 6 0s4-.8 6 0" stroke={b} strokeWidth="1.3" strokeLinecap="round" fill="none" opacity="0.6" />
    </>
  ),
  fox: (f, b) => (
    <>
      <path d="M10 13l9 6h10l9-6-2.5 12L24 37 12.5 25z" fill={f} />
      <path d="M12.5 25L24 37l-6.2-11.3z M35.5 25L24 37l6.2-11.3z" fill={b} opacity="0.35" />
      <circle cx="19" cy="24" r="1.7" fill={b} />
      <circle cx="29" cy="24" r="1.7" fill={b} />
      <path d="M22.2 32.8h3.6L24 35z" fill={b} />
    </>
  ),
  flame: (f, b) => (
    <>
      <path d="M24 8.5c2 6 10.5 9.5 10.5 18.5a10.5 10.5 0 0 1-21 0c0-5 3-8 5-10 0 3.5 1.8 5.5 3.6 5.5C22 18 21 13.5 24 8.5z" fill={f} />
      <path d="M24 26c1.5 3 4.5 4 4.5 7.5a4.5 4.5 0 0 1-9 0c0-2.7 2-3.6 2.8-5.3.6 1.3 1.4 1.8 1.7.3z" fill={b} />
    </>
  ),
  quill: (f, b) => (
    <>
      <path d="M37 9C24 10 15.5 19 13.5 33.5L17 31c3.5-.5 7-2.5 9.5-5.5l-4-.5 6-1.6C33 19 36 14 37 9z" fill={f} />
      <path d="M33 14L14.5 33" stroke={b} strokeWidth="1.3" strokeLinecap="round" />
      <path d="M13.5 33.5l-2.5 5" stroke={f} strokeWidth="2.2" strokeLinecap="round" />
    </>
  ),
  lantern: (f, b) => (
    <>
      <path d="M20 11.5a4 4 0 0 1 8 0" stroke={f} strokeWidth="2.2" fill="none" />
      <rect x="17.5" y="13" width="13" height="3" rx="1.5" fill={f} />
      <path d="M18.5 16h11l1.5 3.5v11L29.5 34h-11L17 30.5v-11z" fill={f} />
      <path d="M24 21.5c1.3 2 2.6 2.8 2.6 4.6a2.6 2.6 0 0 1-5.2 0c0-1.8 1.3-2.6 2.6-4.6z" fill={b} />
      <rect x="17.5" y="34" width="13" height="3" rx="1.5" fill={f} />
    </>
  ),
  whale: (f, b) => (
    <>
      <path d="M8 27c0-6 6-9.5 13-9.5 8.5 0 12 5 13.5 8.5 1.2-2.6 3-4.5 6-5-.6 3-1.4 5-3 6.6 1.6 1.3 2.6 3 3 5.4-3.2-.5-5.2-1.8-6.4-3.4C31.8 33.5 27 36 20 36 12.5 36 8 32.5 8 27z" fill={f} />
      <circle cx="15.5" cy="25.5" r="1.6" fill={b} />
      <path d="M11 30.5c3 2 8 2.6 12 1.4" stroke={b} strokeWidth="1.3" strokeLinecap="round" fill="none" opacity="0.6" />
      <path d="M19 15c0-2.5-1.5-3.5-3-4M19 15c0-2.5 1.5-3.5 3-4" stroke={f} strokeWidth="1.8" strokeLinecap="round" fill="none" />
    </>
  ),
  comet: (f) => (
    <>
      <circle cx="30.5" cy="17.5" r="6" fill={f} />
      <path d="M26 22L10 38" stroke={f} strokeWidth="3.4" strokeLinecap="round" />
      <path d="M25.5 15.5L13 23M32.5 22L25 35" stroke={f} strokeWidth="2.2" strokeLinecap="round" opacity="0.55" />
      <path d="M38 33l.8 1.8 1.8.8-1.8.8-.8 1.8-.8-1.8-1.8-.8 1.8-.8z" fill={f} />
    </>
  ),
  telescope: (f) => (
    <>
      <path d="M10.5 22.5l20-8.5 3 7-20 8.5z" fill={f} />
      <path d="M33.5 13l3.7-1.6 3.2 7.4-3.7 1.6z" fill={f} />
      <path d="M22 26.5l-5 11M24 26l5 11.5" stroke={f} strokeWidth="2.6" strokeLinecap="round" />
      <path d="M13 13.5l.7 1.6 1.6.7-1.6.7-.7 1.6-.7-1.6-1.6-.7 1.6-.7z" fill={f} />
    </>
  ),
  lighthouse: (f, b) => (
    <>
      <path d="M20.5 18h7l2.5 19h-12z" fill={f} />
      <path d="M19.8 23.5h8.4M19.1 29.5h9.8" stroke={b} strokeWidth="2.2" />
      <rect x="20" y="13" width="8" height="5" rx="1" fill={f} />
      <path d="M21.5 10.5a2.5 2.5 0 0 1 5 0V13h-5z" fill={f} />
      <path d="M28 14.5L39 11v8zM20 14.5L9 11v8z" fill={f} opacity="0.4" />
      <path d="M12 37h24" stroke={f} strokeWidth="2.6" strokeLinecap="round" />
    </>
  ),
  crown: (f, b) => (
    <>
      <path d="M10 18l7 6 7-10 7 10 7-6-2.5 14h-23z" fill={f} stroke={f} strokeWidth="1.5" strokeLinejoin="round" />
      <rect x="12.5" y="33.5" width="23" height="3.5" rx="1.2" fill={f} />
      <circle cx="24" cy="27" r="2" fill={b} />
      <circle cx="10" cy="17" r="2" fill={f} />
      <circle cx="24" cy="12.5" r="2" fill={f} />
      <circle cx="38" cy="17" r="2" fill={f} />
    </>
  ),
};
