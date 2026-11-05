"use client";

import { useRef } from "react";
import { today } from "@/lib/data";

function formatDay(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", ...(sameYear ? {} : { year: "numeric" }) });
}

/**
 * When a book was finished, in one tap: today, yesterday, any date, or
 * "don't remember" (for books read long ago, which then stay out of this
 * year's stats and Wrapped).
 */
export function FinishedPicker({
  value,
  onChange,
  label = "Finished",
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  label?: string;
}) {
  const t = today();
  const y = today(1);
  const custom = value !== null && value !== t && value !== y;
  const dateRef = useRef<HTMLInputElement>(null);

  // Open the phone's or browser's own calendar. Desktop Chrome only opens it
  // from its small calendar icon, so ask for it directly where we can.
  function openCalendar() {
    const el = dateRef.current;
    if (!el) return;
    try {
      if (typeof el.showPicker === "function") return el.showPicker();
    } catch {
      /* not allowed here: fall back below */
    }
    el.focus();
    el.click();
  }

  return (
    <div role="group" aria-label={label} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <span className="muted" style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>
      <div className="tag-list">
        <button type="button" className="tag-chip" aria-pressed={value === t} onClick={() => onChange(t)}>Today</button>
        <button type="button" className="tag-chip" aria-pressed={value === y} onClick={() => onChange(y)}>Yesterday</button>
        <span style={{ position: "relative", display: "inline-flex" }}>
          <button type="button" className="tag-chip" aria-pressed={custom} onClick={openCalendar}>
            {custom ? formatDay(value) : "Pick a date"}
          </button>
          <input
            ref={dateRef}
            type="date"
            tabIndex={-1}
            aria-hidden="true"
            max={t}
            value={custom ? value : ""}
            onChange={(e) => e.target.value && onChange(e.target.value)}
            style={{ position: "absolute", left: 0, bottom: 0, width: 1, height: 1, opacity: 0, pointerEvents: "none", border: 0, padding: 0 }}
          />
        </span>
        <button type="button" className="tag-chip" aria-pressed={value === null} onClick={() => onChange(null)}>Don&rsquo;t remember</button>
      </div>
    </div>
  );
}
