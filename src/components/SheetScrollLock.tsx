"use client";

import { useEffect } from "react";

/**
 * While a bottom sheet is open and on screen, the page behind it stays put:
 * dragging the sheet or the dimmed backdrop never scrolls the screen
 * underneath. Screens kept alive in the background (hidden with
 * display: none) can still hold an open sheet, so only visible ones count.
 */
export function SheetScrollLock() {
  useEffect(() => {
    const root = document.documentElement;
    let frame = 0;
    const check = () => {
      frame = 0;
      const open = [...document.querySelectorAll(".sheet-backdrop")].some((el) => el.getClientRects().length > 0);
      root.classList.toggle("sheet-open", open);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(check);
    };
    const mo = new MutationObserver(schedule);
    mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["style", "hidden"] });
    check();
    return () => {
      mo.disconnect();
      if (frame) cancelAnimationFrame(frame);
      root.classList.remove("sheet-open");
    };
  }, []);
  return null;
}
