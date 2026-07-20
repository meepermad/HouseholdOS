"use client";

import { useEffect, useState } from "react";
import {
  clearOfflineData,
  discardOfflineMutation,
  drainOutbox,
  getSyncStatus,
  listOfflineRecoverable,
  type PushFlushResult,
} from "@/lib/offline/sync-client";
import type { OutboxMutation } from "@/lib/offline/idb";

type Props = {
  householdId?: string;
};

export function SyncStatusChip({ householdId }: Props) {
  const [online, setOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [unsupportedCount, setUnsupportedCount] = useState(0);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [recoverable, setRecoverable] = useState<OutboxMutation[]>([]);

  async function refresh() {
    try {
      const status = await getSyncStatus(householdId);
      setPendingCount(status.pendingCount);
      setUnsupportedCount(status.unsupportedCount);
      setLastSyncedAt(status.lastSyncedAt);
      const rows = await listOfflineRecoverable(householdId);
      setRecoverable(rows.filter((r) => r.status === "unsupported" || r.status === "conflict"));
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
        let body: {
          applied?: boolean;
          unsupported?: boolean;
          conflict?: boolean;
          error?: string;
          note?: string;
        } = {};
        try {
          body = (await res.json()) as typeof body;
        } catch {
          body = {};
        }
        if (res.status === 403 || res.status === 409 || body.conflict) {
          return {
            applied: false,
            conflict: true,
            error: body.error ?? "Sync conflict",
          } satisfies PushFlushResult;
        }
        if (!res.ok) {
          throw new Error(body.error ?? "Sync rejected");
        }
        return {
          applied: body.applied === true,
          unsupported: body.unsupported === true || body.applied === false,
          error: body.note ?? body.error,
        } satisfies PushFlushResult;
      }, householdId);
      const parts: string[] = [];
      if (result.applied > 0) parts.push(`Applied ${result.applied}`);
      if (result.unsupported > 0) {
        parts.push(`${result.unsupported} saved on this device only`);
      }
      if (result.conflict > 0) parts.push(`${result.conflict} conflict`);
      if (result.failed > 0) parts.push(`${result.failed} failed`);
      setMessage(parts.join(" · ") || "Nothing to sync");
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
      setUnsupportedCount(0);
      setLastSyncedAt(null);
      setRecoverable([]);
      setMessage("Offline data cleared.");
    } finally {
      setBusy(false);
    }
  }

  async function onDiscard(id: string) {
    setBusy(true);
    try {
      await discardOfflineMutation(id);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="flex flex-col gap-2 text-xs text-text-muted"
      data-testid="sync-status"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span>
          {online ? "Online" : "Offline"}
          {pendingCount > 0 ? ` · ${pendingCount} waiting` : ""}
          {unsupportedCount > 0
            ? ` · ${unsupportedCount} saved on this device`
            : ""}
          {lastSyncedAt
            ? ` · last applied ${new Date(lastSyncedAt).toLocaleString()}`
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
      {recoverable.length > 0 ? (
        <ul className="space-y-1" data-testid="sync-unsupported-list">
          {recoverable.map((row) => (
            <li
              key={row.id}
              className="flex flex-wrap items-center gap-2 rounded border border-border bg-surface px-2 py-1"
            >
              <span>
                Saved on this device · {row.action}. Server synchronization is
                not available for this action yet.
              </span>
              <button
                type="button"
                disabled={busy}
                onClick={() => void onDiscard(row.id)}
                className="rounded border border-border px-2 py-0.5 font-medium disabled:opacity-50"
              >
                Discard
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
