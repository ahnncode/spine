/** The genre "passport": one stamp per genre, each matched from Open Library subjects. */
export interface Genre {
  key: string;
  label: string;
  /** Fits a passport stamp (defaults to the label). */
  short?: string;
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
  { key: "business", label: "Business & self-help", short: "Self-help & biz", bg: "#3A3F7A", fg: "#F1F0FF", match: /self-help|self help|personal growth|self-actualization|\bbusiness\b|management|leadership|success in business|\bsuccess$|personal finance|finance, personal|\binvesting\b|\binvestments\b|productivity|negotiation|entrepreneur|career development|\bhabits?\b|motivation \(psychology\)|marketing/ },
  { key: "truecrime", label: "True crime", bg: "#4B5563", fg: "#FDE2D8", match: /true crime|criminal investigation|serial murder|serial killers|murder investigation|criminals|crime.*case studies/ },
  { key: "graphic", label: "Graphic novels", short: "Graphic", bg: "#C2185B", fg: "#FFF0F6", match: /graphic novels?|comic books|comics & graphic|\bmanga\b|^comics\b/ },
  { key: "ya", label: "Young adult", short: "YA", bg: "#5B3FB8", fg: "#F3EEFF", match: /young adult|\bteen(s|agers?)?\b/ },
  { key: "essays", label: "Essays, nature & travel", short: "Essays & travel", bg: "#4F7C8A", fg: "#F0F6F7", match: /\bessays\b|natural history|voyages and travels|description and travel|travel writing|^travel\b|nature writing|^nature$|outdoor life|wilderness|mountaineering|hiking/ },
];

export const GENRE_BY_KEY = Object.fromEntries(GENRES.map((g) => [g.key, g]));

/** Catalogue noise: list tags, awards, reading levels, and bookstore-aisle catch-alls. */
const NOISE = /^(nyt:|award:|lexile|age:|grade:|reading level|collectionid|serie:|series:)|new york times|science fiction, fantasy, horror|fantasy & horror|sci-fi & fantasy/;
/** Genres that only describe nonfiction, so "science fiction" never counts as science. */
const NONFICTION = new Set(["history", "memoir", "science", "business", "truecrime", "essays"]);
/** Signs a book is a novel, so a "crime" subject means a mystery, not true crime. */
const NOVEL = /fiction|detective and mystery stories|novels?$/;
/** Any of these among a book's subjects means it's a novel (or stories, or poems). */
const NOVEL_ANY = /fiction|\bnovels?\b|short stories|^stories$|^classics?$|classic literature|^(english|american|russian|french|german|italian|spanish) literature$|^poetry$/;
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
  // A novel never lands in a nonfiction genre, whatever its other subjects say
  // ("Inheritance and succession" on Bleak House is not a business book).
  const novel = lower.some((s) => NOVEL_ANY.test(s));
  lower.forEach((s, i) => {
    const w = 60 - i;
    for (const g of GENRES) {
      if (NONFICTION.has(g.key) && (novel || s.includes("fiction"))) continue;
      if (g.match.test(s)) add(g.key, w);
    }
    if (NATIONAL_LIT.test(s)) add(year != null && year < CLASSIC_BEFORE ? "classics" : "literary", w);
  });
  // Plain "Fiction" with nothing more specific reads as general literary fiction,
  // unless it's a children's book.
  if (!scores.size && lower.some((s) => s === "fiction" || s === "novels") && !lower.some((s) => /juvenile|children|picture books/.test(s))) {
    add("literary", 1);
  }
  // True crime is nonfiction: drop the mystery match its "crime"/"murder" subjects make.
  if (scores.has("truecrime") && !lower.some((s) => NOVEL.test(s))) scores.delete("mystery");
  const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1]);
  const top = ranked[0]?.[1] ?? 0;
  return ranked
    .filter(([, v]) => v >= top * 0.35)
    .slice(0, 3)
    .map(([k]) => k);
}

/** Apple Books' genre names → ours, for books Open Library can't place. First match wins per name. */
const APPLE: Array<[RegExp, string]> = [
  [/true crime/i, "truecrime"],
  [/comics|graphic novels|manga/i, "graphic"],
  [/young adult|teens?\b/i, "ya"],
  [/business|self-improvement|management|leadership|careers|investing|personal finance|entrepreneur|marketing|negotiat/i, "business"],
  [/science fiction|sci-fi/i, "scifi"],
  [/fantasy/i, "fantasy"],
  [/mysteries|thrillers|mystery|suspense|crime/i, "mystery"],
  [/romance/i, "romance"],
  [/horror/i, "horror"],
  [/historical fiction/i, "historical"],
  [/classics/i, "classics"],
  [/biographies|memoirs|autobiograph/i, "memoir"],
  [/^history|history$/i, "history"],
  [/science|psychology|nature|philosophy|economics/i, "science"],
  [/poetry/i, "poetry"],
  [/travel|essays|outdoors/i, "essays"],
  [/literary|fiction & literature/i, "literary"],
];
const APPLE_SKIP = /^(books|fiction|nonfiction|non-fiction|sci-fi & fantasy|kids)$/i;

const APPLE_NOVEL = /fiction|classics|literature|romance|mysteries|thrillers|sci-fi|fantasy|horror|poetry/i;

export function genresFromApple(names: string[] | undefined | null): string[] {
  const trueCrime = (names ?? []).some((n) => /true crime/i.test(n));
  const novel = !trueCrime && (names ?? []).some((n) => APPLE_NOVEL.test(n));
  const out: string[] = [];
  for (const n of names ?? []) {
    if (APPLE_SKIP.test(n.trim())) continue;
    const hit = APPLE.find(([re]) => re.test(n));
    if (hit && novel && NONFICTION.has(hit[1])) continue;
    if (hit && !out.includes(hit[1])) out.push(hit[1]);
    if (out.length >= 3) break;
  }
  // Apple files true crime next to thrillers; it isn't a mystery novel.
  return trueCrime ? out.filter((g) => g !== "mystery") : out;
}
