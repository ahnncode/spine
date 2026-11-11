import { afterEach, describe, expect, it, vi } from "vitest";
import { searchBooks } from "./openlibrary";

const olDoc = {
  key: "/works/OL1W", title: "아몬드", author_name: ["Wŏn-p'yŏng Son"], author_alternative_name: ["손원평", "Son, Wŏn-p'yŏng"],
  first_publish_year: 2017, cover_i: 123, readinglog_count: 3, edition_count: 4,
  editions: { docs: [{ title: "아몬드", language: ["kor"], cover_i: 123 }] },
};
const loose = { key: "/works/OL2W", title: "A Gentleman in Moscow", author_name: ["Amor Towles"], readinglog_count: 9000, edition_count: 80 };
const google = { items: [
  { volumeInfo: { title: "아몬드", authors: ["손원평"], publishedDate: "2017-03-31", imageLinks: { thumbnail: "http://books.google.com/books/content?id=a1&printsec=frontcover&img=1&zoom=1&edge=curl&source=gbs_api" } } },
  { volumeInfo: { title: "아몬드 (리커버 특별판)", authors: ["손원평 (지은이)"], publishedDate: "2023-01-01" } },
  { volumeInfo: { title: "서른의 반격", authors: ["손원평"], publishedDate: "2017-08-01" } },
  { volumeInfo: { title: "아몬드 쿠키 레시피", authors: ["김요리"], publishedDate: "2019-01-01" } },
] };

afterEach(() => vi.unstubAllGlobals());

describe("searching in Korean", () => {
  it("lists Google's Korean books with Korean authors, and drops loose English matches", async () => {
    const urls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      urls.push(url);
      const body = url.includes("googleapis") ? google : url.includes("openlibrary") ? { docs: [olDoc, loose] } : { results: [] };
      return new Response(JSON.stringify(body), { status: 200 });
    }));
    const books = await searchBooks("아몬드");
    expect(urls.some((u) => u.includes("googleapis.com/books/v1/volumes") && u.includes("langRestrict=ko"))).toBe(true);
    expect(urls.some((u) => u.includes("itunes.apple.com"))).toBe(false);
    expect(books.map((b) => `${b.title} · ${b.author}`)).toEqual([
      "아몬드 · 손원평",
      "아몬드 쿠키 레시피 · 김요리",
    ]);
    // The top result keeps a cover from one source or the other.
    expect(books[0].cover_id ?? books[0].cover_url).toBeTruthy();
  });

  it("uses Open Library's Korean spelling of the author when Google has nothing", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => new Response(JSON.stringify(url.includes("openlibrary") ? { docs: [olDoc] } : { items: [] }), { status: 200 })));
    const books = await searchBooks("아몬드!");
    expect(books.map((b) => `${b.title} · ${b.author}`)).toEqual(["아몬드 · 손원평"]);
  });

  it("takes the Korean author from Google when Open Library only has the romanized one, and drops unrelated books", async () => {
    const romanOnly = { ...olDoc, key: "/works/OL9W", author_alternative_name: ["Son, Wŏn-p'yŏng"] };
    const g = { items: [
      { volumeInfo: { title: "아몬드", authors: ["손원평"], publishedDate: "2017-03-31" } },
      { volumeInfo: { title: "존 톨랜드 의 6.25 전쟁", authors: ["존톨랜드"], publishedDate: "2010-01-01" } },
      { volumeInfo: { title: "손원평의 아몬드를 읽고", authors: ["윤지한"], publishedDate: "2025-01-01" } },
    ] };
    vi.stubGlobal("fetch", vi.fn(async (url: string) => new Response(JSON.stringify(url.includes("openlibrary") ? { docs: [romanOnly] } : g), { status: 200 })));
    const books = await searchBooks("아몬드?");
    expect(books.map((b) => `${b.title} · ${b.author}`)).toEqual(["아몬드 · 손원평", "손원평의 아몬드를 읽고 · 윤지한"]);
  });

  it("finds an author's books by their Korean name", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => new Response(JSON.stringify(url.includes("openlibrary") ? { docs: [] } : google), { status: 200 })));
    const books = await searchBooks("손원평");
    expect(books.map((b) => b.title)).toEqual(expect.arrayContaining(["아몬드", "서른의 반격"]));
    expect(books.map((b) => b.title)).not.toContain("아몬드 쿠키 레시피");
  });
});
