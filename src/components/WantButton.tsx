"use client";

import { useState } from "react";
import { addToWant } from "@/lib/data";
import { BookmarkIcon } from "./icons";

/** Save a book to your want-to-read list in one tap, without leaving the page. */
export function WantButton({ bookId, compact = false, onSaved }: { bookId: string; compact?: boolean; onSaved?: () => void }) {
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  async function save() {
    if (state === "saving" || state === "saved") return;
    setState("saving");
    try {
      await addToWant(bookId);
      setState("saved");
      onSaved?.();
    } catch {
      setState("error");
    }
  }

  const label = state === "saved" ? "Saved" : state === "error" ? "Try again" : "Want to read";
  return (
    <button
      className="action-btn"
      onClick={save}
      disabled={state === "saving"}
      aria-pressed={state === "saved"}
      aria-label={compact ? (state === "saved" ? "Saved to want to read" : "Want to read") : undefined}
      style={state === "saved" ? { color: "var(--cobalt-ink)", background: "var(--cobalt-soft)" } : undefined}
    >
      <BookmarkIcon size={16} style={state === "saved" ? { fill: "currentColor" } : undefined} />
      {!compact && <span>{label}</span>}
    </button>
  );
}
