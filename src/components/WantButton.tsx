"use client";

import { useState } from "react";
import { addToWant, removeFromWant } from "@/lib/data";
import { BookmarkIcon } from "./icons";

/** Save a book to your want-to-read list in one tap, without leaving the page. Tap again to take it back off. */
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
  const [state, setState] = useState<"idle" | "saved" | "error">(initialSaved ? "saved" : "idle");
  const [popped, setPopped] = useState(false);
  const [busy, setBusy] = useState(false);

  // Optimistic both ways: flips straight away, flips back if the change fails.
  async function toggle() {
    if (busy) return;
    setBusy(true);
    if (state === "saved") {
      setState("idle");
      setPopped(false);
      try {
        await removeFromWant(bookId);
      } catch {
        setState("saved");
      }
    } else {
      setState("saved");
      setPopped(true);
      try {
        await addToWant(bookId);
        onSaved?.();
      } catch {
        setState("error");
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
