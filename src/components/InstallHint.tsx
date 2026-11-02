"use client";

import { useEffect, useState } from "react";
import { Mark } from "./Logo";
import { CloseIcon, ShareIcon } from "./icons";

const KEY = "spine:install-hint-dismissed";

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
}

type Kind = "ios" | "android";

/**
 * A one-time tip to add Spine to the home screen. iPhones never offer this on
 * their own (it's hidden in Safari's Share menu); Android Chrome has a real
 * install prompt we can trigger.
 */
export function InstallHint() {
  const [kind, setKind] = useState<Kind | null>(null);
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);

  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(KEY) === "1";
    } catch {}
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (dismissed || standalone) return;

    const ua = navigator.userAgent;
    const iosSafari = /iPhone|iPad|iPod/.test(ua) && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|Instagram|FBAN|FBAV|GSA/.test(ua);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reads the browser once on mount
    if (iosSafari) setKind("ios");

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallPromptEvent);
      setKind("android");
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(KEY, "1");
    } catch {}
    setKind(null);
  }

  async function install() {
    if (!prompt) return;
    await prompt.prompt().catch(() => {});
    dismiss();
  }

  if (!kind) return null;

  return (
    <div className="card" role="note" style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 14, padding: "12px 12px 12px 14px" }}>
      <Mark size={36} />
      <div style={{ flex: 1, fontSize: 14, lineHeight: 1.4 }}>
        <strong>Get Spine on your home screen.</strong>{" "}
        {kind === "ios" ? (
          <span className="muted">
            Tap <ShareIcon size={14} style={{ verticalAlign: "-2px" }} aria-label="Share" /> below, then &ldquo;Add to Home Screen.&rdquo;
          </span>
        ) : (
          <span className="muted">It opens full-screen, like an app.</span>
        )}
      </div>
      {kind === "android" && (
        <button className="small-btn" onClick={install}>Install</button>
      )}
      <button className="icon-btn" style={{ width: 36, height: 36, background: "transparent" }} aria-label="Dismiss" onClick={dismiss}>
        <CloseIcon size={16} />
      </button>
    </div>
  );
}
