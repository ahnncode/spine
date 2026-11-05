"use client";

import { useEffect, useState } from "react";
import { dismissToast, flushToast, subscribeToast, type ToastItem } from "@/lib/toast";

/** The one toast slot, above the tab bar. Mounted once in the layout. */
export function Toaster() {
  const [t, setT] = useState<ToastItem | null>(null);
  useEffect(() => subscribeToast(setT), []);

  // Leaving the app inside an Undo window: do the change now.
  useEffect(() => {
    const onHide = () => document.visibilityState === "hidden" && flushToast();
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flushToast);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flushToast);
    };
  }, []);

  return (
    <div className="toast-slot" aria-live="polite">
      {t && (
        <div className="toast" key={t.id} role="status">
          <span className="toast__text">{t.text}</span>
          {t.undo ? (
            <button className="toast__undo" onClick={t.undo}>Undo</button>
          ) : (
            <button className="toast__close" aria-label="Dismiss" onClick={dismissToast}>×</button>
          )}
        </div>
      )}
    </div>
  );
}
