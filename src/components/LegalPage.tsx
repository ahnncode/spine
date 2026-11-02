import Link from "next/link";
import type { ReactNode } from "react";
import { LEGAL } from "@/lib/legal";
import { Logo } from "./Logo";

/** Shared layout for the privacy policy and terms: readable, plain, and linkable by section. */
export function LegalPage({ title, intro, children }: { title: string; intro: string; children: ReactNode }) {
  return (
    <div className="app">
      <main className="screen screen--flow legal">
        <Link href="/" aria-label="Spine home" style={{ textDecoration: "none" }}>
          <Logo size={26} />
        </Link>
        <h1 className="h1" style={{ marginTop: 28 }}>{title}</h1>
        <p className="muted" style={{ margin: "6px 0 0", fontSize: 14 }}>Effective {LEGAL.effectiveDate}</p>
        <p className="lede">{intro}</p>
        {children}
        <hr style={{ border: 0, borderTop: "1px solid var(--line)", margin: "32px 0 16px" }} />
        <p className="muted" style={{ fontSize: 14, margin: 0 }}>
          <Link href="/privacy">Privacy</Link> · <Link href="/terms">Terms</Link> · Questions: <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a>
        </p>
      </main>
    </div>
  );
}
