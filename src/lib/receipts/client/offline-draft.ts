"use client";

/**
 * Offline local receipt review drafts (IndexedDB).
 * Images are not cached in the service worker.
 * Financial expense creation remains online-only.
 */

const DB_NAME = "householdos-receipt-offline";
const DB_VERSION = 1;
const STORE = "drafts";

export type OfflineReceiptDraft = {
  id: string;
  householdId: string;
  createdAt: string;
  updatedAt: string;
  fileName: string;
  mimeType: string;
  /** Original file as ArrayBuffer for later upload */
  originalBytes: ArrayBuffer;
  proposalJson: string;
  status: "local_review" | "waiting_upload" | "uploaded";
  syncedReceiptId?: string;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("by_household", "householdId", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Failed to open receipt offline DB"));
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IDB tx failed"));
    tx.onabort = () => reject(tx.error ?? new Error("IDB tx aborted"));
  });
}

export async function saveOfflineReceiptDraft(
  draft: OfflineReceiptDraft,
): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE, "readwrite");
  tx.objectStore(STORE).put(draft);
  await txDone(tx);
  db.close();
}

export async function getOfflineReceiptDraft(
  id: string,
): Promise<OfflineReceiptDraft | null> {
  const db = await openDb();
  const tx = db.transaction(STORE, "readonly");
  const req = tx.objectStore(STORE).get(id);
  const result = await new Promise<OfflineReceiptDraft | undefined>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result as OfflineReceiptDraft | undefined);
    req.onerror = () => reject(req.error);
  });
  await txDone(tx);
  db.close();
  return result ?? null;
}

export async function listOfflineReceiptDrafts(
  householdId: string,
): Promise<OfflineReceiptDraft[]> {
  const db = await openDb();
  const tx = db.transaction(STORE, "readonly");
  const idx = tx.objectStore(STORE).index("by_household");
  const req = idx.getAll(householdId);
  const result = await new Promise<OfflineReceiptDraft[]>((resolve, reject) => {
    req.onsuccess = () => resolve((req.result as OfflineReceiptDraft[]) ?? []);
    req.onerror = () => reject(req.error);
  });
  await txDone(tx);
  db.close();
  return result.filter((d) => d.status !== "uploaded");
}

export async function discardOfflineReceiptDraft(id: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE, "readwrite");
  tx.objectStore(STORE).delete(id);
  await txDone(tx);
  db.close();
}
