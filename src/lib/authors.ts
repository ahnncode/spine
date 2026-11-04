/**
 * Author names for English readers. Open Library often lists authors in their
 * own script (村上春樹, 刘慈欣); its "alternative names" usually include the
 * English spelling, in one order or another.
 */

/** Letters outside the Latin alphabet (accents are fine). */
const NON_LATIN = /[^\u0000-ɏḀ-ỿ -⁯]/;

export function isLatin(name: string): boolean {
  return !NON_LATIN.test(name);
}

function titleCase(word: string): string {
  return word
    .toLowerCase()
    .replace(/(^|[-'’])(\p{L})/gu, (_, sep: string, c: string) => sep + c.toUpperCase());
}

function tidy(name: string): string {
  return name.replace(/\s+/g, " ").trim();
}

/**
 * The best English spelling of an author's name, given Open Library's name
 * and alternatives. `guessed` means the word order is a best guess.
 */
export function englishAuthorName(name: string | null | undefined, alternatives: string[] = []): { name: string | null; guessed: boolean } {
  if (!name) return { name: null, guessed: false };
  if (isLatin(name)) return { name, guessed: false };

  const latin = alternatives.map(tidy).filter((a) => a && isLatin(a) && !a.includes(";") && /\p{L}/u.test(a));
  // "Yoshimoto, Banana": the part before the comma is the family name.
  const comma = latin.find((a) => /^[^,]+, [^,]+$/.test(a) && a.split(" ").length <= 4);
  if (comma) {
    const [family, given] = comma.split(", ");
    return { name: `${given.split(" ").map(titleCase).join(" ")} ${family.split(" ").map(titleCase).join(" ")}`, guessed: false };
  }
  // "Haruki MURAKAMI": librarians capitalise the family name.
  const capped = latin.find((a) => {
    const w = a.split(" ");
    return w.length === 2 && w.some((x) => x.length > 1 && x === x.toUpperCase()) && w.some((x) => x !== x.toUpperCase());
  });
  if (capped) {
    const w = capped.split(" ");
    const familyFirst = w[0] === w[0].toUpperCase();
    const [given, family] = familyFirst ? [w[1], w[0]] : [w[0], w[1]];
    return { name: `${titleCase(given)} ${titleCase(family)}`, guessed: false };
  }
  // Otherwise the first sensible spelling (word order unknown).
  const plain = latin.find((a) => a !== a.toUpperCase() && a.split(" ").length >= 2 && a.split(" ").length <= 4);
  if (plain) return { name: plain.split(" ").map((w) => (w === w.toLowerCase() || w === w.toUpperCase() ? titleCase(w) : w)).join(" "), guessed: true };
  return { name, guessed: false };
}

/** The words of a name, for comparing spellings in any order. */
export function nameWords(name: string): Set<string> {
  return new Set(
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .split(/[^a-z]+/)
      .filter((w) => w.length > 1),
  );
}
