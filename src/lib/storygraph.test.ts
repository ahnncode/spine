import Papa from "papaparse";
import { describe, expect, it } from "vitest";
import { startingOrder } from "./goodreads";
import { isbn13, looksLikeStoryGraph, parseStoryGraph } from "./storygraph";

// Header and a few rows in StoryGraph's real export format.
const CSV = `Title,Authors,Contributors,ISBN/UID,Format,Read Status,Date Added,Last Date Read,Dates Read,Read Count,Moods,Pace,Character- or Plot-Driven?,Strong Character Development?,Loveable Characters?,Diverse Characters?,Flawed Characters?,Star Rating,Review,Content Warnings,Content Warning Description,Tags,Owned?
The Stationery Shop,Marjan Kamali,"",9781982107482,hardcover,read,2022/04/15,2022/05/04,2022/05/04,1,"",,,,,,,4.0,,"",,"",No
Queen of Thieves,Beezy Marsh,"",9780063234840,paperback,read,2023/02/05,2023/02/22,2023/02/22,1,"",,,,,,,3.0,,"",,"",No
The Wind-Up Bird Chronicle,Haruki Murakami,"Jay Rubin (Translator)",9780965341981,paperback,did-not-finish,2021/09/06,"","",0,"",,,,,,,,"<div>Hated it&nbsp;</div>","","","",No
Ariadne,Jennifer Saint,"",9781250773586,hardcover,to-read,2021/06/25,"","",0,"",,,,,,,,,"",,"",No
The Assassin's Blade,Sarah J. Maas,Elizabeth Evans (Narrator),9781547608782,audio,read,2025/07/25,2025/08/01,2025/07/25-2025/08/01,1,"",,,,,,,,,"",,"",No
She Gets the Girl,"Rachael Lippincott, Alyson Derrick","",9781534493797,hardcover,currently-reading,2022/04/15,"","",0,"",,,,,,,4.75,,"",,"",No
Top Pick,A Writer,"",0451526538,hardcover,read,2022/04/15,2024/01/02,2024/01/02,1,"",,,,,,,4.75,,"",,"",No
`;

describe("StoryGraph import", () => {
  const parsed = Papa.parse<Record<string, string>>(CSV, { header: true, skipEmptyLines: true });

  it("recognizes the file", () => {
    expect(looksLikeStoryGraph(parsed.meta.fields ?? [])).toBe(true);
  });

  it("maps shelves, quarter stars, dates and reviews", () => {
    const s = parseStoryGraph(parsed.data);
    const by = Object.fromEntries(s.books.map((b) => [b.book.title, b]));
    expect(by["The Stationery Shop"]).toMatchObject({ status: "ranked", bucket: "loved", stars: 4, finishedOn: "2022-05-04", source: "storygraph" });
    expect(by["Queen of Thieves"]).toMatchObject({ status: "ranked", bucket: "fine" });
    expect(by["The Wind-Up Bird Chronicle"]).toMatchObject({ status: "dropped", bucket: null, review: "Hated it" });
    expect(by["Ariadne"].status).toBe("want");
    expect(by["The Assassin's Blade"]).toMatchObject({ status: "unsorted", finishedOn: "2025-08-01" });
    expect(by["She Gets the Girl"]).toMatchObject({ status: "reading", book: { author: "Rachael Lippincott" } });
    expect(by["Top Pick"].book.isbn13).toBe("9780451526533");
    // Quarter stars order the loved tier: 4.75 above 4.0.
    expect(startingOrder(s.books).loved.map((b) => b.book.title)).toEqual(["Top Pick", "The Stationery Shop"]);
  });

  it("converts ISBN-10s", () => {
    expect(isbn13("0451526538")).toBe("9780451526533");
    expect(isbn13("sg-123")).toBeNull();
  });
});
