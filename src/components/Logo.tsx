import { MarkSvg, type MarkTone } from "@/lib/logoMark";

/** The double-r mark: read · read. */
export function Mark({ size = 28, tone = "tangerine" }: { size?: number; tone?: MarkTone }) {
  return <MarkSvg size={size} tone={tone} />;
}

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: size * 0.3 }}>
      <Mark size={size} />
      <span className="wordmark" style={{ fontSize: size }}>readread</span>
    </span>
  );
}
