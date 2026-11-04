import { describe, expect, it } from "vitest";
import { englishAuthorName, isLatin } from "./authors";

// Real Open Library alternative names.
describe("englishAuthorName", () => {
  it("leaves English names alone", () => {
    expect(englishAuthorName("Han Kang", ["한강/ハン・カン", "韓江", "Kang Han"])).toEqual({ name: "Han Kang", guessed: false });
    expect(englishAuthorName("Gabriel García Márquez", [])).toEqual({ name: "Gabriel García Márquez", guessed: false });
  });
  it("uses the capitalised family name to get the order right", () => {
    expect(englishAuthorName("村上春樹", ["MURAKAMI HARUKI", "Murakami Haruki", "村上春树", "무라카미, 하루키", "Haruki MURAKAMI", "Murakami Kharuki"]).name).toBe("Haruki Murakami");
  });
  it("uses 'Family, Given' forms", () => {
    expect(englishAuthorName("吉本 ばなな", ["Banana Yoshimoto", "吉本 真秀子", "BANANA YOSHIMOTO", "よしもと ばなな", "Yoshimoto Banana", "Yoshimoto, Banana"]).name).toBe("Banana Yoshimoto");
  });
  it("falls back to the first readable spelling, flagged as a guess", () => {
    expect(englishAuthorName("刘慈欣", ["Cixin Liu; Liu Cixin", "Cixin Liu", "Лю Цысинь", "Liu Cixin"])).toEqual({ name: "Cixin Liu", guessed: true });
    expect(englishAuthorName("村田沙耶香", ["Murata Sayaka", "Sayaka Murata", "村田, 沙耶香", "무라타 사야카", "MURATA  SAYAKA"])).toEqual({ name: "Murata Sayaka", guessed: true });
  });
  it("keeps the original when there's no English spelling", () => {
    expect(englishAuthorName("Лев Толстой", [])).toEqual({ name: "Лев Толстой", guessed: false });
    expect(isLatin("Лев Толстой")).toBe(false);
  });
});
