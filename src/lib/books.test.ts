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
  it("matches a volume number however it's written", () => {
    const one = k("On the Calculation of Volume 1", "Solvej Balle");
    expect(sameBookKey(one, k("On the Calculation of Volume I", "Solvej Balle"))).toBe(true);
    expect(sameBookKey(one, k("On the Calculation of Volume (Book I)", "Solvej Balle"))).toBe(true);
    expect(sameBookKey(k("The Fellowship Part 2", "Tolkien"), k("The Fellowship II", "Tolkien"))).toBe(true);
  });
  it("keeps different volumes apart", () => {
    expect(sameBookKey(k("On the Calculation of Volume I", "Solvej Balle"), k("On the Calculation of Volume II", "Solvej Balle"))).toBe(false);
    expect(sameBookKey(k("On the Calculation of Volume I", "Solvej Balle"), k("On the Calculation of Volume 3", "Solvej Balle"))).toBe(false);
  });
  it("leaves a one-word title alone", () => {
    expect(sameBookKey(k("I", "Someone"), k("1", "Someone"))).toBe(false);
  });
  it("needs the same number of words", () => {
    expect(sameBookKey(k("Dune", "Frank Herbert"), k("Dune Messiah", "Frank Herbert"))).toBe(false);
  });
  it("ignores very short fragments", () => {
    expect(sameBookKey(k("It", "Stephen King"), k("Itch", "Stephen King"))).toBe(false);
  });
});
