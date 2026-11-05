"use client";

import { useMemo } from "react";

const COLORS = ["var(--accent)", "var(--cobalt)", "var(--amber)", "#2d6a3e", "#ff9ec4"];

/**
 * A one-off confetti pop from the middle of its parent (which should be
 * position: relative). Pure CSS; skipped for reduced motion.
 */
export function Burst({ pieces = 22, spread = 150, delay = 0 }: { pieces?: number; spread?: number; delay?: number }) {
  const bits = useMemo(
    () =>
      Array.from({ length: pieces }, (_, i) => {
        const angle = (i / pieces) * Math.PI * 2 + (((i * 7919) % 100) / 100 - 0.5) * 0.6;
        const dist = spread * (0.55 + (((i * 104729) % 100) / 100) * 0.45);
        return {
          x: Math.round(Math.cos(angle) * dist),
          y: Math.round(Math.sin(angle) * dist * 0.8 - 30),
          r: ((i * 37) % 360) - 180,
          c: COLORS[i % COLORS.length],
          w: i % 3 === 0 ? 6 : 8,
          round: i % 4 === 0,
        };
      }),
    [pieces, spread],
  );
  return (
    <span className="burst" aria-hidden="true">
      {bits.map((b, i) => (
        <i
          key={i}
          style={{
            background: b.c,
            width: b.w,
            height: b.round ? b.w : b.w * 1.6,
            borderRadius: b.round ? "50%" : 2,
            animationDelay: `${delay}s`,
            ["--x" as string]: `${b.x}px`,
            ["--y" as string]: `${b.y}px`,
            ["--r" as string]: `${b.r}deg`,
          }}
        />
      ))}
    </span>
  );
}

/** A tiny tap of the phone (Android; iOS ignores it). */
export function buzz(ms = 12) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* not supported */
  }
}
