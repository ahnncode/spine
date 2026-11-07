import type { ProgressUnit } from "./data";

/**
 * How far someone is, in the unit they track by: "Chapter 7 of 24",
 * "Chapter 7", or "60%". Null when there's nothing to say yet.
 */
export function progressLabel(p: {
  progress_unit?: ProgressUnit;
  progress_chapter?: number | null;
  chapter?: number | null;
  chapter_total?: number | null;
  progress_pct: number | null;
}): string | null {
  const ch = p.progress_chapter ?? p.chapter ?? null;
  if (ch != null && (p.progress_unit === undefined || p.progress_unit === "chapter")) {
    if (ch === 0) return "Not started";
    return p.chapter_total ? `Chapter ${ch} of ${p.chapter_total}` : `Chapter ${ch}`;
  }
  return p.progress_pct != null ? `${p.progress_pct}%` : null;
}
