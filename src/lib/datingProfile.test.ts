import { describe, expect, it } from "vitest";
import { buildDatingProfile, type DateBook } from "./datingProfile";

const book = (title: string, score: number, extra: Partial<DateBook> = {}): DateBook => ({
  title, score, genres: ["literary"], pages: 300, year: 2015, finished_on: "2026-10-01", ...extra,
});

const base = {
  name: "Paul Ahnn",
  ranked: [
    book("Middlemarch", 9.8, { pages: 880, year: 1871, genres: ["classics"] }),
    book("Piranesi", 9.3, { genres: ["fantasy"] }),
    book("Lonesome Dove", 9.1, { pages: 843, genres: ["historical"] }),
    book("Dune", 8.0, { genres: ["scifi"] }),
    book("Atomic Habits", 4.1, { genres: ["science"] }),
  ],
  wantCount: 14,
  reading: [{ title: "Discontent", started_on: "2026-07-03", progress_pct: 20 }],
  today: "2026-11-04",
};

describe("dating profile", () => {
  it("writes flags only from things that are true", () => {
    const p = buildDatingProfile(base);
    expect(p.green[0]).toBe("Will defend Middlemarch with their life.");
    expect(p.green.some((g) => g.includes("843 pages of Lonesome Dove"))).toBe(true);
    // The top pick isn't named twice.
    expect(p.green.filter((g) => g.includes("Middlemarch"))).toHaveLength(1);
    expect(p.red).toContain("14 books saved for “later”. Later never comes.");
    expect(p.red).toContain("Has been “reading” Discontent since July.");
    expect(p.red).toContain("Gave Atomic Habits a 4.1. Cold.");
    expect(p.green).toHaveLength(4);
    expect(p.red).toHaveLength(4);
  });

  it("fills gaps with harmless lines for a small, tidy shelf", () => {
    const p = buildDatingProfile({ ...base, ranked: base.ranked.slice(1, 4), wantCount: 0, reading: [] });
    expect(p.red).toHaveLength(4);
    expect(p.red).toContain("Says “one more chapter” and means four.");
    expect(p.readsLike).toBe(2015);
  });

  it("calls out a one-genre reader", () => {
    const ranked = Array.from({ length: 8 }, (_, i) => book(`Romance ${i}`, 8, { genres: ["romance"] }));
    const p = buildDatingProfile({ ...base, ranked, wantCount: 0, reading: [] });
    expect(p.red.some((r) => r.startsWith("100% romance"))).toBe(true);
    expect(p.idealDate).toBe("Enemies to lovers, but make it brunch.");
  });

  it("never uses a long dash", () => {
    const p = buildDatingProfile(base);
    expect([...p.green, ...p.red, p.idealDate, ...p.basics].join(" ")).not.toMatch(/—/);
  });
});
