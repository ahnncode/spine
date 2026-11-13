import { describe, expect, it, vi } from "vitest";

vi.mock("./supabase", () => ({ supabase: () => ({}) }));

import { quickSpot, rankEntries, type Entry } from "./data";
import { bucketForScore } from "./ranking";
import { tiedRanks } from "./sharpen";

function entry(bookId: string, bucket: Entry["bucket"], sortKey: number, manual: number | null = null): Entry {
  return {
    id: `e-${bookId}`, user_id: "me", book_id: bookId, status: "ranked", bucket, sort_key: sortKey,
    needs_sort: false, compare_count: 0, manual_score: manual,
  } as unknown as Entry;
}

describe("bucketForScore", () => {
  it("splits at the tier edges", () => {
    expect(bucketForScore(10)).toBe("loved");
    expect(bucketForScore(6.7)).toBe("loved");
    expect(bucketForScore(6.6)).toBe("fine");
    expect(bucketForScore(3.4)).toBe("fine");
    expect(bucketForScore(3.3)).toBe("disliked");
    expect(bucketForScore(1)).toBe("disliked");
  });
});

describe("quickSpot", () => {
  // Five loved books spread from 10 down to 6.7.
  const shelf = [5, 4, 3, 2, 1].map((k) => entry(`b${k}`, "loved", k));

  it("lands below every book scored higher", () => {
    const scores = rankEntries(shelf).map((e) => e.score);
    expect(scores[0]).toBeGreaterThan(scores[4]);
    const spot = quickSpot(shelf, "new", 8.5);
    expect(spot.bucket).toBe("loved");
    const above = spot.list.slice(0, spot.index).map((e) => e.score);
    const below = spot.list.slice(spot.index).map((e) => e.score);
    expect(above.every((s) => s >= 8.5)).toBe(true);
    expect(below.every((s) => s < 8.5)).toBe(true);
  });

  it("goes to the top for a 10 and the bottom for the tier's lowest score", () => {
    expect(quickSpot(shelf, "new", 10).index).toBe(0);
    expect(quickSpot(shelf, "new", 6.7).index).toBe(5);
  });

  it("uses the right tier and ignores the book's own old spot", () => {
    expect(quickSpot(shelf, "new", 5).bucket).toBe("fine");
    expect(quickSpot(shelf, "new", 5).index).toBe(0);
    expect(quickSpot(shelf, "b3", 9.9).list.some((e) => e.book_id === "b3")).toBe(false);
  });
});


describe("tiedRanks", () => {
  it("labels runs of the same hand-set score as tied, and nothing else", () => {
    const shelf = [
      entry("a", "loved", 9),
      entry("b", "loved", 8, 8),
      entry("c", "loved", 7, 8),
      entry("d", "loved", 6, 8),
      entry("e", "loved", 5, 7.5),
      entry("f", "loved", 4),
    ];
    const ranked = rankEntries(shelf);
    const labels = tiedRanks(ranked);
    expect(labels.get("e-b")).toBe("=2");
    expect(labels.get("e-c")).toBe("=2");
    expect(labels.get("e-d")).toBe("=2");
    expect(labels.has("e-a")).toBe(false);
    expect(labels.has("e-e")).toBe(false);
    expect(labels.has("e-f")).toBe(false);
  });
});
