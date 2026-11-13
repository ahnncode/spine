"use client";

import { BUCKETS, bucketForScore, formatScore } from "@/lib/ranking";
import { ScoreChip } from "./ScoreChip";

/** Pick a score out of 10: a big number, a slider, and nudge buttons for tenths. */
export function ScorePad({ value, onChange, id = "score-pad" }: { value: number; onChange: (v: number) => void; id?: string }) {
  const bucket = bucketForScore(value);
  const set = (v: number) => onChange(Math.round(Math.max(0, Math.min(10, v)) * 10) / 10);
  return (
    <div className="score-pad">
      <div className="score-pad__top">
        <ScoreChip score={value} bucket={bucket} size={72} />
        <div>
          <div className="score-pad__tier">
            <span className="bucket-dot" style={{ background: BUCKETS[bucket].color }} />
            {BUCKETS[bucket].label}
          </div>
          <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>{BUCKETS[bucket].rangeLabel}</div>
        </div>
      </div>
      <label htmlFor={id} className="visually-hidden">Score out of 10</label>
      <input
        id={id}
        className="score-pad__slider"
        type="range"
        min={0}
        max={10}
        step={0.1}
        value={value}
        onChange={(e) => set(Number(e.target.value))}
        aria-valuetext={formatScore(value)}
      />
      <div className="score-pad__nudge">
        <button type="button" className="icon-btn" aria-label="A tenth lower" onClick={() => set(value - 0.1)}>−</button>
        <span className="muted" style={{ fontSize: 13 }}>Drag, or nudge by a tenth</span>
        <button type="button" className="icon-btn" aria-label="A tenth higher" onClick={() => set(value + 0.1)}>+</button>
      </div>
    </div>
  );
}
