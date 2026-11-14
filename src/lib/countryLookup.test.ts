import { describe, expect, it } from "vitest";
import { pickCountries } from "./countryLookup";

const row = (olid: string, iso?: string, rank?: string, lang?: string) => ({
  olid: { value: olid },
  ...(iso ? { iso: { value: iso } } : {}),
  ...(rank ? { rank: { value: `http://wikiba.se/ontology#${rank}` } } : {}),
  ...(lang ? { lang: { value: lang } } : {}),
});

describe("pickCountries", () => {
  it("takes the preferred citizenship, then the first", () => {
    const m = pickCountries([row("OL1A", "US", "NormalRank"), row("OL1A", "KR", "PreferredRank"), row("OL2A", "NG", "NormalRank"), row("OL2A", "GB", "NormalRank")]);
    expect(m.get("OL1A")?.country).toBe("KR");
    expect(m.get("OL2A")?.country).toBe("NG");
  });
  it("calls it translated only when we know the author's languages", () => {
    const m = pickCountries([row("OL1A", "KR", "NormalRank", "ko"), row("OL2A", "NG", "NormalRank", "en"), row("OL2A", "NG", "NormalRank", "ig"), row("OL3A", "JP")]);
    expect(m.get("OL1A")?.translated).toBe(true);
    expect(m.get("OL2A")?.translated).toBe(false);
    expect(m.get("OL3A")?.translated).toBeNull();
  });
  it("ignores codes that aren't two letters (old countries have none)", () => {
    expect(pickCountries([row("OL1A")]).get("OL1A")?.country).toBeNull();
  });
});
