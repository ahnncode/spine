import type { ReactNode } from "react";
import { displayName } from "@/components/Avatar";
import { BADGE, CATEGORY_COLOR, isEarlyAdopter, type Glyph, type Rarity } from "@/lib/badges";
import type { Profile } from "@/lib/data";

/* --------------------------------- Glyphs -------------------------------- */

const G: Record<Glyph, ReactNode> = {
  book: <path d="M3 6.5c3-1.5 6-1.5 9 0v12c-3-1.5-6-1.5-9 0zM12 6.5c3-1.5 6-1.5 9 0v12c-3-1.5-6-1.5-9 0z" />,
  box: <path d="M4 8l8-4 8 4v8l-8 4-8-4zM4 8l8 4 8-4M12 12v8" />,
  bookmark: <path d="M7 4h10v16l-5-4-5 4z" />,
  shelf: <path d="M5.5 5v13M9.5 5v13M13.5 6.5l3.5 11.5M3 20h18" />,
  seal: <path d="M12 3.5l2.5 5.3 5.8.7-4.3 4 1.1 5.8L12 16.5l-5.1 2.8 1.1-5.8-4.3-4 5.8-.7z" />,
  worm: <><path d="M3 16c1.5-4 3.5-4 5 0s3.5 4 5 0 3.5-4 5 0" /><circle cx="20.5" cy="13" r="1.3" /></>,
  hundred: <text x="12" y="15.5" textAnchor="middle" fontSize="10" fontWeight="800" fontFamily="var(--font-mono), monospace" stroke="none" fill="currentColor">100</text>,
  card: <path d="M3 6h18v12H3zM7 10h6M7 14h10" />,
  brick: <path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h11" />,
  pages: <path d="M8 3h10v14H8zM5 6v15h10M11 7h4M11 10h4" />,
  mountain: <path d="M3 19l6-10 4 6 3-4 5 8zM8 10.5l1-1.5 1.5 2" />,
  flame: <path d="M12 3c2 4 6 6 6 11a6 6 0 0 1-12 0c0-3 2-5 3-6 0 2 1 3 2 3 0-3 0-5 1-8z" />,
  leaf: <path d="M5 19C5 10 11 5 20 4c-1 9-6 15-15 15zM5 19l8-8" />,
  infinity: <path d="M7 9a3 3 0 1 0 0 6c3 0 7-6 10-6a3 3 0 1 1 0 6c-3 0-7-6-10-6z" />,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3 7 7M17 17l1.7 1.7M5.3 18.7 7 17M17 7l1.7-1.7" /></>,
  target: <><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="1" fill="currentColor" /></>,
  calendar: <path d="M4 6h16v14H4zM4 10h16M8 3v4M16 3v4M8 14h2M12 14h2M16 14h0M8 17h2" />,
  compass: <><circle cx="12" cy="12" r="8.5" /><path d="M15.5 8.5l-2 5-5 2 2-5z" /></>,
  globe: <><circle cx="12" cy="12" r="8.5" /><path d="M3.5 12h17M12 3.5c3 3 3 14 0 17M12 3.5c-3 3-3 14 0 17" /></>,
  hourglass: <path d="M6 3h12M6 21h12M7 3v2c0 4 10 4 10 7s-10 3-10 7v2M17 3v2c0 4-10 4-10 7s10 3 10 7v2" />,
  quill: <path d="M20 4C12 4 6 10 5 19M20 4c0 6-4 11-11 11M5 19l-1 2" />,
  press: <path d="M4 5h13v14H6a2 2 0 0 1-2-2zM17 9h3v8a2 2 0 0 1-2 2M7 9h7M7 12.5h7M7 16h4" />,
  voices: <path d="M3 5h11v7H8l-3 3v-3H3zM10 15h4l3 3v-3h4V8h-4" />,
  swords: <path d="M4 4l11 11M15 19l4-4M17 17l3 3M20 4L9 15M9 19l-4-4M7 17l-3 3" />,
  pen: <path d="M4 20l4-1 11-11-3-3L5 16zM14 6l3 3" />,
  bolt: <path d="M13 3L5 14h6l-1 7 8-11h-6z" />,
  twin: <><circle cx="9" cy="12" r="5.5" /><circle cx="15" cy="12" r="5.5" /></>,
  people: <path d="M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20c0-3 3-5 6-5s6 2 6 5M16 11a3 3 0 1 0 0-6M18 15c2 .5 3 2.5 3 5" />,
  chat: <path d="M4 5h16v11H9l-5 4zM8 9.5h8M8 12.5h5" />,
  club: <path d="M4 18V7.5c2.5-1 5-1 7.5.4V19c-2.5-1.4-5-1.4-7.5-1zM20 18V7.5c-2.5-1-5-1-7.5.4V19c2.5-1.4 5-1.4 7.5-1zM8 4.5a1.5 1.5 0 1 0 0-.01M16 4.5a1.5 1.5 0 1 0 0-.01" />,
  leap: <><path d="M4 6h16v14H4zM4 10h16M8 3v4M16 3v4" /><text x="12" y="17.8" textAnchor="middle" fontSize="6.5" fontWeight="800" fontFamily="var(--font-mono), monospace" stroke="none" fill="currentColor">29</text></>,
  pumpkin: <path d="M12 7.5c-4.4 0-7 2.7-7 6.3S7.6 20 12 20s7-2.6 7-6.2-2.6-6.3-7-6.3zM12 7.5c0-2 .8-3.2 2.4-3.8M9 8.3c-1.6 2.2-1.6 9 0 11.2M15 8.3c1.6 2.2 1.6 9 0 11.2" />,
  anchor: <path d="M12 3.5a1.8 1.8 0 1 1 0 3.6 1.8 1.8 0 0 1 0-3.6zM12 7.1V20M8.5 10.5h7M5 13.5c.3 3.8 3.2 6.5 7 6.5s6.7-2.7 7-6.5" />,
  abc: <text x="12" y="15.2" textAnchor="middle" fontSize="8" fontWeight="800" fontFamily="var(--font-mono), monospace" stroke="none" fill="currentColor">ABC</text>,
  coffee: <path d="M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5zM16 10.5h1.5a2.5 2.5 0 0 1 0 5H16M8.5 3.5c-.8 1 .8 2 0 3M12 3.5c-.8 1 .8 2 0 3" />,
  crystal: <><circle cx="12" cy="10.5" r="6" /><path d="M7.5 20h9M9.2 16l-1.2 4M14.8 16l1.2 4M9.5 8.3a3 3 0 0 1 2.5-1.6" /></>,
  glasses: <path d="M3 13.5a3.5 3.5 0 1 0 7 0 3.5 3.5 0 1 0-7 0M14 13.5a3.5 3.5 0 1 0 7 0 3.5 3.5 0 1 0-7 0M10 13c1.3-.8 2.7-.8 4 0M3.3 12 5.2 7M20.7 12 18.8 7" />,
  knock: <path d="M9.5 11V5a1.5 1.5 0 0 1 3 0v6M12.5 10.5V9a1.5 1.5 0 0 1 3 0v2M15.5 10.5a1.5 1.5 0 0 1 3 0V15a5 5 0 0 1-5 5h-1a5 5 0 0 1-4.4-2.7L5.5 13.6a1.5 1.5 0 0 1 2.6-1.4l1.4 1.8M4 5.5l2 1.3M3.5 9.5H6" />,
  spark: <><circle cx="12" cy="12" r="2.2" /><path d="M12 3v4.5M12 16.5V21M3 12h4.5M16.5 12H21M5.6 5.6l3.1 3.1M15.3 15.3l3.1 3.1M5.6 18.4l3.1-3.1M15.3 8.7l3.1-3.1" /></>,
  candle: <path d="M8 20h8M9 17h6l-.8 3H9.8zM10 10h4v7h-4zM12 4c1.3 1.6 1.6 2.7 0 4.3-1.6-1.6-1.3-2.7 0-4.3z" />,
  link: <path d="M10 14a4 4 0 0 0 5.6 0l3-3a4 4 0 0 0-5.6-5.6L11.5 7M14 10a4 4 0 0 0-5.6 0l-3 3a4 4 0 0 0 5.6 5.6l1.5-1.5" />,
};

/** A scalloped seal outline, centered in a 24 box. */
function sealPath(bumps: number, outer: number, inner: number): string {
  const pts: string[] = [];
  for (let i = 0; i < bumps * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (Math.PI * i) / bumps - Math.PI / 2;
    pts.push(`${(12 + r * Math.cos(a)).toFixed(2)} ${(12 + r * Math.sin(a)).toFixed(2)}`);
  }
  return `M${pts.join("L")}Z`;
}
const SEAL = sealPath(12, 11.2, 9.6);

/* -------------------------------- Medallion ------------------------------ */

/**
 * A badge medallion. Earned badges wear their category color; locked ones
 * are a quiet disc with a progress arc. Rarity shows in the rim: none,
 * a single ring, a double ring, or a scalloped seal for legendary.
 */
export function Medallion({
  badge, earned, progress = 0, size = 56,
}: {
  badge: string;
  earned: boolean;
  /** 0–1, drawn as an arc on locked badges. */
  progress?: number;
  size?: number;
}) {
  const def = BADGE[badge];
  if (!def) return null;
  const hidden = Boolean(def.secret) && !earned;
  if (hidden) progress = 0;
  const [face, ink] = CATEGORY_COLOR[def.category];
  const rarity: Rarity = def.rarity;
  const r = 26;
  const C = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className={`medal ${earned ? "medal--earned" : ""}`} data-rarity={rarity}>
      {rarity === "legendary" ? (
        <path d={SEAL} transform="translate(32 32) scale(2.6) translate(-12 -12)" fill={earned ? face : "var(--well)"}
          stroke={earned ? "var(--ink)" : "var(--line)"} strokeWidth={0.45} strokeLinejoin="round" />
      ) : (
        <circle cx="32" cy="32" r={rarity === "common" ? 27 : 29} fill={earned ? face : "var(--well)"} />
      )}
      {earned && rarity === "uncommon" && <circle cx="32" cy="32" r="24.5" fill="none" stroke={ink} strokeOpacity="0.55" strokeWidth="1.5" />}
      {earned && rarity === "rare" && (
        <>
          <circle cx="32" cy="32" r="25.5" fill="none" stroke={ink} strokeOpacity="0.6" strokeWidth="1.5" />
          <circle cx="32" cy="32" r="22.5" fill="none" stroke={ink} strokeOpacity="0.35" strokeWidth="1" />
        </>
      )}
      {earned && rarity === "legendary" && <circle cx="32" cy="32" r="21" fill="none" stroke={ink} strokeOpacity="0.5" strokeWidth="1.2" strokeDasharray="1.5 2.5" />}
      {!earned && progress > 0 && (
        <circle cx="32" cy="32" r={r} fill="none" stroke="var(--ink)" strokeWidth="3" strokeLinecap="round"
          strokeDasharray={`${Math.max(2, C * progress)} ${C}`} transform="rotate(-90 32 32)" />
      )}
      <g transform="translate(18 18) scale(1.1667)" fill="none" stroke={earned ? ink : "var(--muted)"} strokeOpacity={earned ? 1 : 0.6}
        strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" style={{ color: earned ? ink : "var(--muted)" }}>
        {hidden
          ? <text x="12" y="17" textAnchor="middle" fontSize="15" fontWeight="800" fontFamily="var(--font-display), sans-serif" stroke="none" fill="currentColor">?</text>
          : G[def.glyph]}
      </g>
    </svg>
  );
}

/* ------------------------------ Early adopter ---------------------------- */

/** The mark next to an early adopter's name, like a verified check. */
export function EarlyMark({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" role="img" aria-label="Early adopter" className="early-mark">
      <title>Early adopter · joined in readread&rsquo;s first year</title>
      <path d={SEAL} fill="var(--accent)" stroke="var(--accent)" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M12 6.8c.5 3 1.9 4.4 5 5-3.1.6-4.5 2-5 5-.5-3-1.9-4.4-5-5 3.1-.6 4.5-2 5-5z" fill="var(--ink)" />
    </svg>
  );
}

/** A reader's name, with the early adopter mark when they've earned it. */
export function Name({ profile, markSize = 15 }: { profile: Pick<Profile, "display_name" | "username" | "created_at"> | undefined | null; markSize?: number }) {
  return (
    <>
      {displayName(profile)}
      {isEarlyAdopter(profile?.created_at) && <EarlyMark size={markSize} />}
    </>
  );
}

/** The labelled pill version, for profile headers. */
export function EarlyPill() {
  return (
    <span className="early-pill">
      <EarlyMark size={14} />
      Early adopter
    </span>
  );
}
