/** The genre "passport": twelve stamps, each matched from Open Library subjects. */
export interface Genre {
  key: string;
  label: string;
  bg: string;
  fg: string;
  match: RegExp;
}

export const GENRES: Genre[] = [
  { key: "literary", label: "Literary", bg: "#3E6B48", fg: "#F4F0E6", match: /literary fiction|psychological fiction|domestic fiction|family life|coming of age/ },
  { key: "scifi", label: "Sci-fi", bg: "#151515", fg: "#FF6A33", match: /science fiction|dystopia|space opera|cyberpunk|time travel|robots/ },
  { key: "fantasy", label: "Fantasy", bg: "#1F3A5F", fg: "#F2EBDD", match: /fantasy|magic|dragons|wizards|fairy tales/ },
  { key: "mystery", label: "Mystery", bg: "#2A2A2A", fg: "#F2C14E", match: /mystery|detective|thriller|suspense|crime|murder/ },
  { key: "romance", label: "Romance", bg: "#7A2E4D", fg: "#F7E7EE", match: /romance|love stories/ },
  { key: "horror", label: "Horror", bg: "#4A1414", fg: "#F3D9D3", match: /horror|ghost stories|supernatural|vampires|haunted/ },
  { key: "historical", label: "Historical", bg: "#B5452B", fg: "#FBEFE3", match: /historical fiction|war stories|western stories|westerns/ },
  { key: "classics", label: "Classics", bg: "#F2C14E", fg: "#111111", match: /classic literature|classics|english literature|american literature|russian literature|french literature/ },
  { key: "history", label: "History", bg: "#6B4E2E", fg: "#F5EBDD", match: /^history|history$|world war|civilization|politics and government|social history/ },
  { key: "memoir", label: "Memoir", bg: "#0F5257", fg: "#E8F3F1", match: /biography|autobiography|memoir|personal narratives|biographies/ },
  { key: "science", label: "Science", bg: "#2D3FE0", fg: "#FFFFFF", match: /popular works|science|physics|biology|evolution|psychology|economics|nature|philosophy/ },
  { key: "poetry", label: "Poetry", bg: "#E9E4DA", fg: "#2A2A2A", match: /poetry|poems|verse/ },
];

export const GENRE_BY_KEY = Object.fromEntries(GENRES.map((g) => [g.key, g]));

/** Up to three genre keys for a book, from its Open Library subjects. */
export function genresFromSubjects(subjects: string[] | undefined | null): string[] {
  if (!subjects?.length) return [];
  const lower = subjects.slice(0, 60).map((s) => s.toLowerCase());
  const scores = new Map<string, number>();
  lower.forEach((s, i) => {
    for (const g of GENRES) {
      if (g.match.test(s)) scores.set(g.key, (scores.get(g.key) ?? 0) + (60 - i));
    }
  });
  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([k]) => k);
}
