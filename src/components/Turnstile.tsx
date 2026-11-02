"use client";

import { useEffect, useRef } from "react";

/** Cloudflare Turnstile site key (public). When unset, bot checks are off. */
export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

export type TurnstileStatus =
  | { state: "loading" }
  | { state: "ready" }
  | { state: "error"; code: string }
  | { state: "blocked" };

interface TurnstileApi {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let loading: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = SCRIPT;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => {
        loading = null;
        reject(new Error("blocked"));
      };
      document.head.appendChild(s);
    });
  }
  return loading;
}

/**
 * Cloudflare's bot check. Usually invisible; it shows a checkbox only when
 * Cloudflare wants a human to tap it. Reports its state so the page can
 * explain a stuck or failed check instead of just greying out the button.
 */
export function Turnstile({
  onToken,
  onStatus,
  resetKey,
}: {
  onToken: (token: string | null) => void;
  onStatus?: (s: TurnstileStatus) => void;
  resetKey: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const idRef = useRef<string | null>(null);
  const cb = useRef({ onToken, onStatus });
  useEffect(() => {
    cb.current = { onToken, onStatus };
  });

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return;
    let cancelled = false;
    cb.current.onStatus?.({ state: "loading" });
    // A script that never arrives (blocked silently) shouldn't leave people waiting forever.
    const watchdog = setTimeout(() => {
      if (!window.turnstile && !cancelled) cb.current.onStatus?.({ state: "blocked" });
    }, 8000);
    loadScript()
      .then(() => {
        if (cancelled || !ref.current || !window.turnstile) return;
        idRef.current = window.turnstile.render(ref.current, {
          sitekey: TURNSTILE_SITE_KEY,
          appearance: "interaction-only",
          theme: "light",
          retry: "auto",
          "refresh-expired": "auto",
          callback: (t: string) => {
            cb.current.onToken(t);
            cb.current.onStatus?.({ state: "ready" });
          },
          "expired-callback": () => cb.current.onToken(null),
          "error-callback": (code: string | number) => {
            cb.current.onToken(null);
            cb.current.onStatus?.({ state: "error", code: String(code ?? "") });
            return true; // handled here; don't also throw
          },
        });
      })
      .catch(() => {
        if (!cancelled) cb.current.onStatus?.({ state: "blocked" });
      });
    return () => {
      cancelled = true;
      clearTimeout(watchdog);
      if (idRef.current && window.turnstile) window.turnstile.remove(idRef.current);
      idRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (resetKey && idRef.current && window.turnstile) {
      cb.current.onToken(null);
      cb.current.onStatus?.({ state: "loading" });
      window.turnstile.reset(idRef.current);
    }
  }, [resetKey]);

  if (!TURNSTILE_SITE_KEY) return null;
  return <div ref={ref} style={{ marginTop: 16 }} />;
}
