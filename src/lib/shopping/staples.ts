/**
 * Recurring staple detection from household supply restock history.
 * Household-scoped only — never attributes consumption to a roommate.
 */

import { canonicalShoppingKey } from "@/lib/shopping/recommendations/normalize";

export type StapleRestockPoint = {
  at: string; // ISO
  quantity: number | null;
};

export type StapleHistoryInput = {
  supplyId: string;
  name: string;
  unit: string;
  restocks: StapleRestockPoint[];
  suppressed: boolean;
  archived: boolean;
  ownershipMode: string;
};

export type RecurringStapleCandidate = {
  id: string;
  name: string;
  relatedSupplyId: string;
  typicalIntervalDays: number;
  daysSinceLastPurchase: number;
  lastQuantity: number | null;
  unit: string;
  purchaseCount: number;
  explanation: string;
  reasonCodes: string[];
};

export function buildRecurringStapleCandidates(
  inputs: readonly StapleHistoryInput[],
  opts: {
    minPurchaseCount: number;
    now?: Date;
  },
): RecurringStapleCandidate[] {
  const now = opts.now ?? new Date();
  const min = Math.max(2, opts.minPurchaseCount);
  const out: RecurringStapleCandidate[] = [];

  for (const item of inputs) {
    if (item.archived || item.suppressed) continue;
    if (item.ownershipMode === "personal" || item.ownershipMode === "temporary") {
      continue;
    }

    const points = item.restocks
      .map((r) => ({ at: new Date(r.at), quantity: r.quantity }))
      .filter((r) => !Number.isNaN(r.at.getTime()))
      .sort((a, b) => a.at.getTime() - b.at.getTime());

    if (points.length < min) continue;

    const intervals: number[] = [];
    for (let i = 1; i < points.length; i++) {
      const days =
        (points[i]!.at.getTime() - points[i - 1]!.at.getTime()) / 86400000;
      if (days >= 1 && days <= 365) intervals.push(days);
    }
    if (intervals.length < min - 1) continue;

    // Exclude highly inconsistent intervals (CV > 0.75)
    const mean =
      intervals.reduce((a, b) => a + b, 0) / Math.max(1, intervals.length);
    if (mean < 3) continue;
    const variance =
      intervals.reduce((a, b) => a + (b - mean) ** 2, 0) / intervals.length;
    const cv = Math.sqrt(variance) / mean;
    if (cv > 0.75) continue;

    const typicalIntervalDays = Math.round(mean);
    const last = points[points.length - 1]!;
    const daysSinceLastPurchase = Math.floor(
      (now.getTime() - last.at.getTime()) / 86400000,
    );

    if (daysSinceLastPurchase < typicalIntervalDays) continue;

    const qtySamples = points
      .map((p) => p.quantity)
      .filter((q): q is number => q != null && Number.isFinite(q) && q > 0);
    const lastQuantity =
      qtySamples.length > 0
        ? Math.round(
            (qtySamples.reduce((a, b) => a + b, 0) / qtySamples.length) * 100,
          ) / 100
        : last.quantity;

    const weeksApprox = Math.max(1, Math.round(typicalIntervalDays / 7));
    const weeksSince = Math.max(1, Math.round(daysSinceLastPurchase / 7));

    out.push({
      id: item.supplyId,
      name: item.name,
      relatedSupplyId: item.supplyId,
      typicalIntervalDays,
      daysSinceLastPurchase,
      lastQuantity,
      unit: item.unit,
      purchaseCount: points.length,
      explanation: `Usually purchased every ${weeksApprox} week${weeksApprox === 1 ? "" : "s"} and last purchased about ${weeksSince} week${weeksSince === 1 ? "" : "s"} ago. Estimate based on ${points.length} purchases.`,
      reasonCodes: ["recurring_staple"],
    });
  }

  return out.sort((a, b) =>
    canonicalShoppingKey(a.name).localeCompare(canonicalShoppingKey(b.name)),
  );
}
