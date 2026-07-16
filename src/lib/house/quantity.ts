import type { QuantityUnit, SupplyStockState } from "./types";

export const QUANTITY_UNITS = [
  "item",
  "pack",
  "roll",
  "bottle",
  "box",
  "bag",
  "can",
  "jar",
  "ounce",
  "pound",
  "gram",
  "kilogram",
  "milliliter",
  "liter",
  "cup",
  "tablespoon",
  "teaspoon",
  "serving",
  "unknown",
] as const satisfies readonly QuantityUnit[];

export const QUANTITY_UNIT_LABELS: Record<QuantityUnit, string> = {
  item: "item",
  pack: "pack",
  roll: "roll",
  bottle: "bottle",
  box: "box",
  bag: "bag",
  can: "can",
  jar: "jar",
  ounce: "oz",
  pound: "lb",
  gram: "g",
  kilogram: "kg",
  milliliter: "mL",
  liter: "L",
  cup: "cup",
  tablespoon: "tbsp",
  teaspoon: "tsp",
  serving: "serving",
  unknown: "unknown",
};

/** Max 3 decimal places — matches numeric(12,3). */
const QUANTITY_SCALE = BigInt(1000);
const MAX_ABS = BigInt(999999999999); // 12 integer digits before scale consideration

export type QuantityValue = {
  /** Fixed-point quantity as string with up to 3 decimals, or null when unknown. */
  amount: string | null;
  unit: QuantityUnit;
  isApproximate: boolean;
};

export function isQuantityUnit(value: string): value is QuantityUnit {
  return (QUANTITY_UNITS as readonly string[]).includes(value);
}

/**
 * Parse a quantity string into a canonical fixed-decimal representation.
 * Rejects binary-float coercion by accepting only digit strings.
 */
export function parseQuantity(raw: string | number | null | undefined): {
  ok: true;
  canonical: string;
} | {
  ok: false;
  error: string;
} {
  if (raw === null || raw === undefined || raw === "") {
    return { ok: false, error: "Quantity is required" };
  }
  const text = typeof raw === "number" ? String(raw) : raw.trim();
  if (!/^-?\d+(\.\d{1,3})?$/.test(text)) {
    return {
      ok: false,
      error: "Quantity must be a decimal with at most 3 places",
    };
  }
  const negative = text.startsWith("-");
  const [wholePart, fracPart = ""] = (negative ? text.slice(1) : text).split(
    ".",
  );
  const whole = BigInt(wholePart || "0");
  const fracPadded = (fracPart + "000").slice(0, 3);
  const frac = BigInt(fracPadded);
  const scaled = whole * QUANTITY_SCALE + frac;
  if (scaled > MAX_ABS) {
    return { ok: false, error: "Quantity is too large" };
  }
  const signed = negative ? -scaled : scaled;
  return { ok: true, canonical: formatScaled(signed) };
}

function formatScaled(scaled: bigint): string {
  const neg = scaled < BigInt(0);
  const abs = neg ? -scaled : scaled;
  const whole = abs / QUANTITY_SCALE;
  const frac = abs % QUANTITY_SCALE;
  const fracStr = frac.toString().padStart(3, "0").replace(/0+$/, "");
  const body = fracStr.length > 0 ? `${whole}.${fracStr}` : `${whole}`;
  return neg ? `-${body}` : body;
}

export function quantityToScaled(canonical: string): bigint {
  const parsed = parseQuantity(canonical);
  if (!parsed.ok) throw new Error(parsed.error);
  const negative = parsed.canonical.startsWith("-");
  const [wholePart, fracPart = ""] = (
    negative ? parsed.canonical.slice(1) : parsed.canonical
  ).split(".");
  const whole = BigInt(wholePart || "0");
  const frac = BigInt((fracPart + "000").slice(0, 3));
  const scaled = whole * QUANTITY_SCALE + frac;
  return negative ? -scaled : scaled;
}

export function compareQuantities(a: string, b: string): number {
  const sa = quantityToScaled(a);
  const sb = quantityToScaled(b);
  if (sa < sb) return -1;
  if (sa > sb) return 1;
  return 0;
}

export function addQuantities(a: string, b: string): string {
  return formatScaled(quantityToScaled(a) + quantityToScaled(b));
}

/**
 * Never convert between incompatible units. Same unit only.
 */
export function assertSameUnit(
  from: QuantityUnit,
  to: QuantityUnit,
): { ok: true } | { ok: false; error: string } {
  if (from === to) return { ok: true };
  return {
    ok: false,
    error: `Cannot convert between units ${from} and ${to}`,
  };
}

export function classifySupplyStock(params: {
  quantity: string | null;
  reorderThreshold: string | null;
  explicitState?: SupplyStockState | null;
}): SupplyStockState {
  if (params.explicitState && params.explicitState !== "unknown") {
    return params.explicitState;
  }
  if (params.quantity === null || params.quantity === undefined) {
    return params.explicitState ?? "unknown";
  }
  const qty = quantityToScaled(params.quantity);
  if (qty <= BigInt(0)) return "out";
  if (
    params.reorderThreshold !== null &&
    params.reorderThreshold !== undefined
  ) {
    const threshold = quantityToScaled(params.reorderThreshold);
    if (qty <= threshold) return "low";
  }
  return "in_stock";
}

export function formatQuantityLabel(params: {
  amount: string | null;
  unit: QuantityUnit;
  isApproximate?: boolean;
}): string {
  if (params.amount === null) {
    return params.isApproximate ? "Approximate · unknown" : "Unknown quantity";
  }
  const unitLabel = QUANTITY_UNIT_LABELS[params.unit];
  const prefix = params.isApproximate ? "About " : "";
  return `${prefix}${params.amount} ${unitLabel}`;
}

/** Guest accounts are never part of pantry ownership. */
export function assertGuestFreePantryModel(params: {
  ownerMembershipId: string | null;
  guestIds?: readonly string[];
}): { ok: true } | { ok: false; error: string } {
  if (params.guestIds && params.guestIds.length > 0) {
    return {
      ok: false,
      error: "Pantry items cannot be owned by guests",
    };
  }
  return { ok: true };
}

/** Leftovers are shared-item level only — no portion members. */
export function assertNoPortionOwnership(params: {
  portionMembershipIds?: readonly string[];
}): { ok: true } | { ok: false; error: string } {
  if (params.portionMembershipIds && params.portionMembershipIds.length > 0) {
    return {
      ok: false,
      error: "Leftover portions cannot be assigned to members",
    };
  }
  return { ok: true };
}
