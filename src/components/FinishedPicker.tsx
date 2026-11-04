"use client";

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

  return (
    <div role="group" aria-label={label} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <span className="muted" style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>
      <div className="tag-list">
        <button type="button" className="tag-chip" aria-pressed={value === t} onClick={() => onChange(t)}>Today</button>
        <button type="button" className="tag-chip" aria-pressed={value === y} onClick={() => onChange(y)}>Yesterday</button>
        {/* A real date field laid over the chip, so tapping it opens the phone's own date picker. */}
        <label className="tag-chip" data-pressed={custom || undefined} style={{ position: "relative", display: "inline-flex", alignItems: "center", cursor: "pointer" }}>
          {custom ? formatDay(value) : "Pick a date"}
          <input
            type="date"
            aria-label="Pick the date you finished"
            max={t}
            value={custom ? value : ""}
            onChange={(e) => e.target.value && onChange(e.target.value)}
            style={{ position: "absolute", inset: 0, opacity: 0, width: "100%", height: "100%", cursor: "pointer" }}
          />
        </label>
        <button type="button" className="tag-chip" aria-pressed={value === null} onClick={() => onChange(null)}>Don&rsquo;t remember</button>
      </div>
    </div>
  );
}
