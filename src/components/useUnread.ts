"use client";

import { useEffect, useState } from "react";
import { supabase, supabaseConfigured } from "@/lib/supabase";
import { unreadCount } from "@/lib/data";

// Shared across every screen's tab bar so moving between tabs doesn't refetch.
let cached = { n: 0, at: 0 };
let inflight: Promise<number> | null = null;
const listeners = new Set<(n: number) => void>();
const FRESH_MS = 45_000;

function refresh(force = false): void {
  if (!force && Date.now() - cached.at < FRESH_MS) return;
  if (inflight) return;
  inflight = unreadCount()
    .catch(() => cached.n)
    .then((n) => {
      cached = { n, at: Date.now() };
      inflight = null;
      for (const l of listeners) l(n);
      return n;
    });
}

/** Call after reading notifications so the dot clears everywhere at once. */
export function clearUnread() {
  cached = { n: 0, at: Date.now() };
  for (const l of listeners) l(0);
}

/** Unread notifications count, for the dot on the Feed tab. */
export function useUnread(): number {
  const [n, setN] = useState(cached.n);
  useEffect(() => {
    if (!supabaseConfigured) return;
    listeners.add(setN);
    // Only when signed in (public pages also show no tab bar, but be safe).
    supabase().auth.getSession().then(({ data }) => data.session && refresh());
    const onFocus = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onFocus);
    const t = setInterval(() => document.visibilityState === "visible" && refresh(true), 90_000);
    return () => {
      listeners.delete(setN);
      document.removeEventListener("visibilitychange", onFocus);
      clearInterval(t);
    };
  }, []);
  return n;
}
