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

/** Which tier a score out of 10 falls in. */
export function bucketForScore(score: number): Bucket {
  if (score >= BUCKETS.loved.range[0]) return "loved";
  if (score >= BUCKETS.fine.range[0]) return "fine";
  return "disliked";
}

/**
 * Scores for a bucket's books, best first.
 *
 * Books spread evenly between the top and bottom of the tier's range, as if
 * the range's ends were two invisible books: one loved book scores 8.4 (the
 * middle), and the top creeps toward 10 as the tier fills. So early scores
 * stay calm and a near-10 has to be earned.
 *
 * Scores you set yourself (`manual`, for your first few books) are anchors:
 * they stay put and other books fill in between them.
 *
 * Mirrored in SQL by the `ranked_entries` view — keep the two in step.
 */
export function bucketScores(manual: number | Array<number | null>, bucket: Bucket): number[] {
  const [lo, hi] = BUCKETS[bucket].range;
  const fixed = typeof manual === "number" ? Array<number | null>(manual).fill(null) : manual;
  const n = fixed.length;
  // Anchor points as (position, score), positions 1..n, with the range ends at 0 and n + 1.
  const anchors: Array<[number, number]> = [[0, hi]];
  fixed.forEach((s, i) => {
    if (s != null) anchors.push([i + 1, Math.min(hi, Math.max(lo, s))]);
  });
  anchors.push([n + 1, lo]);
  return fixed.map((s, i) => {
    const pos = i + 1;
    if (s != null) return round1(Math.min(hi, Math.max(lo, s)));
    let a = anchors[0];
    let b = anchors[anchors.length - 1];
    for (const pt of anchors) {
      if (pt[0] < pos) a = pt;
      else if (pt[0] > pos) {
        b = pt;
        break;
      }
    }
    return round1(a[1] + ((b[1] - a[1]) * (pos - a[0])) / (b[0] - a[0]));
  });
}

/** Round to one decimal, halves away from zero (matching Postgres numeric rounding). */
export function round1(n: number): number {
  return Math.round(n * 10 + (n >= 0 ? 1e-9 : -1e-9)) / 10;
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
