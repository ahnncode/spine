import { describe, expect, it } from "vitest";
import { cleanDescription, sameTitle } from "./descriptions";

describe("cleanDescription", () => {
  it("drops Open Library footers and markdown links", () => {
    const raw = "Ryland Grace is the sole survivor on a desperate mission. See [the film](https://example.com).\r\n\r\n([source][1])\r\n\r\n----------\r\nContains:\r\n\r\n - [Book](/works/OL1W)\r\n\r\n  [1]: https://example.com";
    expect(cleanDescription(raw)).toBe("Ryland Grace is the sole survivor on a desperate mission. See the film.");
  });
  it("turns Apple's HTML into text", () => {
    expect(cleanDescription("<b>#1 bestseller</b><br />A story of love &amp; loss.<br /><br /><i>Brilliant.</i>"))
      .toBe("#1 bestseller\nA story of love & loss.\n\nBrilliant.");
  });
  it("trims very long text at a sentence", () => {
    const long = "This is a sentence. ".repeat(200);
    const out = cleanDescription(long);
    expect(out.length).toBeLessThanOrEqual(2500);
    expect(out.endsWith(".")).toBe(true);
  });
});

describe("sameTitle", () => {
  const want = { title: "On the Calculation of Volume (Book I)", author: "Solvej Balle" };
  it("matches series markers written differently", () => {
    expect(sameTitle(want, { trackName: "On the Calculation of Volume I", artistName: "Solvej Balle" })).toBe(true);
    expect(sameTitle({ title: "On the Calculation of Volume I", author: "Solvej Balle" }, { trackName: "On the Calculation of Volume 1", artistName: "Solvej Balle & Barbara J. Haveland" })).toBe(true);
  });
  it("keeps different volumes apart", () => {
    expect(sameTitle(want, { trackName: "On the Calculation of Volume II", artistName: "Solvej Balle" })).toBe(false);
  });
  it("needs the author", () => {
    expect(sameTitle(want, { trackName: "On the Calculation of Volume I", artistName: "Someone Else" })).toBe(false);
  });
});

import { toDate } from "./goodreads";
describe("toDate", () => {
  it("reads the date formats exports use", () => {
    expect(toDate("2026/3/14")).toBe("2026-03-14");
    expect(toDate("2026-03-14")).toBe("2026-03-14");
    expect(toDate("3/14/2026")).toBe("2026-03-14");
    expect(toDate("2026/03")).toBe("2026-03-01");
    expect(toDate("")).toBeNull();
  });
});
