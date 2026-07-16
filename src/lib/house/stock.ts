import {
  addQuantities,
  classifySupplyStock,
  parseQuantity,
  quantityToScaled,
} from "./quantity";
import type {
  LeftoverRemainingState,
  StockEventType,
  SupplyStockState,
} from "./types";

export type StockCorrectionInput = {
  expectedQuantity: string;
  actualQuantity: string;
  reason: string;
};

export type StockCorrectionResult = {
  delta: string;
  eventType: StockEventType;
  newQuantity: string;
};

function formatScaled(scaled: bigint): string {
  const neg = scaled < BigInt(0);
  const abs = neg ? -scaled : scaled;
  const whole = abs / BigInt(1000);
  const frac = abs % BigInt(1000);
  const fracStr = frac.toString().padStart(3, "0").replace(/0+$/, "");
  const body = fracStr.length > 0 ? `${whole}.${fracStr}` : `${whole}`;
  return neg ? `-${body}` : body;
}

export function buildStockCorrection(
  input: StockCorrectionInput,
): StockCorrectionResult | { error: string } {
  const expected = parseQuantity(input.expectedQuantity);
  const actual = parseQuantity(input.actualQuantity);
  if (!expected.ok) return { error: expected.error };
  if (!actual.ok) return { error: actual.error };
  if (!input.reason.trim()) {
    return { error: "Correction reason is required" };
  }
  const deltaScaled =
    quantityToScaled(actual.canonical) - quantityToScaled(expected.canonical);
  return {
    delta: formatScaled(deltaScaled),
    eventType: "corrected",
    newQuantity: actual.canonical,
  };
}

export function applyRestock(params: {
  currentQuantity: string | null;
  restockAmount: string;
  unit: string;
  currentUnit: string;
}):
  | { ok: true; newQuantity: string; stockState: SupplyStockState }
  | { ok: false; error: string } {
  if (params.unit !== params.currentUnit) {
    return {
      ok: false,
      error: `Cannot convert between units ${params.currentUnit} and ${params.unit}`,
    };
  }
  const amount = parseQuantity(params.restockAmount);
  if (!amount.ok) return { ok: false, error: amount.error };
  const base = params.currentQuantity ?? "0";
  const baseParsed = parseQuantity(base);
  if (!baseParsed.ok) return { ok: false, error: baseParsed.error };
  const newQuantity = addQuantities(baseParsed.canonical, amount.canonical);
  const stockState = classifySupplyStock({
    quantity: newQuantity,
    reorderThreshold: null,
    explicitState: "in_stock",
  });
  return { ok: true, newQuantity, stockState };
}

export function classifyLeftoverRemaining(
  state: LeftoverRemainingState,
): LeftoverRemainingState {
  return state;
}

export function isOpenStockState(state: SupplyStockState): boolean {
  return state === "in_stock" || state === "low" || state === "unknown";
}

/**
 * Idempotent restock suggestion: do not create a new request when one is active.
 */
export function shouldCreateRestockRequest(params: {
  stockState: SupplyStockState;
  restockPolicy: "manual" | "suggest" | "automatic";
  hasActiveShoppingRequest: boolean;
}): "none" | "suggest" | "create" {
  if (params.stockState !== "low" && params.stockState !== "out") {
    return "none";
  }
  if (params.hasActiveShoppingRequest) return "none";
  if (params.restockPolicy === "manual") return "none";
  if (params.restockPolicy === "suggest") return "suggest";
  return "create";
}
