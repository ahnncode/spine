import { describe, expect, it } from "vitest";
import { dedupeKey, cleanTitle } from "./books";
import { bucketForStars, looksLikeGoodreads, parseGoodreads, startingOrder } from "./goodreads";
import { answer, bucketScores, isDone, keyForIndex, maxSteps, midpoint, startSearch } from "./ranking";

/** Place a book whose true position is `truth` into a list of `n`. */
function place(n: number, truth: number) {
  let s = startSearch(n);
  while (!isDone(s)) s = answer(s, truth <= midpoint(s));
  return s;
}

describe("binary placement", () => {
  it("finds every position in every list size within maxSteps", () => {
    for (let n = 0; n <= 200; n++) {
      for (let truth = 0; truth <= n; truth++) {
        const s = place(n, truth);
        expect(s.lo).toBe(truth);
        expect(s.steps).toBeLessThanOrEqual(maxSteps(n));
      }
    }
  });

  it("needs no comparisons for an empty bucket", () => {
    expect(isDone(startSearch(0))).toBe(true);
  });
});

describe("scores", () => {
  it("gives the best loved book a 10 and stays within the bucket", () => {
    const s = bucketScores(8, "loved");
    expect(s[0]).toBe(10);
    expect(Math.min(...s)).toBeGreaterThanOrEqual(6.7);
    expect([...s].sort((a, b) => b - a)).toEqual(s);
  });

  it("keeps buckets from overlapping", () => {
    expect(Math.min(...bucketScores(50, "loved"))).toBeGreaterThan(Math.max(...bucketScores(50, "fine")));
    expect(Math.min(...bucketScores(50, "fine"))).toBeGreaterThan(Math.max(...bucketScores(50, "disliked")));
  });
});

describe("sort keys", () => {
  const keys = [10, 8, 4];
  it("inserts above, between and below", () => {
    expect(keyForIndex(keys, 0)).toBe(11);
    expect(keyForIndex(keys, 1)).toBe(9);
    expect(keyForIndex(keys, 3)).toBe(3);
    expect(keyForIndex([], 0)).toBe(0);
  });
  it("asks for a renumber when neighbours are too close", () => {
    expect(keyForIndex([1, 1 - 1e-9], 1)).toBeNull();
  });
});

describe("books", () => {
  it("strips series markers", () => {
    expect(cleanTitle("Leviathan Wakes (The Expanse, #1)")).toBe("Leviathan Wakes");
    expect(cleanTitle("Piranesi")).toBe("Piranesi");
  });
  it("matches the same book across sources", () => {
    expect(dedupeKey("The Remains of the Day", "Kazuo Ishiguro")).toBe(dedupeKey("Remains of the Day", "Ishiguro, Kazuo".split(", ").reverse().join(" ")));
    expect(dedupeKey("Leviathan Wakes (The Expanse, #1)", "James S.A. Corey")).toBe(dedupeKey("Leviathan Wakes", "James S. A. Corey"));
    expect(dedupeKey("Sapiens: A Brief History of Humankind", "Yuval Noah Harari")).toBe(dedupeKey("Sapiens", "Yuval Noah Harari"));
  });
});

describe("goodreads import", () => {
  const rows = [
    { Title: "Middlemarch", Author: "George Eliot", "My Rating": "5", "Average Rating": "4.0", "Exclusive Shelf": "read", ISBN13: '="9780141439549"', "Date Read": "2019/03/04" },
    { Title: "Lonesome Dove (Lonesome Dove, #1)", Author: "Larry McMurtry", "My Rating": "5", "Average Rating": "4.5", "Exclusive Shelf": "read", ISBN13: '=""', "Date Read": "" },
    { Title: "Station Eleven", Author: "Emily St. John Mandel", "My Rating": "4", "Average Rating": "4.0", "Exclusive Shelf": "read" },
    { Title: "Some Okay Book", Author: "A Writer", "My Rating": "3", "Exclusive Shelf": "read" },
    { Title: "Unrated Read", Author: "B Writer", "My Rating": "0", "Exclusive Shelf": "read" },
    { Title: "Next Up", Author: "C Writer", "My Rating": "0", "Exclusive Shelf": "to-read" },
    { Title: "Middlemarch", Author: "George Eliot", "My Rating": "5", "Exclusive Shelf": "read" },
  ];

  it("recognises the export by its columns", () => {
    expect(looksLikeGoodreads(Object.keys(rows[0]))).toBe(true);
    expect(looksLikeGoodreads(["Name", "Rating"])).toBe(false);
  });

  it("sorts books into statuses and buckets, skipping duplicates", () => {
    const s = parseGoodreads(rows);
    expect(s.total).toBe(6);
    expect(s.rated).toBe(4);
    expect(s.unrated).toBe(1);
    expect(s.want).toBe(1);
    expect(s.loved).toBe(3);
    const mm = s.books.find((b) => b.book.title === "Middlemarch")!;
    expect(mm.book.isbn13).toBe("9780141439549");
    expect(mm.finishedOn).toBe("2019-03-04");
    expect(s.books.find((b) => b.book.title === "Lonesome Dove")).toBeTruthy();
  });

  it("orders by stars, then community average", () => {
    const order = startingOrder(parseGoodreads(rows).books);
    expect(order.loved.map((b) => b.book.title)).toEqual(["Lonesome Dove", "Middlemarch", "Station Eleven"]);
    expect(order.fine.map((b) => b.book.title)).toEqual(["Some Okay Book"]);
  });

  it("maps stars to buckets", () => {
    expect(bucketForStars(5)).toBe("loved");
    expect(bucketForStars(4)).toBe("loved");
    expect(bucketForStars(3)).toBe("fine");
    expect(bucketForStars(1)).toBe("disliked");
  });
});
