"use client";

import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { rememberDestination } from "@/components/Auth";

/** Sign-up link that brings the visitor back to this page afterwards. */
export function JoinLink({ back, className = "btn btn--block", style, children }: { back: string; className?: string; style?: CSSProperties; children: ReactNode }) {
  return (
    <Link href="/login" className={className} style={style} onClick={() => rememberDestination(back)}>
      {children}
    </Link>
  );
}
