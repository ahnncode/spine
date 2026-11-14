import { STAMP_INKS } from "@/lib/world";

/** A passport-style ink stamp: a ring with the country's two-letter code. */
/** `index` picks the ink when stamps sit in a row, so neighbors never match. */
export function WorldStamp({ code, size = 52, year, index }: { code: string; size?: number; year?: number; index?: number }) {
  // Same country, same tilt and ink every time.
  const seed = code.charCodeAt(0) * 31 + code.charCodeAt(1);
  const tilt = ((seed % 15) - 7) * 1.1;
  const ink = STAMP_INKS[(index ?? seed) % STAMP_INKS.length];
  return (
    <span className="world-stamp" aria-hidden="true" style={{ width: size, height: size, color: ink, transform: `rotate(${tilt}deg)`, fontSize: size * 0.29 }}>
      <span>{code}</span>
      {year && <small style={{ fontSize: Math.max(9, size * 0.13) }}>{year}</small>}
    </span>
  );
}
