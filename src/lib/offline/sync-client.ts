"use client";

import {
  clearOfflineDatabase,
  discardOutbox,
  enqueueOutbox,
  getMeta,
  listPendingOutbox,
  listRecoverableOutbox,
  reconcileOutboxStatuses,
  setMeta,
  updateOutbox,
  type OutboxMutation,
} from "@/lib/offline/idb";
import { assertOfflineAllowed } from "@/lib/offline/online-only";

export type PushFlushResult = {
  applied: boolean;
  unsupported?: boolean;
  conflict?: boolean;
  error?: string;
};

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
  unsupportedCount: number;
  recoverableCount: number;
  lastSyncedAt: string | null;
  offlineEnabled: boolean;
}> {
  await reconcileOutboxStatuses();
  const [pending, recoverable, lastSyncedAt, offlineEnabled] = await Promise.all([
    listPendingOutbox(householdId),
    listRecoverableOutbox(householdId),
    getMeta<string>("lastSyncedAt"),
    getMeta<boolean>("offlineEnabled"),
  ]);
  const unsupportedCount = recoverable.filter((r) => r.status === "unsupported").length;
  return {
    pendingCount: pending.length,
    unsupportedCount,
    recoverableCount: recoverable.length,
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

export async function discardOfflineMutation(id: string): Promise<void> {
  await discardOutbox(id);
}

export async function listOfflineRecoverable(
  householdId?: string,
): Promise<OutboxMutation[]> {
  return listRecoverableOutbox(householdId);
}

/**
 * Drain pending/failed outbox rows. Only marks applied when the flush
 * callback reports applied: true. Unapplied acknowledgements become
 * unsupported and remain recoverable.
 */
export async function drainOutbox(
  flush: (mutation: OutboxMutation) => Promise<PushFlushResult>,
  householdId?: string,
): Promise<{
  applied: number;
  failed: number;
  unsupported: number;
  conflict: number;
}> {
  const pending = await listPendingOutbox(householdId);
  let applied = 0;
  let failed = 0;
  let unsupported = 0;
  let conflict = 0;

  for (const mutation of pending) {
    // Never submit a mutation under a different household context.
    if (householdId && mutation.householdId !== householdId) {
      await updateOutbox(mutation.id, {
        status: "conflict",
        lastError: "Household mismatch; mutation kept for original household",
      });
      conflict += 1;
      continue;
    }

    await updateOutbox(mutation.id, {
      status: "syncing",
      attempts: mutation.attempts + 1,
    });
    try {
      const result = await flush(mutation);
      if (result.conflict) {
        await updateOutbox(mutation.id, {
          status: "conflict",
          lastError: result.error ?? "Sync conflict",
        });
        conflict += 1;
        continue;
      }
      if (result.unsupported || result.applied === false) {
        await updateOutbox(mutation.id, {
          status: "unsupported",
          lastError:
            result.error ??
            "Server synchronization is not available for this action yet",
        });
        unsupported += 1;
        continue;
      }
      if (result.applied === true) {
        await updateOutbox(mutation.id, {
          status: "applied",
          lastError: undefined,
        });
        applied += 1;
        continue;
      }
      await updateOutbox(mutation.id, {
        status: "failed",
        lastError: result.error ?? "Unexpected sync response",
      });
      failed += 1;
    } catch (e) {
      await updateOutbox(mutation.id, {
        status: "failed",
        lastError: e instanceof Error ? e.message : "Sync failed",
      });
      failed += 1;
    }
  }

  if (applied > 0) {
    await setMeta("lastSyncedAt", new Date().toISOString());
  }

  return { applied, failed, unsupported, conflict };
}
