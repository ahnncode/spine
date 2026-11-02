export type Bucket = "loved" | "fine" | "disliked";

export const BUCKET_ORDER: Bucket[] = ["loved", "fine", "disliked"];

export const BUCKETS: Record<
  Bucket,
  { label: string; range: [number, number]; rangeLabel: string; color: string }
> = {
  loved: { label: "Loved it", range: [6.7, 10], rangeLabel: "6.7 – 10", color: "var(--accent)" },
  fine: { label: "It was fine", range: [3.4, 6.6], rangeLabel: "3.4 – 6.6", color: "var(--amber)" },
  disliked: { label: "Not for me", range: [0, 3.3], rangeLabel: "0 – 3.3", color: "var(--faint)" },
};

/**
 * Scores for a bucket's books, best first. The best book gets the top of the
 * bucket's range and the rest spread evenly down it, so a score always says
 * both how you felt and where the book sits among its peers.
 */
export function bucketScores(count: number, bucket: Bucket): number[] {
  const [lo, hi] = BUCKETS[bucket].range;
  const step = count > 0 ? (hi - lo) / count : 0;
  return Array.from({ length: count }, (_, i) => round1(hi - i * step));
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function formatScore(n: number): string {
  return n.toFixed(1);
}

/** Visual tier for a score chip. */
export function scoreTier(score: number, bucket: Bucket): "top" | "ink" | "fine" | "low" {
  if (bucket === "disliked") return "low";
  if (bucket === "fine") return "fine";
  return score >= 9 ? "top" : "ink";
}

/* ----------------------------- Binary search ----------------------------- */

export interface SearchState {
  lo: number;
  hi: number;
  steps: number;
}

/** Start placing a new book into a list of `size` books (sorted best first). */
export function startSearch(size: number): SearchState {
  return { lo: 0, hi: size, steps: 0 };
}

export function isDone(s: SearchState): boolean {
  return s.lo >= s.hi;
}

/** Index of the book the new one is compared against next. */
export function midpoint(s: SearchState): number {
  return Math.floor((s.lo + s.hi) / 2);
}

/** Record one head-to-head. `newIsBetter` = the new book beat the compared one. */
export function answer(s: SearchState, newIsBetter: boolean): SearchState {
  const mid = midpoint(s);
  return newIsBetter
    ? { lo: s.lo, hi: mid, steps: s.steps + 1 }
    : { lo: mid + 1, hi: s.hi, steps: s.steps + 1 };
}

/** Most head-to-heads a placement can take for a list of `size` books. */
export function maxSteps(size: number): number {
  return size <= 0 ? 0 : Math.ceil(Math.log2(size + 1));
}

/* ------------------------------ Sort keys -------------------------------- */

/**
 * Sort key for inserting at `index` into `keys` (sorted descending, best
 * first). Returns null when the neighbours are too close to split, which means
 * the bucket should be renumbered first.
 */
export function keyForIndex(keys: number[], index: number): number | null {
  if (keys.length === 0) return 0;
  if (index <= 0) return keys[0] + 1;
  if (index >= keys.length) return keys[keys.length - 1] - 1;
  const above = keys[index - 1];
  const below = keys[index];
  if (above - below < 1e-6) return null;
  return (above + below) / 2;
}

/** Evenly spaced keys for `count` books, best first: count-1 … 0. */
export function renumber(count: number): number[] {
  return Array.from({ length: count }, (_, i) => count - 1 - i);
}
