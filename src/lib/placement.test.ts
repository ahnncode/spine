import { describe, expect, it } from "vitest";
import {
  answerPlacement, pickPivot, questionsLeft, skipPlacement, startPlacement, tiePlacement,
  type Candidate, type Placement,
} from "./placement";

const NOW = Date.UTC(2026, 10, 2);
const YEAR = 365 * 86_400_000;

function list(n: number, over: (i: number) => Partial<Candidate> = () => ({})): Candidate[] {
  return Array.from({ length: n }, (_, i) => ({ id: `b${i}`, rough: false, genres: [], readAt: NOW - YEAR, compared: 0, ...over(i) }));
}

/** Answer truthfully for a new book whose true slot is `truth`. */
function run(l: Candidate[], truth: number, genres: string[] = []): Placement {
  let p = startPlacement(l, genres, NOW);
  let guard = 0;
  while (p.phase !== "done" && guard++ < 50) p = answerPlacement(p, l, truth <= (p.pivot as number), genres, NOW);
  return p;
}

describe("placement", () => {
  it("always lands in the right slot, for every list size and position", () => {
    for (let n = 0; n <= 80; n++) {
      const l = list(n, (i) => ({ rough: i % 3 === 0, genres: i % 2 ? ["scifi"] : [], readAt: NOW - (i % 7) * YEAR }));
      for (let truth = 0; truth <= n; truth++) {
        expect(run(l, truth, ["scifi"]).result).toBe(truth);
      }
    }
  });

  it("stays close to a plain binary search in length", () => {
    const l = list(100, (i) => ({ genres: i % 4 ? [] : ["scifi"] }));
    for (let truth = 0; truth <= 100; truth += 7) expect(run(l, truth, ["scifi"]).steps).toBeLessThanOrEqual(9);
  });

  it("prefers a book you placed yourself over a rough import near the middle", () => {
    const l = list(30, (i) => ({ rough: i !== 17 }));
    expect(pickPivot(l, 0, 30, [], [], NOW)).toBe(17);
  });

  it("prefers the same genre and a recent read", () => {
    const l = list(30, (i) => ({ genres: i === 13 ? ["fantasy"] : ["history"], readAt: i === 13 ? NOW : NOW - 8 * YEAR }));
    expect(pickPivot(l, 0, 30, ["fantasy"], [], NOW)).toBe(13);
  });

  it("uses the exact middle when nothing stands out", () => {
    expect(pickPivot(list(9), 0, 9, [], [], NOW)).toBe(4);
  });

  it("swaps in another book when you skip, without using a step", () => {
    const l = list(20);
    const p = startPlacement(l, [], NOW);
    const s = skipPlacement(p, l, [], NOW);
    expect(s.pivot).not.toBe(p.pivot);
    expect(s.steps).toBe(0);
    expect(s.skipped).toContain(l[p.pivot!].id);
  });

  it("settles in the middle if you skip everything", () => {
    const l = list(3);
    let p = startPlacement(l, [], NOW);
    for (let i = 0; i < 5 && p.phase !== "done"; i++) p = skipPlacement(p, l, [], NOW);
    expect(p.phase).toBe("done");
    expect(p.result).toBe(1);
  });

  it("places a tie right below that book and stops", () => {
    const l = list(50);
    const p = startPlacement(l, [], NOW);
    const t = tiePlacement(p);
    expect(t.phase).toBe("done");
    expect(t.result).toBe((p.pivot as number) + 1);
  });

  it("handles skips and still lands right", () => {
    const l = list(16);
    for (let truth = 0; truth <= 16; truth++) {
      const first = startPlacement(l, [], NOW);
      const skippedAt = first.pivot as number;
      let p = skipPlacement(first, l, [], NOW);
      for (let i = 0; i < 20 && p.phase !== "done"; i++) p = answerPlacement(p, l, truth <= (p.pivot as number), [], NOW);
      // Next to the book you skipped, we can't know which side you'd put it on.
      if (truth === skippedAt || truth === skippedAt + 1) expect(Math.abs((p.result as number) - truth)).toBeLessThanOrEqual(1);
      else expect(p.result).toBe(truth);
    }
  });

  it("checks against the nearest book you placed when it lands beside rough imports", () => {
    // Imports 0-9 roughly sorted; book 3 is actually one you placed yourself.
    const l = list(10, (i) => ({ rough: i !== 3 }));
    // Pretend the imports are out of order: the new book truly beats book 3,
    // but the imported order would have put it lower. Answer: better than 3 and
    // everything above it, worse than the rough ones near the bottom.
    let p = startPlacement(l, [], NOW);
    for (let i = 0; i < 20 && p.phase !== "done"; i++) {
      const pivot = p.pivot as number;
      p = answerPlacement(p, l, pivot === 3 ? true : pivot >= 6, [], NOW);
    }
    expect(p.result).toBeLessThanOrEqual(3);
  });

  it("asks the extra check only when needed", () => {
    const l = list(20, (i) => ({ rough: i >= 8 && i <= 12 && i !== 10 }));
    let asked = 0;
    for (let truth = 0; truth <= 20; truth++) {
      let p = startPlacement(l, [], NOW);
      for (let i = 0; i < 20 && p.phase !== "done"; i++) {
        if (p.phase === "confirm") asked++;
        p = answerPlacement(p, l, truth <= (p.pivot as number), [], NOW);
      }
      expect(p.result).toBe(truth);
    }
    expect(asked).toBeLessThanOrEqual(8);
  });

  it("counts questions left for the progress dots", () => {
    expect(questionsLeft(startPlacement(list(7), [], NOW))).toBe(3);
    expect(questionsLeft(startPlacement(list(0), [], NOW))).toBe(0);
  });
});
