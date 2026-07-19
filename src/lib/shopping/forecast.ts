/**
 * Deterministic supply runout forecasting — formula version 1.
 *
 * projectedDays = currentQty / avgDailyConsumption
 * avgDailyConsumption from restock/use/count deltas over a bounded window.
 * Never invents estimates when units are incompatible or history is sparse.
 */

export const FORECAST_FORMULA_VERSION = "1";

export type StockEventSample = {
  eventType: string;
  previousQuantity: number | null;
  newQuantity: number | null;
  createdAt: string; // ISO
};

export type ForecastInput = {
  supplyId: string;
  name: string;
  currentQuantity: number | null;
  quantityUnit: string;
  reorderThreshold: number | null;
  targetQuantity: number | null;
  stockState: string;
  events: StockEventSample[];
  /** Prefer events that share this unit; mismatched event units invalidate consumption estimate. */
  eventUnitsConsistent: boolean;
  now?: Date;
};

export type ForecastConfidence = "none" | "low" | "medium" | "high";

export type RunoutForecast = {
  supplyId: string;
  name: string;
  projectedDaysRemaining: number | null;
  confidence: ForecastConfidence;
  purchaseOrRestockCount: number;
  avgDailyConsumption: number | null;
  explanation: string | null;
  reasonCodes: string[];
  formulaVersion: typeof FORECAST_FORMULA_VERSION;
  belowThreshold: boolean;
  isOut: boolean;
};

function daysBetween(a: Date, b: Date): number {
  return Math.max(0.25, (b.getTime() - a.getTime()) / 86400000);
}

/**
 * Estimate average daily consumption from restock/use/count history.
 * Uses absolute downward deltas between chronological samples when available.
 */
export function estimateAvgDailyConsumption(
  events: readonly StockEventSample[],
  now: Date,
): { avgDaily: number | null; sampleCount: number; confidence: ForecastConfidence } {
  const usable = events
    .filter(
      (e) =>
        e.newQuantity != null &&
        Number.isFinite(e.newQuantity) &&
        ["restocked", "used", "counted", "adjusted", "corrected", "finished"].includes(
          e.eventType,
        ),
    )
    .map((e) => ({
      ...e,
      at: new Date(e.createdAt),
      qty: Number(e.newQuantity),
    }))
    .filter((e) => !Number.isNaN(e.at.getTime()))
    .sort((a, b) => a.at.getTime() - b.at.getTime());

  if (usable.length < 2) {
    return { avgDaily: null, sampleCount: usable.length, confidence: "none" };
  }

  let consumed = 0;
  let spanDays = 0;
  for (let i = 1; i < usable.length; i++) {
    const prev = usable[i - 1]!;
    const cur = usable[i]!;
    const drop = prev.qty - cur.qty;
    if (drop > 0) {
      consumed += drop;
      spanDays += daysBetween(prev.at, cur.at);
    } else if (drop < 0) {
      // Restock: keep span from previous consumption window endpoint
      spanDays += daysBetween(prev.at, cur.at);
    }
  }

  // Extend span to now from last observation if we have consumption
  const last = usable[usable.length - 1]!;
  spanDays += daysBetween(last.at, now);

  if (consumed <= 0 || spanDays < 1) {
    return {
      avgDaily: null,
      sampleCount: usable.length,
      confidence: usable.length >= 3 ? "low" : "none",
    };
  }

  const avgDaily = consumed / spanDays;
  const confidence: ForecastConfidence =
    usable.length >= 5 && spanDays >= 14
      ? "high"
      : usable.length >= 3 && spanDays >= 7
        ? "medium"
        : "low";

  return { avgDaily, sampleCount: usable.length, confidence };
}

export function projectRunout(input: ForecastInput): RunoutForecast {
  const now = input.now ?? new Date();
  const qty = input.currentQuantity;
  const isOut =
    input.stockState === "out" || (qty != null && qty <= 0);
  const belowThreshold =
    input.reorderThreshold != null &&
    qty != null &&
    qty <= input.reorderThreshold;

  const base: RunoutForecast = {
    supplyId: input.supplyId,
    name: input.name,
    projectedDaysRemaining: null,
    confidence: "none",
    purchaseOrRestockCount: input.events.filter((e) => e.eventType === "restocked")
      .length,
    avgDailyConsumption: null,
    explanation: null,
    reasonCodes: [],
    formulaVersion: FORECAST_FORMULA_VERSION,
    belowThreshold,
    isOut,
  };

  if (isOut) {
    return {
      ...base,
      projectedDaysRemaining: 0,
      confidence: "high",
      explanation: "Currently marked out.",
      reasonCodes: ["supply_out"],
    };
  }

  if (!input.eventUnitsConsistent) {
    return {
      ...base,
      explanation: belowThreshold
        ? "Below the household restock threshold. Runout estimate unavailable (unit mismatch)."
        : null,
      reasonCodes: belowThreshold
        ? ["supply_below_threshold", "forecast_unit_mismatch"]
        : ["forecast_unit_mismatch"],
    };
  }

  if (qty == null || !Number.isFinite(qty)) {
    return {
      ...base,
      explanation: belowThreshold
        ? "Below the household restock threshold. Quantity is approximate."
        : null,
      reasonCodes: belowThreshold ? ["supply_below_threshold"] : [],
    };
  }

  const { avgDaily, sampleCount, confidence } = estimateAvgDailyConsumption(
    input.events,
    now,
  );
  base.purchaseOrRestockCount = Math.max(base.purchaseOrRestockCount, sampleCount);
  base.avgDailyConsumption = avgDaily;
  base.confidence = confidence;

  if (avgDaily == null || avgDaily <= 0 || confidence === "none") {
    return {
      ...base,
      explanation: belowThreshold
        ? "Below the household restock threshold."
        : sampleCount > 0
          ? `Not enough consistent history for a runout estimate (need more restocks; have ${sampleCount}).`
          : null,
      reasonCodes: belowThreshold
        ? ["supply_below_threshold"]
        : sampleCount > 0
          ? ["forecast_insufficient_history"]
          : [],
    };
  }

  const days = Math.round(qty / avgDaily);
  base.projectedDaysRemaining = Math.max(0, days);
  base.reasonCodes = ["supply_runout_forecast"];
  base.explanation = `Projected to run out in about ${days} days. Estimate based on ${sampleCount} recorded stock changes.`;

  if (belowThreshold && !base.reasonCodes.includes("supply_below_threshold")) {
    base.reasonCodes = ["supply_below_threshold", ...base.reasonCodes];
  }

  return base;
}

export function confidenceMeetsThreshold(
  confidence: ForecastConfidence,
  threshold: "low" | "medium" | "high",
): boolean {
  const rank = { none: 0, low: 1, medium: 2, high: 3 } as const;
  return rank[confidence] >= rank[threshold];
}
