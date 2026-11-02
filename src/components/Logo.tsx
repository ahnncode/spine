/** The ranked-stack mark: three spines, best on top. */
export function Mark({ size = 28 }: { size?: number }) {
  const bar = (w: string, bg: string) => (
    <span style={{ display: "block", height: size * 0.15, width: w, borderRadius: size * 0.04, background: bg }} />
  );
  return (
    <span
      aria-hidden="true"
      style={{
        width: size, height: size, borderRadius: size * 0.23, background: "var(--ink)", flexShrink: 0,
        display: "inline-flex", flexDirection: "column", justifyContent: "center", gap: size * 0.07,
        padding: `0 ${size * 0.2}px`, boxSizing: "border-box",
      }}
    >
      {bar("100%", "var(--accent)")}
      {bar("80%", "#fff")}
      {bar("60%", "rgba(255,255,255,0.55)")}
    </span>
  );
}

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: size * 0.3 }}>
      <Mark size={size} />
      <span className="wordmark" style={{ fontSize: size }}>spine</span>
    </span>
  );
}
