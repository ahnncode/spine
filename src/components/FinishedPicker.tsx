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

  // The real date field sits invisibly on top of the "Pick a date" chip, so a
  // tap lands on it and the phone opens its own calendar (iOS Safari ignores
  // opening it from code). Desktop Chrome only opens from its calendar icon,
  // so a click on the field also asks for the calendar where allowed.
  function openCalendar(e: React.MouseEvent<HTMLInputElement>) {
    const el = e.currentTarget;
    try {
      if (typeof el.showPicker === "function") el.showPicker();
    } catch {
      /* already open, or not allowed: the tap itself opens it */
    }
  }

  return (
    <div role="group" aria-label={label} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <span className="muted" style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>
      <div className="tag-list">
        <button type="button" className="tag-chip" aria-pressed={value === t} onClick={() => onChange(t)}>Today</button>
        <button type="button" className="tag-chip" aria-pressed={value === y} onClick={() => onChange(y)}>Yesterday</button>
        <span className="date-chip">
          <span className="tag-chip" aria-hidden="true" data-pressed={custom || undefined}>
            {custom ? formatDay(value) : "Pick a date"}
          </span>
          <input
            type="date"
            className="date-chip__input"
            aria-label={custom ? `Finished ${formatDay(value)}. Pick another date` : "Pick a date"}
            max={t}
            value={custom ? value : ""}
            onClick={openCalendar}
            onChange={(e) => e.target.value && onChange(e.target.value)}
          />
        </span>
        <button type="button" className="tag-chip" aria-pressed={value === null} onClick={() => onChange(null)}>Don&rsquo;t remember</button>
      </div>
    </div>
  );
}
