import { describe, expect, it } from "vitest";
import { DRIVES, TYPES } from "./readerTypeCopy";
import { toThey } from "./theyCopy";

describe("toThey", () => {
  it("swaps subject and object pronouns", () => {
    expect(toThey("Once you’ve started a book you see it through.")).toBe("Once they’ve started a book they see it through.");
    expect(toThey("If you say a book got to you, it really did.")).toBe("If they say a book got to them, it really did.");
    expect(toThey("The books that reach you and you hold them.")).toBe("The books that reach them and they hold them.");
    expect(toThey("Your top ten should feel like a fight.")).toBe("Their top ten should feel like a fight.");
    expect(toThey("A run-up you rarely give them.")).toBe("A run-up they rarely give them.");
  });
  it("leaves no you in any type or drive copy", () => {
    const all = [...Object.values(TYPES).flatMap((t) => [t.about, t.superpower, t.watchOut, t.tagline]), ...Object.values(DRIVES).flatMap((d) => [d.desire, d.shadow])];
    for (const s of all) expect(toThey(s)).not.toMatch(/\byou/i);
    for (const s of all) expect(toThey(s)).not.toMatch(/\bthem (see|could|rarely|hold|give|read|go)\b|\bthey (and|to|a|the)\b/);
  });
});
