/**
 * The readread mark: two serif r's (read · read) on a rounded tile.
 * The r is Gloock's own glyph as a path, so it draws the same everywhere:
 * the app, share images (satori) and the icon files.
 *
 * Tones: tangerine (the main logo: brand accent, white + ink r's, echoing the
 * top two ranking tiers) and ink (for dark backgrounds: white + tangerine r's).
 */

/** Gloock "r" outline, font units (1000/em, y up). */
export const R_PATH =
  "M6 0V10H7Q43 10 65.0 32.0Q87 54 87 90V418Q87 456 71.5 477.0Q56 498 6 498V508H105Q158 508 185.0 518.5Q212 529 223 546H228L229 382Q242 412 262.5 445.0Q283 478 314.5 500.5Q346 523 390 523Q405 523 422.0 520.0Q439 517 458 509L419 392Q383 412 356.5 420.0Q330 428 310 428Q276 428 259.5 407.0Q243 386 231 357V90Q231 54 253.0 32.0Q275 10 311 10H312V0Z";

export type MarkTone = "tangerine" | "ink";

export const MARK_COLORS: Record<MarkTone, { tile: string; first: string; second: string }> = {
  tangerine: { tile: "#FF5A1F", first: "#FFFFFF", second: "#111111" },
  ink: { tile: "#111111", first: "#FFFFFF", second: "#FF5A1F" },
};

/** Where each r sits in a 100×100 box: x offsets and the shared baseline, at 0.066 scale. */
const R_X = [19, 50] as const;
const BASELINE = 68;
const SCALE = 0.066;

function rTransform(x: number) {
  return `translate(${x} ${BASELINE}) scale(${SCALE} -${SCALE})`;
}

/** The mark as an SVG string, for icon files. `bleed` drops the rounded corners (maskable icons). */
export function markSvg(tone: MarkTone = "tangerine", { bleed = false }: { bleed?: boolean } = {}): string {
  const c = MARK_COLORS[tone];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><title>readread</title><rect width="100" height="100"${bleed ? "" : ' rx="23"'} fill="${c.tile}"/><path transform="${rTransform(R_X[0])}" d="${R_PATH}" fill="${c.first}"/><path transform="${rTransform(R_X[1])}" d="${R_PATH}" fill="${c.second}"/></svg>`;
}

/** The mark as JSX: works in the app and in satori share images. */
export function MarkSvg({ size, tone = "tangerine", label }: { size: number; tone?: MarkTone; label?: string }) {
  const c = MARK_COLORS[tone];
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })} style={{ flexShrink: 0, display: "block" }}>
      <rect width="100" height="100" rx="23" fill={c.tile} />
      <path transform={rTransform(R_X[0])} d={R_PATH} fill={c.first} />
      <path transform={rTransform(R_X[1])} d={R_PATH} fill={c.second} />
    </svg>
  );
}
