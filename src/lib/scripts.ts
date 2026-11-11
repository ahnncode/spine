/**
 * Book titles and author names in scripts other than Latin (Korean, Japanese,
 * Chinese, Russian, …). The app stays in English, but these books need to be
 * found, kept apart and shown as their readers know them.
 */

/** Letters of the non-Latin scripts book titles commonly use. */
const NATIVE = "\\p{Script=Hangul}\\p{Script=Han}\\p{Script=Hiragana}\\p{Script=Katakana}\\p{Script=Cyrillic}\\p{Script=Greek}\\p{Script=Arabic}\\p{Script=Hebrew}\\p{Script=Devanagari}\\p{Script=Thai}";

/** Everything that isn't a–z, 0–9, a space, or a letter in one of those scripts. */
export const NOT_A_KEY_CHAR = new RegExp(`[^a-z0-9 ${NATIVE}]+`, "gu");
/** Same, for splitting into words. */
export const NOT_A_WORD_CHAR = new RegExp(`[^a-z0-9${NATIVE}]+`, "u");

/**
 * Lowercase and drop accents (é → e) without breaking other scripts: NFKD
 * splits Korean syllables into their parts, so they're put back together.
 */
export function fold(s: string): string {
  return s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").normalize("NFC");
}

const HANGUL = /\p{Script=Hangul}/u;
const KANA = /[\p{Script=Hiragana}\p{Script=Katakana}]/u;
const HAN = /\p{Script=Han}/u;
const OTHER_NATIVE = new RegExp(`[${NATIVE}]`, "u");

export type NativeScript = "ko" | "ja" | "zh" | "other";

/** Which non-Latin script a piece of text is in, if any. Korean wins over the Hanja it sometimes uses. */
export function nativeScript(text: string | null | undefined): NativeScript | null {
  if (!text) return null;
  if (HANGUL.test(text)) return "ko";
  if (KANA.test(text)) return "ja";
  if (HAN.test(text)) return "zh";
  if (OTHER_NATIVE.test(text)) return "other";
  return null;
}

/** Apple's store with the most books in that script. */
export function appleCountry(text: string | null | undefined): string {
  const s = nativeScript(text);
  return s === "ko" ? "kr" : s === "ja" ? "jp" : s === "zh" ? "tw" : "us";
}

/** Open Library's language codes, for the search's preferred edition and for edition languages. */
export function openLibraryLanguage(text: string | null | undefined): { lang: string; edition: string } {
  const s = nativeScript(text);
  if (s === "ko") return { lang: "ko", edition: "kor" };
  if (s === "ja") return { lang: "ja", edition: "jpn" };
  if (s === "zh") return { lang: "zh", edition: "chi" };
  return { lang: "en", edition: "eng" };
}

/** Korean ISBNs start 978-89 or 979-11; Japanese 978-4. */
export function isbnCountry(isbn: string): string {
  const d = isbn.replace(/\D/g, "");
  if (d.startsWith("97889") || d.startsWith("97911")) return "kr";
  if (d.startsWith("9784")) return "jp";
  return "us";
}
