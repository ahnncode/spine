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
    expect(genresFromSubjects(HUNGER_GAMES, 2008)).toEqual(["scifi"]);
    expect(genresFromSubjects(PHM, 2021)).toEqual(["scifi"]);
  });
  it("still finds classics by age", () => {
    const g = genresFromSubjects(MIDDLEMARCH, 1871);
    expect(g).toContain("classics");
    expect(g).not.toContain("mystery");
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
