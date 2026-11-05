"use client";

import Link from "next/link";
import { useState } from "react";
import { addToWant, moveToWant, removeEntry, startReading, type Entry } from "@/lib/data";
import { deferred, markRemoving } from "@/lib/toast";
import { BookmarkIcon, BookOpenIcon } from "./icons";

/**
 * The actions for one book, depending on where it is on your shelf:
 * nothing → read it / reading now / want to read; want → start / rank;
 * reading → finished; ranked → re-rank.
 */
export function BookActions({
  bookId,
  entry,
  onChange,
  showRemove = true,
  onStartedReading,
}: {
  bookId: string;
  entry: Entry | null | undefined;
  onChange: () => void | Promise<void>;
  showRemove?: boolean;
  /** Right after "Reading it now": e.g. open the first check-in. */
  onStartedReading?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await onChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  const status = entry?.status;

  // Hide it now; the delete happens when the Undo toast goes away.
  function remove(e: Entry) {
    markRemoving(e.id, true);
    void onChange();
    deferred("Removed from your shelf", {
      commit: async () => {
        await removeEntry(e.id).catch(() => {});
        markRemoving(e.id, false);
        await onChange();
      },
      restore: () => {
        markRemoving(e.id, false);
        void onChange();
      },
    });
  }

  return (
    <div className="stack">
      {status === "reading" ? (
        <Link href={`/rank/${bookId}`} className="btn btn--block">Finished — rank it</Link>
      ) : (
        <Link href={`/rank/${bookId}`} className="btn btn--block">
          {status === "ranked" ? "Re-rank" : "I’ve read it — rank it"}
        </Link>
      )}

      {(!status || status === "want") && (
        <button className="btn btn--outline btn--block" disabled={busy} onClick={() => run(async () => { await startReading(bookId); onStartedReading?.(); })}>
          <BookOpenIcon size={18} /> Reading it now
        </button>
      )}
      {!status && (
        <button className="btn btn--quiet btn--block" disabled={busy} onClick={() => run(() => addToWant(bookId))}>
          <BookmarkIcon size={16} /> Want to read
        </button>
      )}
      {status === "reading" && entry && (
        <button className="btn btn--quiet btn--block" disabled={busy} onClick={() => run(() => moveToWant(entry.id))}>
          Not reading it after all
        </button>
      )}
      {showRemove && entry && (
        <button className="btn btn--ghost btn--block" disabled={busy} onClick={() => remove(entry)}>
          Remove from shelf
        </button>
      )}
      {error && <p className="error" role="alert">{error}</p>}
    </div>
  );
}
