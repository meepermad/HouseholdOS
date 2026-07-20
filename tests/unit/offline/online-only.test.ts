import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OutboxMutation } from "@/lib/offline/idb";

const store = new Map<string, OutboxMutation>();
const meta = new Map<string, unknown>();

vi.mock("@/lib/offline/idb", () => ({
  reconcileOutboxStatuses: vi.fn(async () => {
    let n = 0;
    for (const [id, row] of store) {
      if (row.status === "synced") {
        store.set(id, {
          ...row,
          status: "unsupported",
          lastError:
            row.lastError ??
            "Server synchronization is not available for this action yet",
        });
        n += 1;
      }
    }
    return n;
  }),
  listPendingOutbox: vi.fn(async (householdId?: string) =>
    [...store.values()]
      .filter((r) => r.status === "pending" || r.status === "failed")
      .filter((r) => (householdId ? r.householdId === householdId : true)),
  ),
  listRecoverableOutbox: vi.fn(async (householdId?: string) =>
    [...store.values()].filter((r) =>
      householdId ? r.householdId === householdId : true,
    ),
  ),
  updateOutbox: vi.fn(async (id: string, patch: Partial<OutboxMutation>) => {
    const existing = store.get(id);
    if (existing) store.set(id, { ...existing, ...patch, id });
  }),
  enqueueOutbox: vi.fn(async (mutation: OutboxMutation) => {
    store.set(mutation.id, mutation);
    return mutation;
  }),
  discardOutbox: vi.fn(async (id: string) => {
    const existing = store.get(id);
    if (existing) store.set(id, { ...existing, status: "discarded" });
  }),
  getMeta: vi.fn(async (key: string) => meta.get(key) ?? null),
  setMeta: vi.fn(async (key: string, value: unknown) => {
    meta.set(key, value);
  }),
  clearOfflineDatabase: vi.fn(async () => {
    store.clear();
    meta.clear();
  }),
}));

import {
  drainOutbox,
  getSyncStatus,
} from "@/lib/offline/sync-client";
import {
  assertOfflineAllowed,
  isOfflineAllowedAction,
  isOnlineOnlyAction,
  OFFLINE_ALLOWED_ACTIONS,
} from "@/lib/offline/online-only";

function seed(partial: Partial<OutboxMutation> & Pick<OutboxMutation, "id" | "action">) {
  const row: OutboxMutation = {
    householdId: "hh-a",
    body: {},
    clientMutationId: partial.id,
    createdAt: new Date().toISOString(),
    status: "pending",
    attempts: 0,
    ...partial,
  };
  store.set(row.id, row);
  return row;
}

describe("offline sync honesty", () => {
  beforeEach(() => {
    store.clear();
    meta.clear();
  });

  it("keeps allowlist empty until domain handlers exist", () => {
    expect(OFFLINE_ALLOWED_ACTIONS.size).toBe(0);
    expect(isOfflineAllowedAction("addComment")).toBe(false);
    expect(() => assertOfflineAllowed("addComment")).toThrow(/allowlist/);
  });

  it("blocks financial actions from the outbox", () => {
    expect(isOnlineOnlyAction("confirmPayment")).toBe(true);
    expect(isOnlineOnlyAction("proposeRoutedSettlement")).toBe(true);
    expect(isOnlineOnlyAction("requestRoutedCorrection")).toBe(true);
    expect(() => assertOfflineAllowed("confirmPayment")).toThrow(/online/);
  });

  it("does not mark applied:false as synced and skips lastSyncedAt", async () => {
    seed({ id: "m1", action: "addComment" });
    const result = await drainOutbox(async () => ({
      applied: false,
      unsupported: true,
      error: "Server synchronization is not available for this action yet",
    }));
    expect(result.applied).toBe(0);
    expect(result.unsupported).toBe(1);
    expect(store.get("m1")?.status).toBe("unsupported");
    expect(meta.get("lastSyncedAt")).toBeUndefined();
  });

  it("preserves records on network failure", async () => {
    seed({ id: "m2", action: "createShoppingItem" });
    const result = await drainOutbox(async () => {
      throw new Error("network down");
    });
    expect(result.failed).toBe(1);
    expect(store.get("m2")?.status).toBe("failed");
    expect(store.get("m2")?.lastError).toMatch(/network down/);
  });

  it("marks applied only when flush reports applied:true and sets lastSyncedAt", async () => {
    seed({ id: "m3", action: "futureHandler" });
    const result = await drainOutbox(async () => ({ applied: true }));
    expect(result.applied).toBe(1);
    expect(store.get("m3")?.status).toBe("applied");
    expect(typeof meta.get("lastSyncedAt")).toBe("string");
  });

  it("treats authorization removal as conflict", async () => {
    seed({ id: "m4", action: "addComment" });
    const result = await drainOutbox(async () => ({
      applied: false,
      conflict: true,
      error: "Not an active member of this household",
    }));
    expect(result.conflict).toBe(1);
    expect(store.get("m4")?.status).toBe("conflict");
  });

  it("does not submit a mutation under the wrong household", async () => {
    seed({ id: "m5", action: "addComment", householdId: "hh-a" });
    const result = await drainOutbox(async () => ({ applied: true }), "hh-b");
    expect(result.applied).toBe(0);
    expect(result.conflict).toBe(0);
    // Mutation remains pending for its original household and is not drained under hh-b.
    expect(store.get("m5")?.status).toBe("pending");
  });

  it("reconciles legacy synced rows to unsupported in status", async () => {
    seed({ id: "legacy", action: "addComment", status: "synced" });
    const status = await getSyncStatus("hh-a");
    expect(status.unsupportedCount).toBe(1);
    expect(store.get("legacy")?.status).toBe("unsupported");
  });
});
