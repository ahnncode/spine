import { describe, expect, it } from "vitest";
import { dedupeKey, sameBookKey } from "./books";

const k = dedupeKey;
describe("sameBookKey", () => {
  it("matches a shortened word", () => {
    expect(sameBookKey(k("A Confed of Dunces", "John Kennedy Toole"), k("A Confederacy of Dunces", "John Kennedy Toole"))).toBe(true);
  });
  it("keeps different authors apart", () => {
    expect(sameBookKey(k("A Confed of Dunces", "Someone Else"), k("A Confederacy of Dunces", "John Kennedy Toole"))).toBe(false);
  });
  it("keeps different numbers apart", () => {
    expect(sameBookKey(k("Volume 1", "Balle"), k("Volume 10", "Balle"))).toBe(false);
  });
  it("needs the same number of words", () => {
    expect(sameBookKey(k("Dune", "Frank Herbert"), k("Dune Messiah", "Frank Herbert"))).toBe(false);
  });
  it("ignores very short fragments", () => {
    expect(sameBookKey(k("It", "Stephen King"), k("Itch", "Stephen King"))).toBe(false);
  });
});
