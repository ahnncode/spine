"use client";

import { useState } from "react";
import { addToWant } from "@/lib/data";
import { BookmarkIcon } from "./icons";

/** Save a book to your want-to-read list in one tap, without leaving the page. */
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

  // Optimistic: shows "Saved" straight away, flips back if the save fails.
  async function save() {
    if (state === "saved") return;
    setState("saved");
    setPopped(true);
    try {
      await addToWant(bookId);
      onSaved?.();
    } catch {
      setState("error");
    }
  }

  const label = state === "saved" ? "Saved" : state === "error" ? "Try again" : "Save";
  return (
    <button
      className="action-btn" data-pop={popped && state === "saved" ? "on" : undefined}
      onClick={save}
      aria-pressed={state === "saved"}
      aria-label={state === "saved" ? "Saved to want to read" : "Save to want to read"}
      style={state === "saved" ? { color: "var(--cobalt-ink)", background: "var(--cobalt-soft)" } : undefined}
    >
      <BookmarkIcon size={16} style={state === "saved" ? { fill: "currentColor" } : undefined} />
      {!compact && <span>{label}</span>}
    </button>
  );
}
