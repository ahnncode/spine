/**
 * Placing a new book among the ones already in its tier.
 *
 * It's a binary search, but the book you're asked about isn't always the
 * exact middle one: any book near the middle splits the list almost as well,
 * so we pick the one you're most likely to have a real opinion about.
 * You can skip a book you don't remember, call a real tie, and when the new
 * book lands beside roughly-sorted imports we ask one final check against the
 * nearest book you placed yourself.
 */

/** What we know about each book already in the tier (best first). */
export interface Candidate {
  id: string;
  /** Imported and only roughly sorted. */
  rough: boolean;
  genres: string[];
  /** When you read or ranked it (ms since epoch), 0 if unknown. */
  readAt: number;
  /** How many head-to-heads it has been in. */
  compared: number;
}

export interface Placement {
  lo: number;
  hi: number;
  /** Index of the book being shown, or null when finished. */
  pivot: number | null;
  steps: number;
  skipped: string[];
  /** Indexes compared so far. */
  seen: number[];
  phase: "search" | "confirm" | "done";
  /** Final slot (index to insert at) once done. */
  result: number | null;
}

const DAY = 86_400_000;

/** How good an opponent this book is, apart from where it sits. */
function appeal(c: Candidate, genres: string[], now: number): number {
  let score = 0;
  if (!c.rough) score += 3; // you placed it yourself, so you know where it stands
  if (genres.length && c.genres.some((g) => genres.includes(g))) score += 2; // apples to apples
  if (c.readAt) {
    const years = (now - c.readAt) / (365 * DAY);
    score += Math.max(0, 2 - years); // fresher memory, up to +2
  }
  if (c.compared > 0) score += 0.5;
  return score;
}

/**
 * Best opponent near the middle of [lo, hi). The window grows with the range,
 * so big lists get more choice while the search stays nearly as short.
 */
export function pickPivot(list: Candidate[], lo: number, hi: number, genres: string[], skipped: string[], now = Date.now()): number | null {
  if (lo >= hi) return null;
  const mid = Math.floor((lo + hi) / 2);
  const span = hi - lo;
  for (let radius = Math.floor(span / 6); radius <= span; radius = radius ? radius * 2 : 1) {
    let best: number | null = null;
    let bestScore = -Infinity;
    for (let i = Math.max(lo, mid - radius); i <= Math.min(hi - 1, mid + radius); i++) {
      if (skipped.includes(list[i].id)) continue;
      // Straying from the middle costs a little, so it only happens for a clearly better pick.
      const s = appeal(list[i], genres, now) - Math.abs(i - mid) * (6 / Math.max(span, 1));
      if (s > bestScore) {
        bestScore = s;
        best = i;
      }
    }
    if (best !== null) return best;
    if (radius >= span) break;
  }
  return null;
}

export function startPlacement(list: Candidate[], genres: string[], now = Date.now()): Placement {
  const base: Placement = { lo: 0, hi: list.length, pivot: null, steps: 0, skipped: [], seen: [], phase: "search", result: null };
  return advance(base, list, genres, now);
}

/** Pick the next opponent, or finish (possibly via one confirmation). */
function advance(p: Placement, list: Candidate[], genres: string[], now: number): Placement {
  if (p.lo < p.hi) {
    const pivot = pickPivot(list, p.lo, p.hi, genres, p.skipped, now);
    if (pivot !== null) return { ...p, pivot };
    // Everything left was skipped: settle in the middle of what remains.
    return finish({ ...p, lo: Math.floor((p.lo + p.hi) / 2), hi: Math.floor((p.lo + p.hi) / 2) }, list);
  }
  return finish(p, list);
}

/**
 * Search narrowed to one slot. If a book right beside it is a rough import
 * (so its own spot is a guess), check once against the nearest book on that
 * side that you placed yourself — unless we already compared it.
 */
function finish(p: Placement, list: Candidate[]): Placement {
  const slot = p.lo;
  const usable = (i: number) => !list[i].rough && !p.skipped.includes(list[i].id);
  const sides: number[] = [];
  if (slot - 1 >= 0 && list[slot - 1].rough) {
    for (let i = slot - 1; i >= 0; i--) if (usable(i)) { sides.push(i); break; }
  }
  if (slot < list.length && list[slot].rough) {
    for (let i = slot; i < list.length; i++) if (usable(i)) { sides.push(i); break; }
  }
  const check = sides.find((i) => !p.seen.includes(i));
  if (check !== undefined) return { ...p, phase: "confirm", pivot: check, result: slot };
  return { ...p, phase: "done", pivot: null, result: slot };
}

/** Record a head-to-head against the book currently shown. */
export function answerPlacement(p: Placement, list: Candidate[], newIsBetter: boolean, genres: string[], now = Date.now()): Placement {
  if (p.pivot === null || p.phase === "done") return p;
  const i = p.pivot;

  if (p.phase === "confirm") {
    const slot = p.result as number;
    // Beating a book you placed above us means we belong just above it;
    // losing to one you placed below means just below it. Otherwise the slot stands.
    const final = i < slot ? (newIsBetter ? i : slot) : newIsBetter ? slot : i + 1;
    return { ...p, steps: p.steps + 1, seen: [...p.seen, i], phase: "done", pivot: null, result: final };
  }

  const next: Placement = {
    ...p,
    steps: p.steps + 1,
    seen: [...p.seen, i],
    lo: newIsBetter ? p.lo : i + 1,
    hi: newIsBetter ? i : p.hi,
    pivot: null,
  };
  return advance(next, list, genres, now);
}

/** "Too close to call": sit right beside that book and stop asking. */
export function tiePlacement(p: Placement): Placement {
  if (p.pivot === null) return p;
  return { ...p, steps: p.steps + 1, phase: "done", pivot: null, result: p.pivot + 1 };
}

/** "Don't remember this one": swap in another book without using up a step. */
export function skipPlacement(p: Placement, list: Candidate[], genres: string[], now = Date.now()): Placement {
  if (p.pivot === null) return p;
  const skipped = [...p.skipped, list[p.pivot].id];
  if (p.phase === "confirm") return { ...p, skipped, phase: "done", pivot: null };
  return advance({ ...p, skipped, pivot: null }, list, genres, now);
}

/** Rough upper bound on questions left, for the progress dots. */
export function questionsLeft(p: Placement): number {
  if (p.phase === "done") return 0;
  if (p.phase === "confirm") return 1;
  const span = p.hi - p.lo;
  return span <= 0 ? 0 : Math.ceil(Math.log2(span + 1));
}
