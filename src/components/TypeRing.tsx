"use client";

import type { ReactNode } from "react";
import { TYPE_COLOR, TYPES } from "@/lib/readerTypeCopy";
import { useReaderType } from "./useReaderTypes";

/**
 * A thin ring in the reader's type colour around their avatar. Drawn with a
 * box-shadow so nothing shifts when it arrives; nothing at all when there's
 * no saved type.
 */
export function TypeRing({ userId, size, children }: { userId: string | null | undefined; size: number; children: ReactNode }) {
  const t = useReaderType(userId);
  const color = t ? TYPE_COLOR[t.code]?.bg : null;
  if (!color || size < 22) return <>{children}</>;
  const gap = size >= 56 ? 3 : 2;
  const ring = size >= 56 ? 3 : 2;
  return (
    <span
      className="type-ring"
      title={TYPES[t!.code]?.name}
      style={{ boxShadow: `0 0 0 ${gap}px var(--ground), 0 0 0 ${gap + ring}px ${color}` }}
    >
      {children}
    </span>
  );
}
