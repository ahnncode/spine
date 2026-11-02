import { describe, expect, it } from "vitest";
import { genresFromSubjects } from "./genres";
import { milestones, weekIndex, weeklyStreak } from "./stats";

const d = (s: string) => new Date(`${s}T12:00:00`);

describe("weekly streak", () => {
  it("counts consecutive weeks ending this week", () => {
    const now = d("2026-11-04"); // Wednesday
    const s = weeklyStreak([d("2026-11-02"), d("2026-10-28"), d("2026-10-20"), d("2026-10-01")], now);
    expect(s.weeks).toBe(3);
    expect(s.activeThisWeek).toBe(true);
  });
  it("keeps last week's streak alive until the week ends", () => {
    const s = weeklyStreak([d("2026-10-28"), d("2026-10-21")], d("2026-11-04"));
    expect(s.weeks).toBe(2);
    expect(s.activeThisWeek).toBe(false);
  });
  it("puts Sunday and the following Monday in different weeks", () => {
    expect(weekIndex(d("2026-11-08"))).toBe(weekIndex(d("2026-11-02")));
    expect(weekIndex(d("2026-11-09"))).toBe(weekIndex(d("2026-11-02")) + 1);
  });
});

describe("genres", () => {
  it("maps Open Library subjects to passport stamps", () => {
    expect(genresFromSubjects(["Science fiction", "Space colonies", "Fiction"])).toContain("scifi");
    expect(genresFromSubjects(["Fantasy fiction", "Magic", "Labyrinths"])[0]).toBe("fantasy");
    expect(genresFromSubjects([])).toEqual([]);
  });
});

describe("milestones", () => {
  it("shows earned rungs plus the next one", () => {
    const m = milestones({ ranked: 12, stamps: 0, streak: 0 }).filter((x) => x.id.startsWith("ranked"));
    expect(m.map((x) => x.label)).toEqual(["First rank", "10 ranked", "25 ranked"]);
    expect(m[2].earned).toBe(false);
  });
});

describe("check-ins keep streaks alive", () => {
  it("counts a week with only a check-in", async () => {
    const { activityDates } = await import("./stats");
    const dates = activityDates([], ["2026-11-03", "2026-10-27", "2026-10-21"]);
    expect(weeklyStreak(dates, d("2026-11-04")).weeks).toBe(3);
  });
});
