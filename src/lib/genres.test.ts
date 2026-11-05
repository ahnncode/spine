import { describe, expect, it } from "vitest";
import { genresFromSubjects } from "./genres";

// Real Open Library subject lists (trimmed).
const LIGHTNING_THIEF = ["Serie:Percy_Jackson_and_the_Olympians", "Fiction", "Greek Mythology", "Juvenile fiction", "Camps", "Friendship", "Fantasy fiction", "Fantasy", "Young Adult Fiction", "New York Times bestseller", "nyt:series_books=2007-07-21", "Mythology, Greek", "Identity", "Adaptations", "Greek Gods", "Cartoons and comics", "Children's fiction", "Camps, fiction", "Gods, fiction", "Action & Adventure", "Fantasy & Magic", "Legends, Myths, Fables", "Gods and goddesses", "Literature and fiction, juvenile", "Child and youth fiction", "Science fiction, fantasy, horror", "New York Times reviewed"];
const TOMORROW = ["American literature", "nyt:combined-print-and-e-book-fiction=2022-07-24", "New York Times bestseller", "Modern fiction", "Fiction"];
const HUNGER_GAMES = ["severe poverty", "starvation", "oppression", "effects of war", "self-sacrifice", "Science fiction", "Apocalyptic fiction", "Dystopian fiction", "Fiction", "Juvenile works", "Novels", "Young adult works"];
const PHM = ["hard science-fiction", "science-fiction", "sci-fi", "hard sci-fi", "nyt:hardcover-fiction=2021-05-23", "New York Times bestseller", "Fiction, science fiction, action & adventure", "Fiction", "Astronauts", "Space flight", "Survival", "FICTION / Science Fiction / Action & Adventure", "FICTION / Thrillers / Suspense"];
const MIDDLEMARCH = ["Young women", "Married people", "City and town life", "Fiction", "Social life and customs", "Married women", "England", "Readers", "English literature", "Triangles (Interpersonal relations)", "English language", "Coming of age", "Domestic fiction", "Fiction, family life", "Literature and fiction, mystery and suspense"];

describe("genresFromSubjects", () => {
  it("doesn't call Percy Jackson horror", () => {
    const g = genresFromSubjects(LIGHTNING_THIEF, 2005);
    expect(g[0]).toBe("fantasy");
    expect(g).not.toContain("horror");
    expect(g).not.toContain("scifi");
  });
  it("treats a modern 'American literature' novel as literary, not classic", () => {
    expect(genresFromSubjects(TOMORROW, 2022)).toEqual(["literary"]);
  });
  it("keeps science fiction out of Science", () => {
    expect(genresFromSubjects(HUNGER_GAMES, 2008)).toEqual(["scifi", "ya"]);
    expect(genresFromSubjects(PHM, 2021)).toEqual(["scifi"]);
  });
  it("still finds classics by age", () => {
    const g = genresFromSubjects(MIDDLEMARCH, 1871);
    expect(g).toContain("classics");
    expect(g).not.toContain("mystery");
  });
  it("finds the newer genres", () => {
    expect(genresFromSubjects(["Management", "Leadership", "Communication in management", "Interpersonal communication"], 2017)).toEqual(["business"]);
    expect(genresFromSubjects(["Murder", "Kansas", "True crime", "Criminals", "Case studies"], 1966)).toEqual(["truecrime"]);
    expect(genresFromSubjects(["Detective and mystery stories", "Murder", "Fiction"], 2020)).toEqual(["mystery"]);
    expect(genresFromSubjects(["Holocaust, Jewish (1939-1945)", "Comic books, strips", "Graphic novels", "Biography"], 1986)).toContain("graphic");
    expect(genresFromSubjects(["Description and travel", "Mountaineering", "Essays"], 2003)).toEqual(["essays"]);
    expect(genresFromSubjects(["Time travel", "Science fiction"], 2010)).toEqual(["scifi"]);
  });
  it("leaves bare children's books and empty lists alone", () => {
    expect(genresFromSubjects(["Fiction", "Juvenile fiction", "Cats"], 2004)).toEqual([]);
    expect(genresFromSubjects([], 2023)).toEqual([]);
  });
});

describe("cleanTitle", async () => {
  const { cleanTitle } = await import("./books");
  it("drops series markers but keeps titles that are volumes", () => {
    expect(cleanTitle("Harry Potter and the Prisoner of Azkaban (Harry Potter, Book 3)")).toBe("Harry Potter and the Prisoner of Azkaban");
    expect(cleanTitle("Harry Potter and the Deathly Hallows (Harry Potter #7)")).toBe("Harry Potter and the Deathly Hallows");
    expect(cleanTitle("On the Calculation of Volume (Book II)")).toBe("On the Calculation of Volume (Book II)");
    expect(cleanTitle("On the Calculation of Volume III")).toBe("On the Calculation of Volume III");
  });
});

describe("Apple cover matching", async () => {
  const { sameBook, bigArtwork } = await import("./applecovers");
  it("matches the same book and not lookalikes", () => {
    expect(sameBook({ title: "Big Swiss", author: "Jen Beagin" }, { trackName: "Big Swiss", artistName: "Jen Beagin" })).toBe(true);
    expect(sameBook({ title: "On the Calculation of Volume (Book II)", author: "Solvej Balle" }, { trackName: "On the Calculation of Volume (Book II)", artistName: "Solvej Balle & Barbara J. Haveland" })).toBe(true);
    expect(sameBook({ title: "Frankenstein", author: "Mary Shelley" }, { trackName: "Frankenstein: Or, the Modern Prometheus", artistName: "Mary Shelley" })).toBe(true);
    expect(sameBook({ title: "Frankenstein", author: "Mary Shelley" }, { trackName: "Frankenstein", artistName: "Dean Koontz" })).toBe(false);
    expect(sameBook({ title: "On the Calculation of Volume (Book II)", author: "Solvej Balle" }, { trackName: "On the Calculation of Volume (Book V)", artistName: "Solvej Balle" })).toBe(false);
    expect(sameBook({ title: "Kitten", author: "Jane Doe" }, { trackName: "Kittens Galore", artistName: "Jane Doe" })).toBe(false);
  });
  it("asks for a bigger image", () => {
    expect(bigArtwork("https://is1-ssl.mzstatic.com/image/thumb/P/v4/a/b.jpg/100x100bb.jpg")).toBe("https://is1-ssl.mzstatic.com/image/thumb/P/v4/a/b.jpg/400x600bb.jpg");
  });
});

describe("search ranking", async () => {
  const { rankScore } = await import("./openlibrary");
  const doc = (title: string, author: string, readers: number, editions = 10) => ({ key: title, title, author_name: [author], readinglog_count: readers, edition_count: editions });
  it("puts the well-known book first, but not unrelated popular ones", () => {
    const docs = [doc("Circe", "Miguel Ramos Carrión", 13, 2), doc("Circe", "Madeline Miller", 1125, 40), doc("Macbeth", "William Shakespeare", 9000, 900)];
    const order = docs.map((d, i) => ({ d, s: rankScore(d, "circe", i) })).sort((a, b) => b.s - a.s).map((x) => x.d.author_name[0]);
    expect(order).toEqual(["Madeline Miller", "Miguel Ramos Carrión", "William Shakespeare"]);
  });
});
