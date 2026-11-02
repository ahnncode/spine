import { formatScore, scoreTier, type Bucket } from "@/lib/ranking";

export function ScoreChip({ score, bucket, size = 44 }: { score: number; bucket: Bucket; size?: number }) {
  const tier = scoreTier(score, bucket);
  const cls = tier === "ink" ? "score" : `score score--${tier}`;
  return (
    <span
      className={cls}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.32) }}
      aria-label={`Score ${formatScore(score)}`}
    >
      {formatScore(score)}
    </span>
  );
}
