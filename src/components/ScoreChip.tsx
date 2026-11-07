import { formatScore, scoreTier, type Bucket } from "@/lib/ranking";

const TIER_WORD = { top: "loved", ink: "loved", fine: "it was fine", low: "not for me" } as const;

export function ScoreChip({ score, bucket, size = 44 }: { score: number; bucket: Bucket; size?: number }) {
  const tier = scoreTier(score, bucket);
  const cls = tier === "ink" ? "score" : `score score--${tier}`;
  return (
    <span
      className={cls}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.32) }}
      aria-label={`Score ${formatScore(score)}, ${TIER_WORD[tier]}`}
    >
      {formatScore(score)}
    </span>
  );
}
