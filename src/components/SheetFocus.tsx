"use client";

import { useEffect } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';

/**
 * Keyboard support for every bottom sheet (`.sheet` inside a `.sheet-backdrop`):
 * Escape closes the top sheet, focus moves into a sheet when it opens, Tab stays
 * inside it, and focus goes back where it was when it closes.
 *
 * Closing works the way SheetSwipe does it: a click on the backdrop, so each
 * sheet's own close logic (including "busy, stay open") still decides.
 */
export function SheetFocus() {
  useEffect(() => {
    // Sheets that are open, oldest first, with what had focus before each opened.
    const open: { sheet: HTMLElement; before: Element | null }[] = [];

    const top = () => {
      for (let i = open.length - 1; i >= 0; i--) {
        if (open[i].sheet.isConnected) return open[i].sheet;
      }
      return null;
    };

    const focusables = (sheet: HTMLElement) =>
      Array.from(sheet.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null || el === document.activeElement);

    function opened(sheet: HTMLElement) {
      if (open.some((o) => o.sheet === sheet)) return;
      open.push({ sheet, before: document.activeElement });
      if (!sheet.hasAttribute("tabindex")) sheet.setAttribute("tabindex", "-1");
      // Let the sheet's own autoFocus win; otherwise focus the sheet itself so
      // a screen reader announces it without jumping into a field.
      requestAnimationFrame(() => {
        if (!sheet.contains(document.activeElement)) sheet.focus({ preventScroll: true });
      });
    }

    function closed() {
      for (let i = open.length - 1; i >= 0; i--) {
        const o = open[i];
        if (o.sheet.isConnected) continue;
        open.splice(i, 1);
        const back = o.before as HTMLElement | null;
        const next = top();
        if (next) next.focus({ preventScroll: true });
        else if (back?.isConnected && typeof back.focus === "function") back.focus({ preventScroll: true });
      }
    }

    function scan(node: Node) {
      if (!(node instanceof HTMLElement)) return;
      if (node.matches('.sheet[role="dialog"]')) opened(node);
      node.querySelectorAll<HTMLElement>('.sheet[role="dialog"]').forEach(opened);
    }

    const observer = new MutationObserver((records) => {
      let removed = false;
      for (const r of records) {
        r.addedNodes.forEach(scan);
        if (r.removedNodes.length) removed = true;
      }
      if (removed) closed();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    scan(document.body);

    const onKeyDown = (e: KeyboardEvent) => {
      const sheet = top();
      if (!sheet) return;
      if (e.key === "Escape") {
        const backdrop = sheet.closest(".sheet-backdrop");
        if (!backdrop) return;
        e.preventDefault();
        e.stopPropagation();
        backdrop.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        return;
      }
      if (e.key !== "Tab") return;
      const items = focusables(sheet);
      if (items.length === 0) {
        e.preventDefault();
        sheet.focus({ preventScroll: true });
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (!sheet.contains(active)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      } else if (e.shiftKey && (active === first || active === sheet)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown, true);

    return () => {
      observer.disconnect();
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, []);

  return null;
}
