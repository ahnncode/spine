import type { Entry, RankedEntry } from "./data";

/** Neighbouring books in the same bucket where at least one is still rough. */
export function nextPair(ranked: RankedEntry[], lastKey: string | null): [RankedEntry, RankedEntry] | null {
  const pairs: Array<[RankedEntry, RankedEntry]> = [];
  for (let i = 0; i < ranked.length - 1; i++) {
    const a = ranked[i];
    const b = ranked[i + 1];
    if (a.bucket !== b.bucket || !(a.needs_sort || b.needs_sort)) continue;
    if (`${a.id}:${b.id}` === lastKey) continue;
    pairs.push([a, b]);
  }
  if (!pairs.length) return null;
  const seen = ([a, b]: [RankedEntry, RankedEntry]) => (a.compare_count ?? 0) + (b.compare_count ?? 0);
  const least = Math.min(...pairs.map(seen));
  const fewest = pairs.filter((p) => seen(p) === least);
  // Favour the top of the shelf, where order matters most.
  return fewest[Math.floor(Math.random() * Math.min(fewest.length, 6))];
}


/** The shelf after a matchup, as recordMatchup saves it. */
export function applyMatchup(entries: Entry[], winner: RankedEntry, loser: RankedEntry): Entry[] {
  const swap = winner.sort_key < loser.sort_key;
  return entries.map((e) => {
    if (e.id === winner.id)
      return { ...e, sort_key: swap ? loser.sort_key : winner.sort_key, compare_count: (e.compare_count ?? 0) + 1, needs_sort: (e.compare_count ?? 0) + 1 < 2, manual_score: swap ? null : e.manual_score };
    if (e.id === loser.id)
      return { ...e, sort_key: swap ? winner.sort_key : loser.sort_key, compare_count: (e.compare_count ?? 0) + 1, needs_sort: (e.compare_count ?? 0) + 1 < 2, manual_score: swap ? null : e.manual_score };
    return e;
  });
}
