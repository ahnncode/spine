import { describe, expect, it, vi } from "vitest";
import { savedOverride, savedVersion, setSaved, subscribeSaved } from "./saved";

describe("shared saves", () => {
  it("has no say until a book is tapped", () => {
    expect(savedOverride("untouched")).toBeUndefined();
  });

  it("tells every listener when a book is saved or unsaved", () => {
    const a = vi.fn();
    const b = vi.fn();
    const offA = subscribeSaved(a);
    const offB = subscribeSaved(b);
    const before = savedVersion();

    setSaved("book-1", true);
    expect(savedOverride("book-1")).toBe(true);
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
    expect(savedVersion()).toBe(before + 1);

    setSaved("book-1", false);
    expect(savedOverride("book-1")).toBe(false);
    expect(a).toHaveBeenCalledTimes(2);

    offA();
    offB();
  });

  it("stays quiet when nothing changes", () => {
    setSaved("book-2", true);
    const l = vi.fn();
    const off = subscribeSaved(l);
    setSaved("book-2", true);
    expect(l).not.toHaveBeenCalled();
    off();
  });
});
