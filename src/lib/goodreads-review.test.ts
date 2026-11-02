import { describe, expect, it } from "vitest";
import { parseGoodreads } from "./goodreads";

describe("Goodreads reviews", () => {
  it("imports your written review as plain text", () => {
    const s = parseGoodreads([
      { Title: "Piranesi", Author: "Susanna Clarke", "My Rating": "5", "Exclusive Shelf": "read", "My Review": "Loved it.<br/><br/>The House is <b>beautiful</b> &amp; strange." },
      { Title: "Dune", Author: "Frank Herbert", "My Rating": "4", "Exclusive Shelf": "read", "My Review": "" },
    ]);
    expect(s.books[0].review).toBe("Loved it.\n\nThe House is beautiful & strange.");
    expect(s.books[1].review).toBeNull();
  });
});
