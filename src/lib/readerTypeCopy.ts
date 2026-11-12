/**
 * Words for reader types: the 16 types, their four families, the six reading
 * drives and the blind spots. Kept apart from the scoring (readerType.ts) so
 * copy can be edited without touching the maths.
 *
 * House rules for this copy: both ends of every spectrum are good things to
 * be. No type is better than another. Say specific things that could be
 * wrong about someone (that's what makes the right ones land), and never
 * write a line that would fit everybody.
 */

export type FamilyKey = "wayfarers" | "cartographers" | "keepers" | "scholars";

export interface Family {
  key: FamilyKey;
  label: string;
  /** What the two shared letters mean, in plain words. */
  gist: string;
  bg: string;
  fg: string;
  /** A quieter tone of the same colour, for bars and chips on the bg. */
  soft: string;
}

export const FAMILIES: Record<FamilyKey, Family> = {
  wayfarers: { key: "wayfarers", label: "Wayfarers", gist: "Read widely, for how a book feels", bg: "#FF5A1F", fg: "#111111", soft: "rgba(17,17,17,0.18)" },
  cartographers: { key: "cartographers", label: "Cartographers", gist: "Read widely, to map ideas", bg: "#2D3FE0", fg: "#FFFFFF", soft: "rgba(255,255,255,0.28)" },
  keepers: { key: "keepers", label: "Keepers", gist: "Go deep, for how a book feels", bg: "#7A2E4D", fg: "#F7E7EE", soft: "rgba(247,231,238,0.26)" },
  scholars: { key: "scholars", label: "Scholars", gist: "Go deep, to understand", bg: "#2D6A3E", fg: "#EAF3EC", soft: "rgba(234,243,236,0.26)" },
};

export interface TypeCopy {
  name: string;
  tagline: string;
  about: string;
  superpower: string;
  watchOut: string;
}

/**
 * Letters, in order: Range (W wide / D deep), Lens (H heart / M mind),
 * Rhythm (F finisher / G grazer), Bar (E enthusiast / C critic).
 */
export const TYPES: Record<string, TypeCopy> = {
  // Wayfarers: wide + heart
  WHFE: {
    name: "The Pen Pal",
    tagline: "Writes back to every kind of book.",
    about: "You’ll follow a good character into any genre, and once you’ve started a book you see it through. You go in hoping to love it, and you usually do.",
    superpower: "You find the warm heart in books other people wrote off as ‘not my thing’.",
    watchOut: "Loving widely can blur your favorites together. Your top ten should feel like a fight.",
  },
  WHFC: {
    name: "The Witness",
    tagline: "Sees every story through, then tells the truth about it.",
    about: "You read across the whole shop for the people inside the books, you finish what you start, and your verdicts are honest. If you say a book got to you, it really did.",
    superpower: "Your recommendations carry weight because you don’t hand them out.",
    watchOut: "Finishing books you’ve already judged costs you time you could give the next great one.",
  },
  WHGE: {
    name: "The Magpie",
    tagline: "Collects shiny books from every shelf, several at a time.",
    about: "You’ve always got a few books going, in different genres, picked up because something about them glinted. You follow your mood and fall for a lot of what you read.",
    superpower: "You stumble onto books nobody else in your circle has heard of, and they’re good.",
    watchOut: "Slow-building books need a run-up you rarely give them before something shinier comes along.",
  },
  WHGC: {
    name: "The Sommelier",
    tagline: "Tastes everything. Keeps very little.",
    about: "You sample widely and juggle several books, but very few earn a place among your favorites. You read for feeling, and you can tell real feeling from the manufactured kind.",
    superpower: "Your ‘loved’ shelf is short, strange and completely trustworthy.",
    watchOut: "A first chapter isn’t the whole bottle. Some books only open up halfway.",
  },

  // Cartographers: wide + mind
  WMFE: {
    name: "The Cartographer",
    tagline: "Maps every territory, edge to edge.",
    about: "You read across subjects and genres to see how the world fits together, and you finish each map before starting the next. You’re easy to delight when a book gives you a new idea.",
    superpower: "You connect ideas from books nobody else would shelve together.",
    watchOut: "Not every book is a territory to survey. Some just want you to feel something.",
  },
  WMFC: {
    name: "The Examiner",
    tagline: "Reads it all the way through. Grades it all the way down.",
    about: "Broad interests, a finisher’s discipline and a demanding bar. You give every book a full hearing, then hold its ideas to account.",
    superpower: "You can say exactly why a book didn’t work, which makes you great to argue with.",
    watchOut: "A book can be flawed and still change your mind. Keep room for those.",
  },
  WMGE: {
    name: "The Polymath",
    tagline: "Five books open, five subjects deep, delighted by all of it.",
    about: "You keep several books going across very different subjects and you’re genuinely excited by most of them. Your curiosity jumps between topics on purpose.",
    superpower: "You know a surprising amount about a surprising number of things.",
    watchOut: "Breadth is your gift; the occasional long, slow book is how it turns into depth.",
  },
  WMGC: {
    name: "The Scout",
    tagline: "Samples widely, reports back honestly.",
    about: "You range across genres and subjects, keep a few books in play, and drop or downgrade what doesn’t earn its place. Your friends rely on you to say which books are actually worth it.",
    superpower: "You find the good stuff fast, and you’re honest about the rest.",
    watchOut: "Judging early saves time, but some of the best books are slow starters.",
  },

  // Keepers: deep + heart
  DHFE: {
    name: "The Devotee",
    tagline: "Finds their shelf and loves it all the way.",
    about: "You know the kind of book that moves you, and you return to it again and again, one book at a time, all the way to the end. You read generously and it shows.",
    superpower: "You know your corner of the library better than almost anyone.",
    watchOut: "The books that would move you most might be one shelf over.",
  },
  DHFC: {
    name: "The Purist",
    tagline: "Knows exactly what they love, and exactly what isn’t it.",
    about: "You’ve found the books that reach you and you hold them to a high standard. You finish what you start, and you can tell the real thing from a copy.",
    superpower: "Within your genre, your taste is close to infallible.",
    watchOut: "High standards inside one corner can turn into a closed door. Visit a neighbour now and then.",
  },
  DHGE: {
    name: "The Romantic",
    tagline: "Several love affairs, one corner of the library.",
    about: "You keep a few books going at once, mostly the same kind, chosen by how you feel that day. You fall hard and often.",
    superpower: "You know exactly which book fits which mood.",
    watchOut: "When everything is a favorite, nothing is. Make your books fight for the top spot.",
  },
  DHGC: {
    name: "The Connoisseur",
    tagline: "Knows their corner by heart, and only the best stays.",
    about: "You go deep in the books that move you, juggle a few at a time, and keep very few. You’ve read enough of your genre to know when it’s being done well.",
    superpower: "Ask you for the single best book of its kind and you’ll be right.",
    watchOut: "You’ve read so much of your corner that new books have to work twice as hard. Some deserve the benefit of the doubt.",
  },

  // Scholars: deep + mind
  DMFE: {
    name: "The Completionist",
    tagline: "Every book in the series. Every footnote.",
    about: "Once a subject or series has you, you read all of it, in order, one book at a time. You enjoy the deep end more than most.",
    superpower: "You become the expert on whatever you’re into, fast.",
    watchOut: "Finishing a series out of loyalty is still a choice. You’re allowed to stop.",
  },
  DMFC: {
    name: "The Scholar",
    tagline: "Goes deep, finishes, and holds it to a high standard.",
    about: "You pick a subject, read it seriously and see each book through, and you don’t grade on a curve. Your shelf is narrow and earned.",
    superpower: "Your opinions on your subject are worth more than most reviews.",
    watchOut: "Some books aren’t trying to be rigorous. Letting them just be fun is allowed.",
  },
  DMGE: {
    name: "The Burrower",
    tagline: "Digs several tunnels into the same hill at once.",
    about: "You fall down a subject and read three books about it at the same time, happily. Your interests are focused, your method is not.",
    superpower: "You can get from curious to well-read on a topic in a few weeks.",
    watchOut: "Half-finished tunnels add up. Pick one to come out the other side of.",
  },
  DMGC: {
    name: "The Skeptic",
    tagline: "Opens many, believes few.",
    about: "You know your subject, start plenty of books in it, and only a handful survive your scrutiny. Nothing gets a pass for being popular.",
    superpower: "You’re immune to hype. Your praise is rare and earned.",
    watchOut: "A strong prior can make every new book look like a rerun. Stay surprisable.",
  },
};

/**
 * One colour per type. The hue is the family; brighter = Enthusiast, deeper =
 * Critic; Grazers sit one step along the colour wheel from Finishers.
 * Used for the type pill, the ring around avatars, the result page and slides.
 */
export const TYPE_COLOR: Record<string, { bg: string; fg: string }> = {
  WHFE: { bg: "#FF7A3D", fg: "#111111" }, WHGE: { bg: "#F5A524", fg: "#111111" },
  WHFC: { bg: "#B83A0E", fg: "#FFFFFF" }, WHGC: { bg: "#8C4A0B", fg: "#FFFFFF" },
  WMFE: { bg: "#2D3FE0", fg: "#FFFFFF" }, WMGE: { bg: "#3E9BEA", fg: "#111111" },
  WMFC: { bg: "#1A237E", fg: "#FFFFFF" }, WMGC: { bg: "#0F4C75", fg: "#FFFFFF" },
  DHFE: { bg: "#E0457B", fg: "#111111" }, DHGE: { bg: "#F27C8F", fg: "#111111" },
  DHFC: { bg: "#7A2E4D", fg: "#F7E7EE" }, DHGC: { bg: "#5E1F5C", fg: "#F6E8F6" },
  DMFE: { bg: "#2FA36B", fg: "#111111" }, DMGE: { bg: "#9BC53D", fg: "#111111" },
  DMFC: { bg: "#1F5C3A", fg: "#EAF3EC" }, DMGC: { bg: "#14504F", fg: "#E6F2F1" },
};

export function familyKeyOf(code: string): FamilyKey {
  return code[0] === "W" ? (code[1] === "H" ? "wayfarers" : "cartographers") : code[1] === "H" ? "keepers" : "scholars";
}

export type DriveKey = "escape" | "thrill" | "feeling" | "wonder" | "understanding" | "craft";

export interface DriveCopy {
  key: DriveKey;
  label: string;
  /** What you're after when you open a book. */
  desire: string;
  /** What makes you put one down. */
  shadow: string;
  /** Short form for slides: "driven by …". */
  short: string;
  bg: string;
  fg: string;
}

/** Colours borrow from the matching genre palette in genres.ts. */
export const DRIVES: Record<DriveKey, DriveCopy> = {
  escape: { key: "escape", label: "Escape", desire: "To be somewhere else for a while, and come back rested.", shadow: "A book that never lets you forget where you are.", short: "to get away", bg: "#1F3A5F", fg: "#F2EBDD" },
  thrill: { key: "thrill", label: "Thrill", desire: "To not know what happens next.", shadow: "A story that tips its hand.", short: "to find out what happens", bg: "#2A2A2A", fg: "#F2C14E" },
  feeling: { key: "feeling", label: "Feeling", desire: "To feel something all the way through.", shadow: "A book that keeps you at arm’s length.", short: "to feel something", bg: "#7A2E4D", fg: "#F7E7EE" },
  wonder: { key: "wonder", label: "Wonder", desire: "To have your sense of what’s possible stretched.", shadow: "The ordinary, explained slowly.", short: "to have my mind bent", bg: "#151515", fg: "#FF6A33" },
  understanding: { key: "understanding", label: "Understanding", desire: "To understand how the world actually works.", shadow: "Being confidently wrong, or a book that is.", short: "to understand", bg: "#2D3FE0", fg: "#FFFFFF" },
  craft: { key: "craft", label: "Craft", desire: "To be in the hands of a great writer.", shadow: "Sloppy sentences, however good the plot.", short: "for the writing", bg: "#F2C14E", fg: "#111111" },
};

/** A neighbouring genre a reader with this drive tends to love, and why. Tried in order. */
export const STRETCH: Record<DriveKey, Array<{ genre: string; why: string }>> = {
  escape: [
    { genre: "graphic", why: "The fastest door out of your own head is a great graphic novel. You can be somewhere else in ten pages." },
    { genre: "historical", why: "Historical fiction is escape with a passport: a whole other world, and it really existed." },
    { genre: "fantasy", why: "If you read to get away, fantasy goes further than anything else on the shelf." },
    { genre: "essays", why: "Travel and nature writing are escape for real places. Try one with a map in the front." },
  ],
  thrill: [
    { genre: "truecrime", why: "Same pull as a great mystery, except it happened. Pick a deeply researched one." },
    { genre: "horror", why: "Horror is suspense with the dial turned up. Start with something more creepy than gory." },
    { genre: "history", why: "Narrative history has better twists than most thrillers, and nobody can spoil the ending for you because you never learned it." },
    { genre: "scifi", why: "A tight sci-fi thriller gives you the not-knowing plus a world you can’t predict." },
  ],
  feeling: [
    { genre: "memoir", why: "Memoir is feeling without the fiction. The best ones hit harder because they’re true." },
    { genre: "poetry", why: "A good collection gets a novel’s worth of feeling into a page. Read one aloud." },
    { genre: "ya", why: "The best young adult books feel everything at full volume, which is exactly your setting." },
    { genre: "historical", why: "Historical fiction puts ordinary hearts inside huge events. It’s your kind of devastating." },
  ],
  wonder: [
    { genre: "science", why: "The real universe is stranger than most sci-fi. Popular science will bend your mind and it’s all true." },
    { genre: "history", why: "History is world-building that actually happened, with stranger rules than most invented worlds." },
    { genre: "fantasy", why: "If ideas light you up, fantasy with a strange magic system is a thought experiment in disguise." },
    { genre: "scifi", why: "Science fiction is the purest form of ‘what if’. Try one of the big-idea classics." },
  ],
  understanding: [
    { genre: "scifi", why: "Science fiction is a thought experiment with a plot. You’ll get the ideas and a story." },
    { genre: "memoir", why: "A memoir shows how one life actually works, up close. It’s research you can feel." },
    { genre: "literary", why: "Literary fiction is how people really think, written down. It’ll teach you things no textbook can." },
    { genre: "historical", why: "Historical fiction makes the history you know feel lived-in." },
  ],
  craft: [
    { genre: "poetry", why: "Poetry is writing with nothing to hide behind. If you read for sentences, it’s the source." },
    { genre: "essays", why: "Great essayists write the best sentences in the shop, without a plot in the way." },
    { genre: "classics", why: "Classics last mostly because of the writing. Pick one you always meant to read." },
    { genre: "literary", why: "Contemporary literary fiction is where the boldest writing is happening right now." },
  ],
};

/** The cost of leaning hard toward one end of a spectrum. Shown for the reader's strongest lean. */
export const BLIND_SPOTS: Record<string, string> = {
  W: "You rarely stay with one kind of book long enough to reach its deep cuts. The best book in a genre is usually the tenth one you read, not the first.",
  D: "Your corner is rich, but it’s a corner. The books that would surprise you most are on shelves you walk past.",
  H: "Books with brilliant ideas and thin characters lose you, even when the ideas are worth it.",
  M: "You can undersell books that are ‘only’ about people. Some of the sharpest ideas are hiding inside them.",
  F: "You’ll finish a book you stopped enjoying a hundred pages ago. That’s hours you could give to the next great one.",
  G: "Long, slow-building books need a run-up you rarely give them. Some of the best books ever written start slow.",
  E: "When you love almost everything, your favorites get hard to tell apart. Sharpen your ranking to find your real number one.",
  C: "A high bar keeps out the duds, and sometimes the books that only work in their second half.",
};
