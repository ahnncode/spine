import Link from "next/link";
import type { ReactNode } from "react";
import { JoinLink } from "@/components/JoinLink";
import { Logo } from "@/components/Logo";

/** Frame for pages people see without an account. */
export function PublicShell({ back, children, pitch }: { back: string; children: ReactNode; pitch: string }) {
  return (
    <div className="app">
      <main className="screen screen--flow">
        <div className="topbar">
          <Link href="/" aria-label="ReadRead home" style={{ textDecoration: "none", color: "inherit" }}><Logo size={28} /></Link>
          <JoinLink back={back} className="btn btn--quiet" style={{ minHeight: 40, fontSize: 14, padding: "0 14px" }}>Sign in</JoinLink>
        </div>
        {children}
        <section className="card card--ink" style={{ marginTop: 28 }}>
          <p className="eyebrow" style={{ color: "#c9c8c2" }}>ReadRead</p>
          <p className="d" style={{ margin: "6px 0 0", fontSize: 24, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.05 }}>Rank books, not stars.</p>
          <p style={{ margin: "8px 0 0", fontSize: 14, color: "#dddcd6", lineHeight: 1.45 }}>{pitch}</p>
          <JoinLink back={back} className="btn btn--block" style={{ marginTop: 14, background: "#fff", color: "var(--ink)" }}>Join ReadRead — it&rsquo;s free</JoinLink>
        </section>
        <p className="muted" style={{ textAlign: "center", fontSize: 12, margin: "20px 0 8px" }}>
          <Link href="/privacy">Privacy</Link> · <Link href="/terms">Terms</Link>
        </p>
      </main>
    </div>
  );
}
