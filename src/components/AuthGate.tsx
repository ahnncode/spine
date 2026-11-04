"use client";

import type { ReactNode } from "react";
import { useAuth } from "@/components/Auth";

/**
 * Shows the public version of a page to visitors without an account (and to
 * search engines, which get it in the HTML), and the full app to readers.
 * Signed-in readers switch over as soon as their session is read.
 */
export function AuthGate({ publicView, children }: { publicView: ReactNode; children: ReactNode }) {
  const { session } = useAuth();
  return <>{session ? children : publicView}</>;
}
