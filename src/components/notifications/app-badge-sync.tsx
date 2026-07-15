"use client";

import { useEffect } from "react";
import { shouldClearBadge } from "@/lib/notifications/badge";

/**
 * Syncs the OS / PWA app badge with the unread notification count.
 */
export function AppBadgeSync({ count }: { count: number }) {
  useEffect(() => {
    const nav = navigator as Navigator & {
      setAppBadge?: (n?: number) => Promise<void>;
      clearAppBadge?: () => Promise<void>;
    };

    void (async () => {
      try {
        if (shouldClearBadge(count)) {
          await nav.clearAppBadge?.();
          return;
        }
        await nav.setAppBadge?.(count);
      } catch {
        /* Badge API unsupported or denied — ignore */
      }
    })();
  }, [count]);

  return null;
}
