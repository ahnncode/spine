import { describe, expect, it } from "vitest";
import { dedupeKey, sameBookKey } from "./books";
import { genresFromApple } from "./genres";
import { authorToCheck } from "./openlibrary";
import { appleCountry, fold, isbnCountry, nativeScript, openLibraryLanguage } from "./scripts";

describe("Korean and other non-Latin books", () => {
  it("gives every Korean book its own catalogue key", () => {
    const keys = [
      dedupeKey("채식주의자", "한강"),
      dedupeKey("소년이 온다", "한강"),
      dedupeKey("아몬드", "손원평"),
      dedupeKey("82년생 김지영", "조남주"),
    ];
    expect(new Set(keys).size).toBe(4);
    for (const k of keys) expect(k.split("|")[0]).not.toBe("");
    expect(dedupeKey("채식주의자", "한강")).toBe("채식주의자|한강");
  });

  it("keeps Korean syllables whole (no stray jamo)", () => {
    expect(fold("채식주의자")).toBe("채식주의자");
    expect(fold("Éclair")).toBe("eclair");
  });

  it("still matches the same Korean book with a subtitle", () => {
    expect(dedupeKey("소년이 온다: 한강 장편소설", "한강")).toBe(dedupeKey("소년이 온다", "한강"));
  });

  it("keeps Japanese, Chinese and Russian titles apart too", () => {
    expect(new Set([dedupeKey("ノルウェイの森", "村上春樹"), dedupeKey("三体", "刘慈欣"), dedupeKey("Мастер и Маргарита", "Булгаков")]).size).toBe(3);
  });

  it("leaves English keys exactly as they were", () => {
    expect(dedupeKey("The Remains of the Day", "Kazuo Ishiguro")).toBe("remains of day|ishiguro");
    expect(dedupeKey("Søren's Café: A Novel", "Anne Brontë")).toBe("s ren s cafe|bronte");
    expect(sameBookKey("a confed of dunces|toole", "a confederacy of dunces|toole")).toBe(true);
  });

  it("knows which store and language to search", () => {
    expect(nativeScript("채식주의자")).toBe("ko");
    expect(nativeScript("ノルウェイの森")).toBe("ja");
    expect(nativeScript("三体")).toBe("zh");
    expect(nativeScript("Piranesi")).toBeNull();
    expect(appleCountry("아몬드")).toBe("us"); // no Apple Books in Korea
    expect(appleCountry("ノルウェイの森")).toBe("jp");
    expect(appleCountry("Piranesi")).toBe("us");
    expect(openLibraryLanguage("아몬드")).toEqual({ lang: "ko", edition: "kor" });
    expect(isbnCountry("9788936434120")).toBe("kr");
    expect(isbnCountry("9791190090018")).toBe("kr");
    expect(isbnCountry("9780316069359")).toBe("us");
  });

  it("keeps a Korean book's author in Korean", () => {
    expect(authorToCheck({ title: "채식주의자", author: "한강" })).toBeNull();
    expect(authorToCheck({ title: "The Vegetarian", author: "한강" })).toEqual(["한강"]);
  });

  it("reads Apple's Korean genre names", () => {
    expect(genresFromApple(["소설", "추리/미스터리"])).toEqual(["mystery"]);
    expect(genresFromApple(["판타지"])).toEqual(["fantasy"]);
    expect(genresFromApple(["에세이"])).toEqual(["essays"]);
    expect(genresFromApple(["역사 소설"])).toEqual(["historical"]);
    expect(genresFromApple(["한국 소설"])).toEqual(["literary"]);
    expect(genresFromApple(["자기계발"])).toEqual(["business"]);
  });
});

describe("Korean store titles", () => {
  it("drops edition labels and the marketing tail", async () => {
    const { cleanTitle } = await import("./books");
    expect(cleanTitle("아몬드 (양장) - 제10회 창비 청소년문학상 수상작")).toBe("아몬드");
    expect(cleanTitle("채식주의자 (리커버 특별판)")).toBe("채식주의자");
    expect(cleanTitle("소년이 온다 [큰글자책]")).toBe("소년이 온다");
    expect(cleanTitle("82년생 김지영 (개정판)")).toBe("82년생 김지영");
    expect(cleanTitle("작별하지 않는다")).toBe("작별하지 않는다");
    expect(cleanTitle("Mrs. Dalloway - A Novel")).toBe("Mrs. Dalloway - A Novel");
  });
});

describe("Google Books results", () => {
  it("reads a Korean volume", async () => {
    const { fromVolume, googleCover } = await import("./googlebooks");
    const b = fromVolume({ volumeInfo: {
      title: "아몬드 (양장)", authors: ["손원평 (지은이)"], publishedDate: "2017-03-31", pageCount: 264,
      industryIdentifiers: [{ type: "ISBN_10", identifier: "8936434128" }, { type: "ISBN_13", identifier: "9788936434120" }],
      imageLinks: { thumbnail: "http://books.google.com/books/content?id=abc&printsec=frontcover&img=1&zoom=1&edge=curl&source=gbs_api" },
    } });
    expect(b).toEqual({
      title: "아몬드", author: "손원평", isbn13: "9788936434120", year: 2017, pages: 264,
      cover_url: "https://books.google.com/books/content?id=abc&printsec=frontcover&img=1&zoom=1&source=gbs_api&fife=w400-h600",
    });
    expect(fromVolume({ volumeInfo: { title: "No author" } })).toBeNull();
    expect(googleCover("https://evil.example.com/x.jpg")).toBeNull();
  });
});
