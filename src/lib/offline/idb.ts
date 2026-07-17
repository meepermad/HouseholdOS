/**
 * Completion-D: client offline store (IndexedDB).
 * Never cache private financial records in the service worker; this IDB is
 * for non-financial snapshots + mutation outbox only.
 */

export const OFFLINE_DB_NAME = "householdos-offline";
export const OFFLINE_DB_VERSION = 1;

export type OutboxStatus = "pending" | "syncing" | "synced" | "failed" | "conflict";

export type OutboxMutation = {
  id: string;
  householdId: string;
  action: string;
  body: Record<string, unknown>;
  clientMutationId: string;
  createdAt: string;
  status: OutboxStatus;
  attempts: number;
  lastError?: string;
};

export type SnapshotRecord = {
  key: string;
  householdId: string;
  domain: string;
  revision: string;
  payload: unknown;
  updatedAt: string;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const req = indexedDB.open(OFFLINE_DB_NAME, OFFLINE_DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("snapshots")) {
        const store = db.createObjectStore("snapshots", { keyPath: "key" });
        store.createIndex("by_household", "householdId", { unique: false });
      }
      if (!db.objectStoreNames.contains("outbox")) {
        const store = db.createObjectStore("outbox", { keyPath: "id" });
        store.createIndex("by_household_status", ["householdId", "status"], {
          unique: false,
        });
      }
      if (!db.objectStoreNames.contains("meta")) {
        db.createObjectStore("meta", { keyPath: "key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Failed to open offline DB"));
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB transaction failed"));
    tx.onabort = () => reject(tx.error ?? new Error("IndexedDB transaction aborted"));
  });
}

export async function putSnapshot(record: SnapshotRecord): Promise<void> {
  const db = await openDb();
  const tx = db.transaction("snapshots", "readwrite");
  tx.objectStore("snapshots").put(record);
  await txDone(tx);
  db.close();
}

export async function getSnapshot(key: string): Promise<SnapshotRecord | null> {
  const db = await openDb();
  const tx = db.transaction("snapshots", "readonly");
  const req = tx.objectStore("snapshots").get(key);
  const row = await new Promise<SnapshotRecord | undefined>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result as SnapshotRecord | undefined);
    req.onerror = () => reject(req.error);
  });
  await txDone(tx);
  db.close();
  return row ?? null;
}

export async function enqueueOutbox(
  mutation: Omit<OutboxMutation, "status" | "attempts"> & {
    status?: OutboxStatus;
    attempts?: number;
  },
): Promise<OutboxMutation> {
  const row: OutboxMutation = {
    ...mutation,
    status: mutation.status ?? "pending",
    attempts: mutation.attempts ?? 0,
  };
  const db = await openDb();
  const tx = db.transaction("outbox", "readwrite");
  tx.objectStore("outbox").put(row);
  await txDone(tx);
  db.close();
  return row;
}

export async function listPendingOutbox(
  householdId?: string,
): Promise<OutboxMutation[]> {
  const db = await openDb();
  const tx = db.transaction("outbox", "readonly");
  const store = tx.objectStore("outbox");
  const req = store.getAll();
  const rows = await new Promise<OutboxMutation[]>((resolve, reject) => {
    req.onsuccess = () => resolve((req.result as OutboxMutation[]) ?? []);
    req.onerror = () => reject(req.error);
  });
  await txDone(tx);
  db.close();
  return rows
    .filter((r) => r.status === "pending" || r.status === "failed")
    .filter((r) => (householdId ? r.householdId === householdId : true))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function updateOutbox(
  id: string,
  patch: Partial<OutboxMutation>,
): Promise<void> {
  const db = await openDb();
  const tx = db.transaction("outbox", "readwrite");
  const store = tx.objectStore("outbox");
  const req = store.get(id);
  const existing = await new Promise<OutboxMutation | undefined>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result as OutboxMutation | undefined);
    req.onerror = () => reject(req.error);
  });
  if (existing) {
    store.put({ ...existing, ...patch, id });
  }
  await txDone(tx);
  db.close();
}

export async function getMeta<T = unknown>(key: string): Promise<T | null> {
  const db = await openDb();
  const tx = db.transaction("meta", "readonly");
  const req = tx.objectStore("meta").get(key);
  const row = await new Promise<{ key: string; value: T } | undefined>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result as { key: string; value: T } | undefined);
    req.onerror = () => reject(req.error);
  });
  await txDone(tx);
  db.close();
  return row?.value ?? null;
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  const db = await openDb();
  const tx = db.transaction("meta", "readwrite");
  tx.objectStore("meta").put({ key, value });
  await txDone(tx);
  db.close();
}

export async function clearOfflineDatabase(): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase(OFFLINE_DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error ?? new Error("Failed to clear offline DB"));
    req.onblocked = () => resolve();
  });
}
