import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BADGE, BADGES, isEarlyAdopter, progressLabel, sortForCase } from "./badges";

describe("badges", () => {
  it("has the same keys as the database", () => {
    const sql = readFileSync("supabase/migrations/20261105100000_listening.sql", "utf8");
    const keys = [...sql.matchAll(/\('([a-z_]+)',\s+[a-z_0-9:]+/g)].map((m) => m[1]);
    expect(BADGES).toHaveLength(44);
    expect(new Set(keys)).toEqual(new Set(BADGES.map((b) => b.key)));
  });

  it("labels progress", () => {
    expect(progressLabel(BADGE.bookworm, { progress: 12, goal: 50 })).toBe("12 of 50 books");
    expect(progressLabel(BADGE.time_traveler, { progress: 2, goal: 4 })).toBe("2 of 4 centuries");
    expect(progressLabel(BADGE.page_turner, { progress: 12000, goal: 10000 })).toBe("10,000 of 10,000 pages");
    expect(progressLabel(BADGE.old_soul, { progress: 0, goal: 1 })).toBeNull();
  });

  it("puts rarest earned first, then closest", () => {
    const sorted = sortForCase([
      { key: "century", progress: 90, goal: 100, earned: null, fresh: false },
      { key: "steady", progress: 1, goal: 4, earned: null, fresh: false },
      { key: "first_chapter", progress: 1, goal: 1, earned: "2026-03-01T00:00:00Z", fresh: false },
      { key: "early_adopter", progress: 1, goal: 1, earned: "2026-01-01T00:00:00Z", fresh: false },
    ]);
    expect(sorted.map((s) => s.key)).toEqual(["early_adopter", "first_chapter", "century", "steady"]);
  });

  it("orders profile badges by rarity, then newest", async () => {
    const { byRarity } = await import("./badges");
    const out = byRarity([
      { key: "steady", earned_at: "2026-11-01" },
      { key: "century", earned_at: "2026-05-01" },
      { key: "early_adopter", earned_at: "2026-01-01" },
      { key: "first_chapter", earned_at: "2026-11-02" },
      { key: "goal_getter", earned_at: "2026-10-01" },
    ]);
    expect(out.map((b) => b.key)).toEqual(["early_adopter", "goal_getter", "century", "first_chapter", "steady"]);
  });

  it("marks 2026 sign-ups as early adopters (Eastern time)", () => {
    expect(isEarlyAdopter("2026-12-31T23:30:00-05:00")).toBe(true);
    expect(isEarlyAdopter("2027-01-01T00:30:00-05:00")).toBe(false);
    expect(isEarlyAdopter(null)).toBe(false);
  });
});
