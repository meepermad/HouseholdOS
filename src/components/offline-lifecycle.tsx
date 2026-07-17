"use client";

import { useEffect } from "react";
import { clearOfflineData } from "@/lib/offline/sync-client";
import { SyncStatusChip } from "@/components/sync-status";

/** Clears IndexedDB on logout form submit; shows sync status chip. */
export function OfflineLifecycle({ householdId }: { householdId?: string }) {
  useEffect(() => {
    const onSubmit = (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLFormElement)) return;
      const action = target.getAttribute("action") ?? "";
      if (action.includes("/auth/logout")) {
        void clearOfflineData();
      }
    };
    document.addEventListener("submit", onSubmit, true);
    return () => document.removeEventListener("submit", onSubmit, true);
  }, []);

  return (
    <div className="px-3 py-1">
      <SyncStatusChip householdId={householdId} />
    </div>
  );
}
