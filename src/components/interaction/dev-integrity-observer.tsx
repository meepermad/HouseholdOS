"use client";

import { useEffect } from "react";

/**
 * Development-only warnings for suspicious interactive controls.
 * Never mounts diagnostics in production.
 */
export function DevIntegrityObserver() {
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    const root = document.body;
    const empties = root.querySelectorAll('a[href="#"], a[href=""], a[href="javascript:void(0)"]');
    empties.forEach((el) => {
      console.warn("[interaction-integrity] Link has no destination", el);
    });
    const buttons = root.querySelectorAll("button:not([disabled])");
    buttons.forEach((button) => {
      const type = button.getAttribute("type");
      const inForm = Boolean(button.closest("form"));
      const hasPopup = button.getAttribute("aria-expanded") != null;
      if (type === "submit" && inForm) return;
      if (hasPopup) return;
      if (button.getAttribute("data-integrity") === "ok") return;
    });
  }, []);
  return null;
}
