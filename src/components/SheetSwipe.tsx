"use client";

import { useEffect } from "react";

const ZONE = 56; // px from the top of a sheet where a swipe down can start
const CLOSE_AT = 110; // px dragged, or a quick flick
const FLICK = 0.6; // px per ms

/**
 * Swipe a bottom sheet down to close it, starting from the grab handle area at
 * its top (like iOS). Works for every `.sheet` inside a `.sheet-backdrop`:
 * closing taps the backdrop, so each sheet's own close logic still runs.
 */
export function SheetSwipe() {
  useEffect(() => {
    let sheet: HTMLElement | null = null;
    let backdrop: HTMLElement | null = null;
    let startY = 0;
    let startT = 0;
    let dy = 0;
    let dragging = false;

    function begin(target: EventTarget | null, y: number): boolean {
      const el = (target as HTMLElement | null)?.closest?.(".sheet") as HTMLElement | null;
      const bd = el?.closest(".sheet-backdrop") as HTMLElement | null;
      if (!el || !bd) return false;
      const top = el.getBoundingClientRect().top;
      if (y - top > ZONE || el.scrollTop > 0) return false;
      sheet = el;
      backdrop = bd;
      startY = y;
      startT = performance.now();
      dy = 0;
      dragging = false;
      return true;
    }

    function move(y: number): boolean {
      if (!sheet) return false;
      dy = Math.max(0, y - startY);
      if (!dragging && dy < 6) return false;
      dragging = true;
      sheet.style.transition = "none";
      sheet.style.transform = `translateY(${dy}px)`;
      if (backdrop) backdrop.style.backgroundColor = `rgba(17,17,17,${Math.max(0, 0.4 * (1 - dy / 400))})`;
      return true;
    }

    function end() {
      if (!sheet) return;
      const el = sheet;
      const bd = backdrop;
      const fast = dy / Math.max(1, performance.now() - startT) > FLICK && dy > 30;
      sheet = null;
      backdrop = null;
      if (!dragging) return;
      dragging = false;
      if (dy > CLOSE_AT || fast) {
        el.style.transition = "transform 0.18s ease-in";
        el.style.transform = "translateY(100%)";
        window.setTimeout(() => {
          bd?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
          // If the sheet chose to stay open (busy saving), slide it back.
          window.setTimeout(() => {
            if (el.isConnected) {
              el.style.transition = "transform 0.2s ease-out";
              el.style.transform = "";
              if (bd) bd.style.backgroundColor = "";
            }
          }, 60);
        }, 170);
      } else {
        el.style.transition = "transform 0.2s ease-out";
        el.style.transform = "";
        if (bd) bd.style.backgroundColor = "";
      }
    }

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) begin(e.target, e.touches[0].clientY);
    };
    const onTouchMove = (e: TouchEvent) => {
      if (sheet && move(e.touches[0].clientY)) e.preventDefault(); // don't scroll the page while dragging
    };
    const onTouchEnd = () => end();
    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 0) begin(e.target, e.clientY);
    };
    const onMouseMove = (e: MouseEvent) => {
      if (sheet) move(e.clientY);
    };
    // A drag that ends over the backdrop shouldn't also count as a tap on it.
    const onClick = (e: MouseEvent) => {
      if (suppress && e.isTrusted) {
        e.stopPropagation();
        e.preventDefault();
      }
      suppress = false;
    };
    let suppress = false;
    const onMouseUp = () => {
      suppress = dragging;
      if (suppress) window.setTimeout(() => { suppress = false; }, 0);
      end();
    };

    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("touchend", onTouchEnd);
    document.addEventListener("touchcancel", onTouchEnd);
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
      document.removeEventListener("touchcancel", onTouchEnd);
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      document.removeEventListener("click", onClick, true);
    };
  }, []);
  return null;
}
