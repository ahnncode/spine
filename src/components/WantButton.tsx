"use client";

import { useState, useSyncExternalStore } from "react";
import { addToWant, removeFromWant } from "@/lib/data";
import { savedOverride, savedVersion, setSaved, subscribeSaved } from "@/lib/saved";
import { BookmarkIcon } from "./icons";

/**
 * Save a book to your want-to-read list in one tap, without leaving the page.
 * Tap again to take it back off. Every Save button for the same book stays in
 * step (see lib/saved.ts), so a book that appears twice in the feed flips on
 * both cards.
 */
export function WantButton({
  bookId,
  compact = false,
  initialSaved = false,
  onSaved,
}: {
  bookId: string;
  compact?: boolean;
  /** Already on your want-to-read list. */
  initialSaved?: boolean;
  onSaved?: () => void;
}) {
  useSyncExternalStore(subscribeSaved, savedVersion, savedVersion);
  const isSaved = savedOverride(bookId) ?? initialSaved;
  const [failed, setFailed] = useState(false);
  const [popped, setPopped] = useState(false);
  const [busy, setBusy] = useState(false);
  const state: "idle" | "saved" | "error" = failed ? "error" : isSaved ? "saved" : "idle";

  // Optimistic both ways: flips straight away (on every card for this book),
  // flips back if the change fails.
  async function toggle() {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    if (isSaved) {
      setSaved(bookId, false);
      setPopped(false);
      try {
        await removeFromWant(bookId);
      } catch {
        setSaved(bookId, true);
      }
    } else {
      setSaved(bookId, true);
      setPopped(true);
      try {
        await addToWant(bookId);
        onSaved?.();
      } catch {
        setSaved(bookId, false);
        setFailed(true);
      }
    }
    setBusy(false);
  }

  const label = state === "saved" ? "Saved" : state === "error" ? "Try again" : "Save";
  return (
    <button
      className="action-btn" data-pop={popped && state === "saved" ? "on" : undefined}
      onClick={toggle}
      aria-pressed={state === "saved"}
      aria-label={state === "saved" ? "Saved to want to read. Tap to remove" : "Save to want to read"}
      style={state === "saved" ? { color: "var(--cobalt-ink)", background: "var(--cobalt-soft)" } : undefined}
    >
      <BookmarkIcon size={16} style={state === "saved" ? { fill: "currentColor" } : undefined} />
      {!compact && <span>{label}</span>}
    </button>
  );
}
