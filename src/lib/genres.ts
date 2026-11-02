/** The genre "passport": twelve stamps, each matched from Open Library subjects. */
export interface Genre {
  key: string;
  label: string;
  bg: string;
  fg: string;
  match: RegExp;
}

export const GENRES: Genre[] = [
  { key: "literary", label: "Literary", bg: "#3E6B48", fg: "#F4F0E6", match: /literary fiction|psychological fiction|domestic fiction|family life|coming of age|bildungsroman|modern fiction|fiction, general|general fiction|literary/ },
  { key: "scifi", label: "Sci-fi", bg: "#151515", fg: "#FF6A33", match: /science fiction|science-fiction|sci-fi|dystopia|space opera|cyberpunk|time travel|robots/ },
  { key: "fantasy", label: "Fantasy", bg: "#1F3A5F", fg: "#F2EBDD", match: /fantasy|magic|dragons|wizards|fairy tales|mytholog/ },
  { key: "mystery", label: "Mystery", bg: "#2A2A2A", fg: "#F2C14E", match: /mystery|detective|thriller|crime|murder/ },
  { key: "romance", label: "Romance", bg: "#7A2E4D", fg: "#F7E7EE", match: /romance|love stories/ },
  { key: "horror", label: "Horror", bg: "#4A1414", fg: "#F3D9D3", match: /horror|ghost stories|vampires|haunted houses|zombies/ },
  { key: "historical", label: "Historical", bg: "#B5452B", fg: "#FBEFE3", match: /historical fiction|fiction, historical|war stories|western stories|westerns/ },
  { key: "classics", label: "Classics", bg: "#F2C14E", fg: "#111111", match: /classic literature|^classics$|^classic$/ },
  { key: "history", label: "History", bg: "#6B4E2E", fg: "#F5EBDD", match: /^history|history$|world war|civilization|politics and government|social history/ },
  { key: "memoir", label: "Memoir", bg: "#0F5257", fg: "#E8F3F1", match: /biography|autobiography|memoir|personal narratives|biographies/ },
  { key: "science", label: "Science", bg: "#2D3FE0", fg: "#FFFFFF", match: /popular works|^science|science$|physics|biology|evolution|psychology|economics|philosophy/ },
  { key: "poetry", label: "Poetry", bg: "#E9E4DA", fg: "#2A2A2A", match: /poetry|poems|verse/ },
];

export const GENRE_BY_KEY = Object.fromEntries(GENRES.map((g) => [g.key, g]));

/** Catalogue noise: list tags, awards, reading levels, and bookstore-aisle catch-alls. */
const NOISE = /^(nyt:|award:|lexile|age:|grade:|reading level|collectionid|serie:|series:)|new york times|science fiction, fantasy, horror|fantasy & horror|sci-fi & fantasy/;
/** Genres that only describe nonfiction, so "science fiction" never counts as science. */
const NONFICTION = new Set(["history", "memoir", "science"]);
/** National-literature subjects mean "classic" only for older books. */
const NATIONAL_LIT = /^(english|american|russian|french|german|italian|spanish) literature$/;
const CLASSIC_BEFORE = 1950;

/**
 * Up to three genre keys for a book, from its Open Library subjects (earlier
 * subjects count more). Weak, stray matches are dropped.
 */
export function genresFromSubjects(subjects: string[] | undefined | null, year?: number | null): string[] {
  if (!subjects?.length) return [];
  const lower = subjects.slice(0, 60).map((s) => s.toLowerCase().trim()).filter((s) => s && !NOISE.test(s));
  const scores = new Map<string, number>();
  const add = (key: string, w: number) => scores.set(key, (scores.get(key) ?? 0) + w);
  lower.forEach((s, i) => {
    const w = 60 - i;
    for (const g of GENRES) {
      if (NONFICTION.has(g.key) && s.includes("fiction")) continue;
      if (g.match.test(s)) add(g.key, w);
    }
    if (NATIONAL_LIT.test(s)) add(year != null && year < CLASSIC_BEFORE ? "classics" : "literary", w);
  });
  // Plain "Fiction" with nothing more specific reads as general literary fiction,
  // unless it's a children's book.
  if (!scores.size && lower.some((s) => s === "fiction" || s === "novels") && !lower.some((s) => /juvenile|children|picture books/.test(s))) {
    add("literary", 1);
  }
  const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1]);
  const top = ranked[0]?.[1] ?? 0;
  return ranked
    .filter(([, v]) => v >= top * 0.35)
    .slice(0, 3)
    .map(([k]) => k);
}
