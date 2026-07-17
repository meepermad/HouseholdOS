/**
 * Deterministic external sync conflict policy.
 * Never silently choose a winner when both sides changed materially.
 */

export type SyncConflictType =
  | "provider_only"
  | "local_only"
  | "both_changed"
  | "provider_deleted_local_changed"
  | "local_deleted_provider_changed"
  | "duplicate";

export type SyncConflictResolution =
  | "pending"
  | "keep_local"
  | "keep_provider"
  | "merged"
  | "dismissed";

export type SyncFieldSnapshot = {
  title: string;
  startsAt: string | null;
  endsAt: string | null;
  location: string | null;
  cancelled: boolean;
};

export function classifySyncConflict(params: {
  localChangedSinceSync: boolean;
  providerChangedSinceSync: boolean;
  localDeleted: boolean;
  providerDeleted: boolean;
  isDuplicate?: boolean;
}): SyncConflictType | null {
  if (params.isDuplicate) return "duplicate";
  if (params.providerDeleted && params.localChangedSinceSync) {
    return "provider_deleted_local_changed";
  }
  if (params.localDeleted && params.providerChangedSinceSync) {
    return "local_deleted_provider_changed";
  }
  if (params.localChangedSinceSync && params.providerChangedSinceSync) {
    return "both_changed";
  }
  if (params.providerChangedSinceSync && !params.localChangedSinceSync) {
    return "provider_only";
  }
  if (params.localChangedSinceSync && !params.providerChangedSinceSync) {
    return "local_only";
  }
  return null;
}

export function autoResolutionFor(
  conflict: SyncConflictType,
): SyncConflictResolution {
  switch (conflict) {
    case "provider_only":
      return "keep_provider";
    case "local_only":
      return "keep_local";
    case "both_changed":
    case "provider_deleted_local_changed":
    case "local_deleted_provider_changed":
    case "duplicate":
      return "pending";
  }
}

export function materialSyncFieldsChanged(
  a: SyncFieldSnapshot,
  b: SyncFieldSnapshot,
): boolean {
  return (
    a.title !== b.title ||
    a.startsAt !== b.startsAt ||
    a.endsAt !== b.endsAt ||
    (a.location ?? "") !== (b.location ?? "") ||
    a.cancelled !== b.cancelled
  );
}

/** Exponential backoff delays in ms for sync retries. */
export function syncBackoffMs(attempt: number): number {
  const base = 60_000;
  const capped = Math.min(12 * 60 * 60_000, base * 2 ** Math.max(0, attempt - 1));
  const jitter = Math.floor(Math.random() * 5_000);
  return capped + jitter;
}

/**
 * Echo-loop guard: skip applying a provider update that matches the last
 * payload we ourselves exported (same etag / version).
 */
export function isEchoLoop(params: {
  lastExportedProviderVersion: string | null;
  incomingProviderVersion: string | null;
}): boolean {
  if (!params.lastExportedProviderVersion || !params.incomingProviderVersion) {
    return false;
  }
  return params.lastExportedProviderVersion === params.incomingProviderVersion;
}
