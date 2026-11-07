import { describe, expect, it } from "vitest";
import { progressLabel } from "./progress";

describe("progressLabel", () => {
  it("prefers chapters when tracking by chapter", () => {
    expect(progressLabel({ progress_unit: "chapter", progress_chapter: 7, chapter_total: 24, progress_pct: 29 })).toBe("Chapter 7 of 24");
  });
  it("works without a chapter count", () => {
    expect(progressLabel({ progress_unit: "chapter", progress_chapter: 7, progress_pct: null })).toBe("Chapter 7");
  });
  it("uses percent for page or percent tracking", () => {
    expect(progressLabel({ progress_unit: "percent", progress_chapter: 7, progress_pct: 60 })).toBe("60%");
  });
  it("reads a check-in's chapter", () => {
    expect(progressLabel({ chapter: 3, chapter_total: 10, progress_pct: 30 })).toBe("Chapter 3 of 10");
  });
  it("says nothing before any progress", () => {
    expect(progressLabel({ progress_unit: "chapter", progress_pct: null })).toBeNull();
  });
});
