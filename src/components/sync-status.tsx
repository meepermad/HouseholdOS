"use client";

import { useEffect, useState } from "react";
import {
  clearOfflineData,
  drainOutbox,
  getSyncStatus,
} from "@/lib/offline/sync-client";

type Props = {
  householdId?: string;
};

export function SyncStatusChip({ householdId }: Props) {
  const [online, setOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function refresh() {
    try {
      const status = await getSyncStatus(householdId);
      setPendingCount(status.pendingCount);
      setLastSyncedAt(status.lastSyncedAt);
    } catch {
      // IndexedDB may be unavailable (private mode)
    }
  }

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    const boot = window.setTimeout(() => {
      void refresh();
    }, 0);
    const id = window.setInterval(() => void refresh(), 15000);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
      window.clearTimeout(boot);
      window.clearInterval(id);
    };
    // refresh reads householdId via closure; re-bind on household change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [householdId]);

  async function onSync() {
    setBusy(true);
    setMessage(null);
    try {
      const result = await drainOutbox(async (mutation) => {
        const res = await fetch("/api/sync/push", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(mutation),
        });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || "Sync rejected");
        }
      }, householdId);
      setMessage(`Synced ${result.synced}, failed ${result.failed}`);
      await refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setBusy(false);
    }
  }

  async function onClear() {
    setBusy(true);
    try {
      await clearOfflineData();
      setPendingCount(0);
      setLastSyncedAt(null);
      setMessage("Offline data cleared.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="flex flex-wrap items-center gap-2 text-xs text-text-muted"
      data-testid="sync-status"
    >
      <span>
        {online ? "Online" : "Offline"}
        {pendingCount > 0 ? ` · ${pendingCount} waiting` : ""}
        {lastSyncedAt
          ? ` · last synced ${new Date(lastSyncedAt).toLocaleString()}`
          : ""}
      </span>
      <button
        type="button"
        disabled={busy || !online || pendingCount === 0}
        onClick={() => void onSync()}
        className="rounded border border-border px-2 py-1 font-medium disabled:opacity-50"
      >
        Sync now
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => void onClear()}
        className="rounded border border-border px-2 py-1 font-medium disabled:opacity-50"
      >
        Clear offline data
      </button>
      {message ? <span role="status">{message}</span> : null}
    </div>
  );
}
