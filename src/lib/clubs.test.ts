import { describe, expect, it } from "vitest";
import { buildPlan, currentWeek, expectedChapter, planProblem, weekOpen, weekRange } from "./clubs";

describe("club plans", () => {
  it("splits chapters evenly over four weeks, ending on the finish date", () => {
    const plan = buildPlan(22, "2026-12-07", "2027-01-04");
    expect(plan.map((w) => w.through)).toEqual([6, 11, 17, 22]);
    expect(plan.map((w) => w.due)).toEqual(["2026-12-14", "2026-12-21", "2026-12-28", "2027-01-04"]);
  });
  it("never makes more weeks than chapters", () => {
    expect(buildPlan(2, "2026-12-01", "2026-12-29")).toHaveLength(2);
  });
  it("finds the current week and its chapters", () => {
    const plan = buildPlan(12, "2026-11-01", "2026-11-29");
    expect(currentWeek(plan, "2026-11-10")).toBe(2);
    expect(currentWeek(plan, "2026-12-30")).toBe(4);
    expect(weekRange(plan, 1)).toBe("Chapters 1–3");
    expect(weekRange(plan, 2)).toBe("Chapters 4–6");
    expect(weekRange(plan, 0)).toBe("The whole book");
  });
  it("opens a week once you reach its last chapter, or if you read it before", () => {
    const plan = buildPlan(12, "2026-11-01", "2026-11-29");
    expect(weekOpen(plan, 1, 2, false)).toBe(false);
    expect(weekOpen(plan, 1, 3, false)).toBe(true);
    expect(weekOpen(plan, 4, 0, true)).toBe(true);
    expect(weekOpen(plan, 0, 11, false)).toBe(false);
    expect(weekOpen(plan, 0, 999, false)).toBe(true);
  });
  it("says where the club should be today", () => {
    const plan = buildPlan(12, "2026-11-01", "2026-11-29");
    expect(expectedChapter(plan, "2026-11-01", "2026-10-30")).toBe(0);
    expect(expectedChapter(plan, "2026-11-01", "2026-11-08")).toBe(3);
    expect(expectedChapter(plan, "2026-11-01", "2026-11-29")).toBe(12);
    expect(expectedChapter(plan, "2026-11-01", "2026-12-15")).toBe(12);
  });
});

describe("planProblem", () => {
  const wk = (through: number) => ({ through, due: "2026-12-01" });
  it("accepts a rising plan that ends on the last chapter", () => {
    expect(planProblem([wk(5), wk(10), wk(22)], 22)).toBeNull();
  });
  it("catches weeks that go backwards", () => {
    expect(planProblem([wk(8), wk(6), wk(22)], 22)).toMatch(/Week 2/);
  });
  it("catches a last week that stops short", () => {
    expect(planProblem([wk(5), wk(20)], 22)).toMatch(/chapter 22/);
  });
});
