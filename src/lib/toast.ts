/**
 * Small bottom toasts, with an optional Undo. A "deferred" toast hides the
 * change right away but only commits it when the toast goes away, so Undo
 * never has to rebuild anything. Closing the app inside the window commits.
 */

export interface ToastItem {
  id: number;
  text: string;
  undo?: () => void;
}

type Listener = (t: ToastItem | null) => void;

const UNDO_MS = 5000;
const PLAIN_MS = 2600;

let current: ToastItem | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let pendingCommit: (() => Promise<void> | void) | null = null;
let nextId = 1;
const listeners = new Set<Listener>();

function emit() {
  for (const l of listeners) l(current);
}

export function subscribeToast(l: Listener): () => void {
  listeners.add(l);
  l(current);
  return () => listeners.delete(l);
}

/** Run any waiting deferred change now (another toast arrived, app hidden, …). */
export function flushToast() {
  const commit = pendingCommit;
  pendingCommit = null;
  if (commit) Promise.resolve(commit()).catch(() => {});
}

export function dismissToast() {
  if (timer) clearTimeout(timer);
  timer = null;
  flushToast();
  current = null;
  emit();
}

function show(item: Omit<ToastItem, "id">, ms: number) {
  if (timer) clearTimeout(timer);
  flushToast();
  current = { ...item, id: nextId++ };
  emit();
  timer = setTimeout(dismissToast, ms);
}

/** A plain message, e.g. "Link copied". */
export function toast(text: string) {
  show({ text }, PLAIN_MS);
}

/**
 * Hide something now, commit it in 5 seconds unless the reader taps Undo.
 * `commit` does the real delete; `restore` puts it back on screen.
 */
export function deferred(text: string, { commit, restore }: { commit: () => Promise<void> | void; restore: () => void }) {
  show(
    {
      text,
      undo: () => {
        pendingCommit = null;
        restore();
        if (timer) clearTimeout(timer);
        timer = null;
        current = null;
        emit();
      },
    },
    UNDO_MS,
  );
  pendingCommit = commit;
}

/* Shelf entries waiting to be removed: fetchShelf leaves them out. */
const removing = new Set<string>();
export const isRemoving = (entryId: string) => removing.has(entryId);
export const markRemoving = (entryId: string, on: boolean) => void (on ? removing.add(entryId) : removing.delete(entryId));
