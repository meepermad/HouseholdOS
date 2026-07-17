import {
  addQuantities,
  assertSameUnit,
  compareQuantities,
  parseQuantity,
} from "@/lib/house/quantity";
import type { QuantityUnit } from "@/lib/house/types";
import type { QuantityMode } from "./types";

export type ScalableIngredient = {
  id: string;
  displayName: string;
  quantity: string | null;
  unit: QuantityUnit;
  quantityMode: QuantityMode;
  required: boolean;
};

export type ScaledIngredient = ScalableIngredient & {
  baseQuantity: string | null;
  scaledQuantity: string | null;
  scaleFactor: string;
  scaledNumerically: boolean;
};

/**
 * Scale ingredient quantities by targetServings / baseServings.
 * to_taste / as_needed are never scaled numerically.
 */
export function scaleFactor(
  baseServings: number,
  targetServings: number,
): { ok: true; factor: string } | { ok: false; error: string } {
  if (!Number.isFinite(baseServings) || baseServings <= 0) {
    return { ok: false, error: "Base servings must be a positive number" };
  }
  if (!Number.isFinite(targetServings) || targetServings <= 0) {
    return { ok: false, error: "Target servings must be a positive number" };
  }
  const parsedBase = parseQuantity(String(baseServings));
  const parsedTarget = parseQuantity(String(targetServings));
  if (!parsedBase.ok || !parsedTarget.ok) {
    return { ok: false, error: "Servings must be decimal-safe quantities" };
  }
  const factor = divideQuantities(parsedTarget.canonical, parsedBase.canonical);
  if (!factor.ok) return factor;
  return { ok: true, factor: factor.value };
}

function divideQuantities(
  numerator: string,
  denominator: string,
): { ok: true; value: string } | { ok: false; error: string } {
  const n = toScaled(numerator);
  const d = toScaled(denominator);
  if (d === BigInt(0)) return { ok: false, error: "Cannot divide by zero" };
  // (n / d) with 3 decimal places: (n * 1000) / d
  const result = (n * BigInt(1000)) / d;
  return { ok: true, value: fromScaled(result) };
}

function toScaled(canonical: string): bigint {
  const neg = canonical.startsWith("-");
  const text = neg ? canonical.slice(1) : canonical;
  const [w, f = ""] = text.split(".");
  const frac = (f + "000").slice(0, 3);
  const scaled = BigInt(w || "0") * BigInt(1000) + BigInt(frac);
  return neg ? -scaled : scaled;
}

function fromScaled(scaled: bigint): string {
  const neg = scaled < BigInt(0);
  const abs = neg ? -scaled : scaled;
  const whole = abs / BigInt(1000);
  const frac = abs % BigInt(1000);
  const fracStr = frac.toString().padStart(3, "0").replace(/0+$/, "");
  const body = fracStr ? `${whole}.${fracStr}` : whole.toString();
  return neg ? `-${body}` : body;
}

function multiplyQuantity(
  amount: string,
  factor: string,
): { ok: true; value: string } | { ok: false; error: string } {
  const a = toScaled(amount);
  const f = toScaled(factor);
  // (a * f) / 1000 with rounding toward nearest
  const product = a * f;
  const rounded =
    product >= BigInt(0)
      ? (product + BigInt(500)) / BigInt(1000)
      : (product - BigInt(500)) / BigInt(1000);
  return { ok: true, value: fromScaled(rounded) };
}

export function scaleIngredient(
  ingredient: ScalableIngredient,
  factor: string,
): ScaledIngredient {
  const skipNumeric =
    ingredient.quantityMode === "to_taste" ||
    ingredient.quantityMode === "as_needed" ||
    ingredient.quantity === null;

  if (skipNumeric) {
    return {
      ...ingredient,
      baseQuantity: ingredient.quantity,
      scaledQuantity: ingredient.quantity,
      scaleFactor: factor,
      scaledNumerically: false,
    };
  }

  const multiplied = multiplyQuantity(ingredient.quantity!, factor);
  return {
    ...ingredient,
    baseQuantity: ingredient.quantity,
    scaledQuantity: multiplied.ok ? multiplied.value : ingredient.quantity,
    scaleFactor: factor,
    scaledNumerically: multiplied.ok,
  };
}

export function scaleIngredients(
  ingredients: readonly ScalableIngredient[],
  baseServings: number,
  targetServings: number,
):
  | { ok: true; factor: string; ingredients: ScaledIngredient[] }
  | { ok: false; error: string } {
  const factorResult = scaleFactor(baseServings, targetServings);
  if (!factorResult.ok) return factorResult;
  return {
    ok: true,
    factor: factorResult.factor,
    ingredients: ingredients.map((ing) =>
      scaleIngredient(ing, factorResult.factor),
    ),
  };
}

/** Re-export for tests that assert decimal safety via scale path. */
export function decimalSafeScale(
  amount: string,
  baseServings: number,
  targetServings: number,
): string | null {
  const f = scaleFactor(baseServings, targetServings);
  if (!f.ok) return null;
  const m = multiplyQuantity(amount, f.factor);
  return m.ok ? m.value : null;
}

export function canCompareUnits(
  a: QuantityUnit,
  b: QuantityUnit,
): boolean {
  return assertSameUnit(a, b).ok;
}

export function subtractQuantities(
  left: string,
  right: string,
): { ok: true; value: string } | { ok: false; error: string } {
  const l = parseQuantity(left);
  const r = parseQuantity(right);
  if (!l.ok || !r.ok) return { ok: false, error: "Invalid quantity" };
  // left - right via scaled
  const diff = toScaled(l.canonical) - toScaled(r.canonical);
  return { ok: true, value: fromScaled(diff) };
}

export function maxQuantity(
  a: string,
  b: string,
): string {
  return compareQuantities(a, b) >= 0 ? a : b;
}

export { addQuantities, compareQuantities, parseQuantity };
