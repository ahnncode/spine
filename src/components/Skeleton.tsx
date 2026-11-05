/**
 * Grey outlines of what's about to load, so screens don't sit blank or jump
 * when data arrives. Purely visual: screen readers get one "Loading" label.
 */

function Bone({ w, h, r = 6, style }: { w: number | string; h: number; r?: number; style?: React.CSSProperties }) {
  return <span className="skeleton" style={{ display: "block", width: w, height: h, borderRadius: r, ...style }} />;
}

function Wrap({ children, label = "Loading", style }: { children: React.ReactNode; label?: string; style?: React.CSSProperties }) {
  return (
    <div aria-busy="true" aria-label={label} role="status" style={style}>
      <div aria-hidden="true">{children}</div>
    </div>
  );
}

/** Feed posts: avatar, name line, a book row. */
export function FeedSkeleton({ count = 3 }: { count?: number }) {
  return (
    <Wrap label="Loading feed" style={{ marginTop: 16 }}>
      <div className="stack">
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className="card skeleton-card" style={{ animationDelay: `${i * 0.08}s` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Bone w={36} h={36} r={18} />
              <div style={{ flex: 1 }}>
                <Bone w={`${55 - i * 8}%`} h={13} />
                <Bone w="30%" h={11} style={{ marginTop: 8 }} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 14, marginTop: 16 }}>
              <Bone w={64} h={96} r={4} />
              <div style={{ flex: 1, paddingTop: 4 }}>
                <Bone w="80%" h={16} />
                <Bone w="45%" h={12} style={{ marginTop: 8 }} />
                <Bone w={52} h={28} r={14} style={{ marginTop: 16 }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </Wrap>
  );
}

/** Rows with a small cover (shelf, search) or avatar (people, notifications). */
export function RowsSkeleton({ count = 5, avatar = false, label }: { count?: number; avatar?: boolean; label?: string }) {
  return (
    <Wrap label={label} style={{ marginTop: 8 }}>
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {Array.from({ length: count }, (_, i) => (
          <li key={i} className="book-row skeleton-row" style={{ animationDelay: `${i * 0.06}s` }}>
            {avatar ? <Bone w={40} h={40} r={20} /> : <Bone w={44} h={66} r={4} />}
            <div style={{ flex: 1, minWidth: 0 }}>
              <Bone w={`${72 - (i % 3) * 12}%`} h={14} />
              <Bone w="38%" h={12} style={{ marginTop: 8 }} />
            </div>
          </li>
        ))}
      </ul>
    </Wrap>
  );
}

/** Someone's profile header and shelf. */
export function ProfileSkeleton() {
  return (
    <Wrap label="Loading profile" style={{ marginTop: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <Bone w={64} h={64} r={32} />
        <div style={{ flex: 1 }}>
          <Bone w="50%" h={24} />
          <Bone w="70%" h={12} style={{ marginTop: 8 }} />
        </div>
        <Bone w={84} h={40} r={12} />
      </div>
      <Bone w="100%" h={56} r={14} style={{ marginTop: 20 }} />
      <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
        {[0, 1, 2, 3].map((i) => <Bone key={i} w={72} h={108} r={4} />)}
      </div>
      <RowsSkeleton count={3} />
    </Wrap>
  );
}

/** Book page text under the cover. */
export function BookSkeleton() {
  return (
    <Wrap label="Loading book" style={{ padding: "18px 20px 0" }}>
      <Bone w="75%" h={30} />
      <Bone w="45%" h={14} style={{ marginTop: 12 }} />
      <div style={{ display: "flex", gap: 6, marginTop: 16 }}>
        <Bone w={70} h={26} r={13} /><Bone w={90} h={26} r={13} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 20 }}>
        <Bone w="100%" h={48} r={14} /><Bone w="100%" h={48} r={14} />
      </div>
      <Bone w="100%" h={12} style={{ marginTop: 24 }} />
      <Bone w="94%" h={12} style={{ marginTop: 8 }} />
      <Bone w="60%" h={12} style={{ marginTop: 8 }} />
    </Wrap>
  );
}

/** Generic card block (read-along, etc.). */
export function CardSkeleton({ height = 180 }: { height?: number }) {
  return (
    <Wrap style={{ marginTop: 16 }}>
      <Bone w="60%" h={26} />
      <Bone w="100%" h={height} r={18} style={{ marginTop: 16 }} />
    </Wrap>
  );
}
