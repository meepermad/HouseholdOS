/**
 * Duplicate / recurring issue detection — never silently merges.
 */

import type { MaintenanceCategory, MaintenanceStatus } from "./types";
import { isOpenMaintenanceStatus } from "./lifecycle";

export type DuplicateCandidate = {
  id: string;
  title: string;
  category: MaintenanceCategory;
  status: MaintenanceStatus;
  locationId: string | null;
  inventoryItemId: string | null;
  resolvedAt?: string | null;
  createdAt: string;
};

export type DuplicateDetectionInput = {
  title: string;
  category: MaintenanceCategory;
  locationId: string | null;
  inventoryItemId: string | null;
  now?: Date;
  /** Lookback days for recurring / related historical. */
  lookbackDays?: number;
};

export type DuplicateOutcome =
  | "none"
  | "possible_open_duplicate"
  | "possible_recurring"
  | "related_historical";

export type DuplicateDetectionResult = {
  outcome: DuplicateOutcome;
  matches: DuplicateCandidate[];
};

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titleSimilarity(a: string, b: string): number {
  const ta = new Set(normalizeTitle(a).split(" ").filter(Boolean));
  const tb = new Set(normalizeTitle(b).split(" ").filter(Boolean));
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter += 1;
  return inter / Math.max(ta.size, tb.size);
}

function daysBetween(iso: string, now: Date): number {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return Number.POSITIVE_INFINITY;
  return (now.getTime() - then.getTime()) / (1000 * 60 * 60 * 24);
}

export function detectDuplicateMaintenanceIssues(
  input: DuplicateDetectionInput,
  existing: readonly DuplicateCandidate[],
): DuplicateDetectionResult {
  const now = input.now ?? new Date();
  const lookback = input.lookbackDays ?? 180;
  const matches: DuplicateCandidate[] = [];

  for (const row of existing) {
    const sameLocation =
      input.locationId != null &&
      row.locationId != null &&
      input.locationId === row.locationId;
    const sameAsset =
      input.inventoryItemId != null &&
      row.inventoryItemId != null &&
      input.inventoryItemId === row.inventoryItemId;
    const sameCategory = row.category === input.category;
    const similarTitle = titleSimilarity(input.title, row.title) >= 0.5;

    if (!(sameCategory && (sameLocation || sameAsset || similarTitle))) {
      continue;
    }
    if (!(sameLocation || sameAsset || similarTitle)) continue;

    const recent =
      daysBetween(row.resolvedAt ?? row.createdAt, now) <= lookback;
    if (!recent && !isOpenMaintenanceStatus(row.status)) continue;

    matches.push(row);
  }

  if (matches.length === 0) {
    return { outcome: "none", matches: [] };
  }

  const open = matches.filter((m) => isOpenMaintenanceStatus(m.status));
  if (open.length > 0) {
    return { outcome: "possible_open_duplicate", matches: open };
  }

  const recentlyResolved = matches.filter(
    (m) =>
      (m.status === "resolved" || m.status === "closed") &&
      daysBetween(m.resolvedAt ?? m.createdAt, now) <= 90,
  );
  if (recentlyResolved.length > 0) {
    return { outcome: "possible_recurring", matches: recentlyResolved };
  }

  return { outcome: "related_historical", matches };
}
