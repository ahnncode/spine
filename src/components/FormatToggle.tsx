"use client";

import type { Format } from "@/lib/data";

function BookGlyph() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z" /><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5" />
    </svg>
  );
}

export function HeadphonesGlyph({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 15v-3a8 8 0 0 1 16 0v3" />
      <rect x="3" y="14" width="4.5" height="7" rx="1.8" /><rect x="16.5" y="14" width="4.5" height="7" rx="1.8" />
    </svg>
  );
}

const OPTIONS: Array<{ v: Format; label: string; icon: React.ReactNode }> = [
  { v: "read", label: "Read", icon: <BookGlyph /> },
  { v: "listen", label: "Listened", icon: <HeadphonesGlyph /> },
  { v: "both", label: "Both", icon: <><BookGlyph /><HeadphonesGlyph /></> },
];

/** Read it, listened to it, or both. One tap; ranking doesn't care. */
export function FormatToggle({ value, onChange, label = "How you took it in" }: { value: Format; onChange: (v: Format) => void; label?: string }) {
  return (
    <div role="group" aria-label={label} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <span className="muted" style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>
      <div className="tag-list">
        {OPTIONS.map((o) => (
          <button key={o.v} type="button" className="tag-chip format-chip" aria-pressed={value === o.v} onClick={() => onChange(o.v)}>
            <span className="format-chip__icon">{o.icon}</span>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
