import { describe, expect, it } from "vitest";
import { AXES, buildReaderType, driveShares, MIN_BOOKS, type RTBook, type RTInput } from "./readerType";
import { FAMILIES, TYPE_COLOR, TYPES } from "./readerTypeCopy";

const TODAY = "2026-11-08";

function book(over: Partial<RTBook> = {}): RTBook {
  return {
    title: "A Book", author: "Someone", genres: ["literary"], pages: 320, year: 2015,
    score: 8, bucket: "loved", tags: [], listened: false, started_on: null, finished_on: null, ...over,
  };
}

function input(over: Partial<RTInput> = {}): RTInput {
  return { ranked: [], reading: [], wantCount: 0, abandoned: 0, today: TODAY, ...over };
}

/** A month-long read starting on day `i * 35` of 2025, so dated books never overlap. */
function oneAtATime(i: number): Pick<RTBook, "started_on" | "finished_on"> {
  const start = new Date(Date.UTC(2025, 0, 1 + i * 35));
  const end = new Date(start.getTime() + 28 * 86_400_000);
  return { started_on: start.toISOString().slice(0, 10), finished_on: end.toISOString().slice(0, 10) };
}

/** Every dated book overlaps three others. */
function piledUp(i: number): Pick<RTBook, "started_on" | "finished_on"> {
  const start = new Date(Date.UTC(2025, 0, 1 + i * 10));
  const end = new Date(start.getTime() + 40 * 86_400_000);
  return { started_on: start.toISOString().slice(0, 10), finished_on: end.toISOString().slice(0, 10) };
}

const romanceDevotee = input({
  ranked: Array.from({ length: 24 }, (_, i) =>
    book({
      title: `Romance ${i}`, author: i % 3 === 0 ? "Emily Henry" : `Author ${i}`, genres: ["romance"],
      score: 9.5 - i * 0.05, bucket: i < 21 ? "loved" : "fine",
      tags: i % 4 === 0 ? ["swoon", "loved_characters", "reread"] : [], ...oneAtATime(i),
    })),
  reading: [{ title: "Next Romance", started_on: "2026-11-01", last_checkin_on: "2026-11-07" }],
  wantCount: 4,
  abandoned: 0,
});

const GENRES_WIDE = ["scifi", "science", "history", "business", "mystery", "essays", "classics", "truecrime", "literary", "fantasy"];
const scoutish = input({
  ranked: Array.from({ length: 30 }, (_, i) =>
    book({
      title: `Book ${i}`, author: `Author ${i}`, genres: [GENRES_WIDE[i % GENRES_WIDE.length]],
      score: 8 - i * 0.25, bucket: i < 6 ? "loved" : i < 20 ? "fine" : "disliked",
      tags: i % 5 === 0 ? ["overhyped", "big_ideas"] : i % 7 === 0 ? ["learned_a_ton"] : [], ...piledUp(i),
    })),
  reading: [
    { title: "Stalled One", started_on: "2026-06-01", last_checkin_on: "2026-07-01" },
    { title: "Stalled Two", started_on: "2026-08-01", last_checkin_on: null },
    { title: "Fresh", started_on: "2026-11-01", last_checkin_on: "2026-11-06" },
    { title: "Fresher", started_on: "2026-11-05", last_checkin_on: null },
  ],
  wantCount: 45,
  abandoned: 6,
});

describe("buildReaderType", () => {
  it("needs a few ranked books first", () => {
    expect(buildReaderType(input({ ranked: Array.from({ length: MIN_BOOKS - 1 }, () => book()) }))).toBeNull();
    expect(buildReaderType(input({ ranked: Array.from({ length: MIN_BOOKS }, () => book()) }))).not.toBeNull();
  });

  it("reads a loyal, loving, one-at-a-time romance reader as a Devotee", () => {
    const t = buildReaderType(romanceDevotee)!;
    expect(t.code).toBe("DHFE");
    expect(t.copy.name).toBe("The Devotee");
    expect(t.family.key).toBe("keepers");
    expect(t.drive.key).toBe("escape");
    expect(t.axes.find((a) => a.key === "range")!.receipts[0]).toMatch(/100% of the shelf is romance/);
  });

  it("reads a wide, idea-led, juggling, hard-to-please reader as a Scout", () => {
    const t = buildReaderType(scoutish)!;
    expect(t.code).toBe("WMGC");
    expect(t.copy.name).toBe("The Scout");
    const rhythm = t.axes.find((a) => a.key === "rhythm")!;
    expect(rhythm.pole.name).toBe("Grazer");
    expect(rhythm.receipts.join(" ")).toMatch(/4 books on the go/);
    expect(t.axes.find((a) => a.key === "bar")!.receipts[0]).toMatch(/Only 20% of ranked books make ‘loved’/);
  });

  it("is deterministic", () => {
    expect(buildReaderType(scoutish)).toEqual(buildReaderType(scoutish));
  });

  it("keeps a small shelf near the middle instead of making strong claims", () => {
    const five = input({ ranked: Array.from({ length: 5 }, (_, i) => book({ title: `R${i}`, genres: ["romance"], tags: ["swoon"] })) });
    const t = buildReaderType(five)!;
    for (const a of t.axes) expect(Math.abs(a.pct - 50)).toBeLessThanOrEqual(30);
    expect(t.stability).toBe("provisional");
    expect(t.toNextStability).toBe(10);
  });

  it("calls a near-even axis balanced", () => {
    // Half heart-first books, half idea-first, scored the same.
    const even = input({
      ranked: Array.from({ length: 20 }, (_, i) => book({ title: `E${i}`, genres: [i % 2 ? "literary" : "science"] })),
    });
    const lens = buildReaderType(even)!.axes.find((a) => a.key === "lens")!;
    expect(lens.strength).toBe("balanced");
  });

  it("settles with enough books", () => {
    const many = input({ ranked: Array.from({ length: 40 }, (_, i) => book({ title: `M${i}` })) });
    const t = buildReaderType(many)!;
    expect(t.stability).toBe("settled");
    expect(t.toNextStability).toBe(0);
  });

  it("never prints broken receipts", () => {
    for (const t of [buildReaderType(romanceDevotee)!, buildReaderType(scoutish)!]) {
      const text = JSON.stringify(t);
      expect(text).not.toMatch(/undefined|NaN|null%|Infinity/);
      for (const a of t.axes) expect(a.receipts.length).toBeGreaterThan(0);
    }
  });

  it("works without abandonment or dates (fresh Goodreads import)", () => {
    const imported = input({
      abandoned: null,
      ranked: Array.from({ length: 12 }, (_, i) => book({ title: `I${i}`, genres: [i % 2 ? "fantasy" : "scifi"] })),
    });
    const t = buildReaderType(imported)!;
    const rhythm = t.axes.find((a) => a.key === "rhythm")!;
    expect(rhythm.confidence).toBeLessThan(0.3);
  });

  it("suggests a stretch genre the reader hasn't touched", () => {
    const t = buildReaderType(romanceDevotee)!;
    expect(t.stretch).not.toBeNull();
    expect(romanceDevotee.ranked.some((b) => b.genres.includes(t.stretch!.genre))).toBe(false);
  });

  it("picks the right article for wings", async () => {
    const { withArticle } = await import("./readerType");
    expect(withArticle("understanding")).toBe("an understanding");
    expect(withArticle("thrill")).toBe("a thrill");
  });

  it("counts books put aside toward grazing", () => {
    const base = input({ ranked: Array.from({ length: 12 }, (_, i) => book({ title: `P${i}` })), reading: [{ title: "Now", started_on: TODAY, last_checkin_on: TODAY }] });
    const steady = buildReaderType(base)!.axes.find((a) => a.key === "rhythm")!;
    const parked = buildReaderType({ ...base, paused: 3 })!.axes.find((a) => a.key === "rhythm")!;
    expect(parked.pct).toBeLessThan(steady.pct);
    expect(parked.receipts.join(" ")).not.toMatch(/Just one/);
    const juggler = buildReaderType({
      ...base,
      reading: ["A", "B", "C"].map((t) => ({ title: t, started_on: TODAY, last_checkin_on: TODAY })),
      paused: 2,
    })!.axes.find((a) => a.key === "rhythm")!;
    expect(juggler.pole.name).toBe("Grazer");
    expect(juggler.receipts.join(" ")).toMatch(/2 books put aside for now/);
  });

  it("pairs you with your opposite range and bar", () => {
    expect(buildReaderType(romanceDevotee)!.partner.code).toBe("WHFC");
  });
});

describe("copy", () => {
  it("has a type for every combination of letters", () => {
    const codes: string[] = [""];
    for (const a of AXES) {
      const next: string[] = [];
      for (const c of codes) for (const p of a.poles) next.push(c + p.letter);
      codes.splice(0, codes.length, ...next);
    }
    expect(codes).toHaveLength(16);
    for (const c of codes) expect(TYPES[c], c).toBeDefined();
    expect(new Set(Object.values(TYPES).map((t) => t.name)).size).toBe(16);
    expect(Object.keys(FAMILIES)).toHaveLength(4);
    for (const c of codes) expect(TYPE_COLOR[c], c).toBeDefined();
    expect(new Set(Object.values(TYPE_COLOR).map((c) => c.bg)).size).toBe(16);
  });
});

describe("driveShares", () => {
  it("weights loved books over disliked ones", () => {
    const shares = driveShares([
      book({ genres: ["mystery"], score: 9.5 }),
      book({ genres: ["mystery"], score: 9 }),
      book({ genres: ["romance"], score: 1, bucket: "disliked" }),
      book({ genres: ["romance"], score: 1.5, bucket: "disliked" }),
    ]);
    expect(shares[0][0]).toBe("thrill");
  });
});
