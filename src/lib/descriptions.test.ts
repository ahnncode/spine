import { describe, expect, it } from "vitest";
import { cleanDescription } from "./descriptions";

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
