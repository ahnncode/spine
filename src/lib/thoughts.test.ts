import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ALL_TAG_KEYS, tagsFor } from "./thoughts";

describe("quick tags", () => {
  it("every tag key is allowed by the latest database check", () => {
    const dir = join(process.cwd(), "supabase/migrations");
    const latest = readdirSync(dir).filter((f) => f.includes("tags")).sort().pop()!;
    const sql = readFileSync(join(dir, latest), "utf8");
    for (const k of ALL_TAG_KEYS) expect(sql, k).toContain(`'${k}'`);
  });

  it("uses the first genre that has its own tags", () => {
    expect(tagsFor(["poetry", "fantasy"]).genre).toBe("poetry");
    expect(tagsFor(["nonsense", "romance"]).genreTags.map((t) => t.key)).toContain("slow_burn");
    expect(tagsFor(null).genreTags).toEqual([]);
  });
});
