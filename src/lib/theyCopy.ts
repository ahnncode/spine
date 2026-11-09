/**
 * Turn reader-type copy written to "you" into copy about someone else
 * ("they"). "They" takes the same verb forms as "you", so only pronouns
 * change: a subject "you" becomes "they", an object "you" becomes "them".
 */
const SUBJECT_BEFORE = /(^|[.!?:;,—–(“"]\s*|\b(?:and|but|or|if|when|where|while|because|that|once|as|so|until|unless|before|after|than|then|what|how|who|which|why|whether|though|although|since|yet)\s+)$/i;

/** Words that tend to follow an object "you" ("gets to you, it…", "gives you a new idea"). */
const OBJECT_NEXT = new Set(["to", "a", "an", "the", "in", "into", "out", "up", "down", "of", "for", "with", "on", "at", "from", "off", "back", "over", "away", "something", "nothing", "anything", "and", "but", "or", "so", "again", "most", "more", "every", "all"]);

export function toThey(text: string): string {
  let out = "";
  let last = 0;
  const re = /\b(you’re|you're|you’ve|you've|you’ll|you'll|you’d|you'd|yourselves|yourself|yours|your|you)\b/gi;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    const word = m[0];
    const lower = word.toLowerCase().replace("'", "’");
    const before = out + text.slice(last, m.index);
    let rep: string;
    switch (lower) {
      case "you’re": rep = "they’re"; break;
      case "you’ve": rep = "they’ve"; break;
      case "you’ll": rep = "they’ll"; break;
      case "you’d": rep = "they’d"; break;
      case "yourself": case "yourselves": rep = "themselves"; break;
      case "yours": rep = "theirs"; break;
      case "your": rep = "their"; break;
      default: {
        const next = /^\s*([A-Za-z’']+)/.exec(text.slice(m.index + word.length))?.[1]?.toLowerCase();
        rep = SUBJECT_BEFORE.test(before) || (next != null && !OBJECT_NEXT.has(next)) ? "they" : "them";
      }
    }
    if (word[0] === word[0].toUpperCase()) rep = rep[0].toUpperCase() + rep.slice(1);
    out = before + rep;
    last = m.index + word.length;
  }
  return out + text.slice(last);
}
