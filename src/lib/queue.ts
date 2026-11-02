/**
 * A short list of books to rank one after another (from onboarding), kept for
 * this browser tab only.
 */
const KEY = "spine:rank-queue";

export function setQueue(ids: string[]): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(ids));
  } catch {}
}

export function getQueue(): string[] {
  try {
    const v = JSON.parse(sessionStorage.getItem(KEY) || "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/** Drop a book (once ranked) and return what's left. */
export function shiftQueue(done: string): string[] {
  const rest = getQueue().filter((id) => id !== done);
  setQueue(rest);
  return rest;
}

export function clearQueue(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {}
}
