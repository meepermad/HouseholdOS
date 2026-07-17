"use client";

import {
  clearOfflineDatabase,
  enqueueOutbox,
  getMeta,
  listPendingOutbox,
  setMeta,
  updateOutbox,
  type OutboxMutation,
} from "@/lib/offline/idb";
import { assertOfflineAllowed } from "@/lib/offline/online-only";

export async function queueOfflineMutation(input: {
  householdId: string;
  action: string;
  body: Record<string, unknown>;
}): Promise<OutboxMutation> {
  assertOfflineAllowed(input.action);
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `outbox-${Math.random().toString(36).slice(2)}`;
  return enqueueOutbox({
    id,
    householdId: input.householdId,
    action: input.action,
    body: input.body,
    clientMutationId: id,
    createdAt: new Date().toISOString(),
  });
}

export async function getSyncStatus(householdId?: string): Promise<{
  pendingCount: number;
  lastSyncedAt: string | null;
  offlineEnabled: boolean;
}> {
  const [pending, lastSyncedAt, offlineEnabled] = await Promise.all([
    listPendingOutbox(householdId),
    getMeta<string>("lastSyncedAt"),
    getMeta<boolean>("offlineEnabled"),
  ]);
  return {
    pendingCount: pending.length,
    lastSyncedAt,
    offlineEnabled: offlineEnabled !== false,
  };
}

export async function setOfflineEnabled(enabled: boolean): Promise<void> {
  await setMeta("offlineEnabled", enabled);
  if (!enabled) {
    await clearOfflineDatabase();
  }
}

export async function clearOfflineData(): Promise<void> {
  await clearOfflineDatabase();
}

export async function drainOutbox(
  flush: (mutation: OutboxMutation) => Promise<void>,
  householdId?: string,
): Promise<{ synced: number; failed: number }> {
  const pending = await listPendingOutbox(householdId);
  let synced = 0;
  let failed = 0;
  for (const mutation of pending) {
    await updateOutbox(mutation.id, {
      status: "syncing",
      attempts: mutation.attempts + 1,
    });
    try {
      await flush(mutation);
      await updateOutbox(mutation.id, { status: "synced", lastError: undefined });
      synced += 1;
    } catch (e) {
      await updateOutbox(mutation.id, {
        status: "failed",
        lastError: e instanceof Error ? e.message : "Sync failed",
      });
      failed += 1;
    }
  }
  await setMeta("lastSyncedAt", new Date().toISOString());
  return { synced, failed };
}
