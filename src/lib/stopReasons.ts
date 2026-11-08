/**
 * Why a book was put aside or dropped. Keys are stored, so keep them stable;
 * labels can change. Counted later for Wrapped ("your top reason").
 */
export interface StopReason {
  key: string;
  label: string;
}

export const PAUSE_REASONS: StopReason[] = [
  { key: "life_busy", label: "Life got busy" },
  { key: "not_in_mood", label: "Not in the mood" },
  { key: "loan_ended", label: "Library loan ran out" },
  { key: "other_first", label: "Reading something else first" },
  { key: "saving", label: "Saving it for later" },
];

export const DROP_REASONS: StopReason[] = [
  { key: "too_slow", label: "Too slow" },
  { key: "lost_interest", label: "Lost interest" },
  { key: "not_my_style", label: "Not my style" },
  { key: "writing", label: "Didn’t like the writing" },
  { key: "hype", label: "Didn’t live up to the hype" },
  { key: "not_now", label: "Not for me right now" },
  { key: "content", label: "Content I didn’t want" },
];

export const STOP_REASON_LABEL: Record<string, string> = Object.fromEntries(
  [...PAUSE_REASONS, ...DROP_REASONS].map((r) => [r.key, r.label]),
);

export const STOP_NOTE_MAX = 280;
