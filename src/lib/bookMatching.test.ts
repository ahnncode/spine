import { describe, expect, it } from "vitest";
import { authorKey, cleanTitle, dedupeKey, sameBookKey } from "./books";

/** Tricky pairs from real catalogues (REA-103). [title A, author A, title B, author B, note] */
type Pair = [string, string, string, string, string];

const SAME: Pair[] = [
  ["Sapiens", "Yuval Noah Harari", "Sapiens: A Brief History of Humankind", "Yuval Noah Harari", "descriptive subtitle"],
  ["The Hunger Games (The Hunger Games, #1)", "Suzanne Collins", "The Hunger Games", "Suzanne Collins", "Goodreads series tag"],
  ["Pachinko (National Book Award Finalist)", "Min Jin Lee", "Pachinko", "Min Jin Lee", "award label"],
  ["Dune (Deluxe Edition)", "Frank Herbert", "Dune", "Frank Herbert", "edition label"],
  ["1984 (Signet Classics)", "George Orwell", "1984", "George Orwell", "imprint label"],
  ["1984: 75th Anniversary Edition", "George Orwell", "1984", "George Orwell", "edition subtitle"],
  ["Frankenstein; or, The Modern Prometheus", "Mary Shelley", "Frankenstein", "Mary Shelley", "'or' subtitle"],
  ["Pride & Prejudice", "Jane Austen", "Pride and Prejudice", "Jane Austen", "ampersand"],
  ["Les Misérables", "Victor Hugo", "Les Miserables", "Victor Hugo", "accents"],
  ["Ender’s Game", "Orson Scott Card", "Ender's Game", "Orson Scott Card", "curly apostrophe"],
  ["Where'd You Go, Bernadette", "Maria Semple", "Where'd You Go Bernadette", "Maria Semple", "comma in title"],
  ["One Hundred Years of Solitude", "Gabriel García Márquez", "One Hundred Years of Solitude", "Gabriel Garcia Marquez", "accented author"],
  ["One Hundred Years of Solitude", "García Márquez, Gabriel", "One Hundred Years of Solitude", "Gabriel García Márquez", "Last, First"],
  ["The Left Hand of Darkness", "Le Guin, Ursula K.", "The Left Hand of Darkness", "Ursula K. Le Guin", "Last, First with initial"],
  ["The Hobbit", "Tolkien, J. R. R.", "The Hobbit", "J.R.R. Tolkien", "Last, initials"],
  ["The Hobbit", "J.R.R. Tolkien", "The Hobbit", "J. R. R. Tolkien", "initials spacing"],
  ["The Left Hand of Darkness", "Ursula K. Le Guin", "The Left Hand of Darkness", "Ursula Le Guin", "middle initial"],
  ["The Vegetarian", "Han Kang & Deborah Smith", "The Vegetarian", "Han Kang", "translator after &"],
  ["The Vegetarian", "Han Kang, Deborah Smith", "The Vegetarian", "Han Kang", "translator after comma"],
  ["On the Calculation of Volume I", "Solvej Balle and Barbara J. Haveland", "On the Calculation of Volume 1", "Solvej Balle", "translator after 'and'"],
  ["The Odyssey", "Homer, Emily Wilson", "The Odyssey", "Homer", "classic with translator"],
  ["The Cat in the Hat", "Dr. Seuss", "The Cat in the Hat", "Seuss", "honorific"],
  ["The Name of the Wind (Kingkiller Chronicle, Book One)", "Patrick Rothfuss", "The Name of the Wind", "Patrick Rothfuss", "series tag, spelled number"],
  ["A Game of Thrones (A Song of Ice and Fire, Book 1)", "George R. R. Martin", "A Game of Thrones", "George R.R. Martin", "series tag"],
  ["Fourth Wing (The Empyrean, 1)", "Rebecca Yarros", "Fourth Wing", "Rebecca Yarros", "Amazon series tag"],
  ["Percy Jackson and the Olympians, Book One: The Lightning Thief", "Rick Riordan", "The Lightning Thief", "Rick Riordan", "series label before colon"],
  ["The Midnight Library: A Novel", "Matt Haig", "The Midnight Library", "Matt Haig", "': A Novel'"],
  ["Educated: A Memoir", "Tara Westover", "Educated", "Tara Westover", "': A Memoir'"],
  ["Outliers: The Story of Success", "Malcolm Gladwell", "Outliers", "Malcolm Gladwell", "'The …' description"],
  ["Becoming: Adapted for Young Readers", "Michelle Obama", "Becoming", "Michelle Obama", "adapted edition"],
  ["Harry Potter and the Chamber of Secrets: Illustrated Edition", "J.K. Rowling", "Harry Potter and the Chamber of Secrets", "J. K. Rowling", "illustrated edition"],
  ["Circe", "Madeline Miller", "CIRCE", "Madeline Miller", "all caps"],
  ["On the Calculation of Volume 1", "Solvej Balle", "On the Calculation of Volume I", "Solvej Balle", "volume numeral"],
  ["아몬드 (양장) - 제10회 창비 청소년문학상 수상작", "손원평", "아몬드", "손원평", "Korean edition and tagline"],
];

const DIFFERENT: Pair[] = [
  ["Dune", "Frank Herbert", "Dune: House Atreides", "Brian Herbert", "franchise, same surname"],
  ["Dune", "Frank Herbert", "Dune: The Butlerian Jihad", "Brian Herbert", "franchise, same surname, 'The' subtitle"],
  ["Star Wars: Heir to the Empire", "Timothy Zahn", "Star Wars: Dark Force Rising", "Timothy Zahn", "franchise, same author"],
  ["Warriors: Into the Wild", "Erin Hunter", "Warriors: Fire and Ice", "Erin Hunter", "series prefix, same author"],
  ["Collected Poems", "Emily Brontë", "Collected Poems", "Anne Brontë", "same title, same surname"],
  ["On the Calculation of Volume I", "Solvej Balle", "On the Calculation of Volume II", "Solvej Balle", "different volumes"],
  ["Dune", "Frank Herbert", "Dune Messiah", "Frank Herbert", "sequel"],
  ["It", "Stephen King", "Itch", "Stephen King", "short word"],
  ["The Stranger", "Albert Camus", "The Stranger", "Harlan Coben", "same title, different author"],
  ["Book 1", "Someone", "Book 10", "Someone", "1 vs 10"],
  ["The Fellowship of the Ring", "J.R.R. Tolkien", "The Two Towers", "J.R.R. Tolkien", "different book"],
  ["Little Women", "Louisa May Alcott", "Little Men", "Louisa May Alcott", "one word apart"],
  ["Almond", "Won-pyung Sohn", "아몬드", "손원평", "translation (needs REA-70)"],
];

const same = ([ta, aa, tb, ab]: Pair) => sameBookKey(dedupeKey(ta, aa), dedupeKey(tb, ab));

describe("book matching: the same book", () => {
  for (const p of SAME) it(p[4], () => expect(same(p)).toBe(true));
});

describe("book matching: different books", () => {
  for (const p of DIFFERENT) it(p[4], () => expect(same(p)).toBe(false));
});

describe("known gaps (left to Open Library's work id)", () => {
  it("co-authors listed in a different order", () => {
    expect(same(["Good Omens", "Terry Pratchett & Neil Gaiman", "Good Omens", "Neil Gaiman, Terry Pratchett", ""])).toBe(false);
  });
  it("family name first", () => {
    expect(same(["Norwegian Wood", "Murakami Haruki", "Norwegian Wood", "Haruki Murakami", ""])).toBe(false);
  });
});

describe("pieces", () => {
  it("reads the first author's initial and surname", () => {
    expect(authorKey("Frank Herbert")).toBe("f herbert");
    expect(authorKey("Han Kang & Deborah Smith")).toBe("h kang");
    expect(authorKey("García Márquez, Gabriel")).toBe("g marquez");
    expect(authorKey("Homer")).toBe("homer");
    expect(authorKey("손원평")).toBe("손원평");
    expect(authorKey(null)).toBe("");
  });
  it("strips labels from display titles", () => {
    expect(cleanTitle("Pachinko (National Book Award Finalist)")).toBe("Pachinko");
    expect(cleanTitle("Dune (Deluxe Edition) (The Dune Chronicles, #1)")).toBe("Dune");
    expect(cleanTitle("On the Calculation of Volume (Book I)")).toBe("On the Calculation of Volume (Book I)");
  });
});
