import { afterEach, describe, expect, it, vi } from "vitest";
import { deferred, dismissToast, flushToast, subscribeToast, toast, type ToastItem } from "./toast";

describe("undo toasts", () => {
  afterEach(() => {
    dismissToast();
    vi.useRealTimers();
  });

  it("commits a deferred change only after the toast times out", () => {
    vi.useFakeTimers();
    const commit = vi.fn();
    deferred("Removed", { commit, restore: vi.fn() });
    vi.advanceTimersByTime(4900);
    expect(commit).not.toHaveBeenCalled();
    vi.advanceTimersByTime(200);
    expect(commit).toHaveBeenCalledOnce();
  });

  it("Undo restores and never commits", () => {
    vi.useFakeTimers();
    const commit = vi.fn();
    const restore = vi.fn();
    let shown: ToastItem | null = null;
    const off = subscribeToast((t) => (shown = t));
    deferred("Removed", { commit, restore });
    (shown as ToastItem | null)?.undo?.();
    vi.advanceTimersByTime(10_000);
    expect(restore).toHaveBeenCalledOnce();
    expect(commit).not.toHaveBeenCalled();
    expect(shown).toBeNull();
    off();
  });

  it("a new toast commits the waiting one first", () => {
    const first = vi.fn();
    deferred("One", { commit: first, restore: vi.fn() });
    toast("Two");
    expect(first).toHaveBeenCalledOnce();
  });

  it("flushing (app hidden) commits once", () => {
    const commit = vi.fn();
    deferred("Removed", { commit, restore: vi.fn() });
    flushToast();
    flushToast();
    dismissToast();
    expect(commit).toHaveBeenCalledOnce();
  });
});
