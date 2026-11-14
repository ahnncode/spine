/**
 * Saves made in this visit, shared by every Save button on screen. When the
 * same book shows up twice (say, two friends ranked it in the feed), saving
 * it on one card flips the other too.
 *
 * Only taps are kept here. A button with no entry falls back to what the page
 * loaded (its initialSaved).
 */
const saved = new Map<string, boolean>();
const listeners = new Set<() => void>();
let version = 0;

export function savedOverride(bookId: string): boolean | undefined {
  return saved.get(bookId);
}

export function setSaved(bookId: string, value: boolean): void {
  if (saved.get(bookId) === value) return;
  saved.set(bookId, value);
  version++;
  for (const l of listeners) l();
}

export function subscribeSaved(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Changes whenever any save changes (for useSyncExternalStore). */
export function savedVersion(): number {
  return version;
}
