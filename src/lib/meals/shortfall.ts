import type { QuantityUnit } from "@/lib/house/types";
import type { IngredientMatchResult } from "./match";
import { subtractQuantities } from "./scale";
import type { QuantityMode, ShoppingPrepLineStatus } from "./types";

export type ShortfallIngredient = {
  id: string;
  displayName: string;
  scaledQuantity: string | null;
  unit: QuantityUnit;
  quantityMode: QuantityMode;
  required: boolean;
  selectedOptional?: boolean;
};

export type ShortfallResult = {
  ingredientId: string;
  displayName: string;
  requiredQuantity: string | null;
  unit: QuantityUnit;
  pantryCoveredQuantity: string | null;
  shortfallQuantity: string | null;
  unresolved: boolean;
  lineStatus: ShoppingPrepLineStatus;
  matchStatus: IngredientMatchResult["status"];
  includeInShoppingByDefault: boolean;
};

function toLineStatus(
  match: IngredientMatchResult,
  ingredient: ShortfallIngredient,
): ShoppingPrepLineStatus {
  if (!ingredient.required && !ingredient.selectedOptional) {
    return "optional";
  }
  switch (match.status) {
    case "available":
    case "assumed_available":
      return "available";
    case "probably_available":
    case "quantity_unknown":
    case "use_soon":
      return "probably_available";
    case "low":
      return "insufficient_quantity";
    case "missing":
    case "optional_missing":
      return "missing";
    case "unit_mismatch":
      return "needs_unit_review";
    case "personal_unavailable":
      return "unavailable_personal_item";
    default:
      return "missing";
  }
}

/**
 * Calculate pantry shortfall for a scaled ingredient given its match result.
 * Unit mismatches remain unresolved (no invented conversions).
 */
export function calculateShortfall(
  ingredient: ShortfallIngredient,
  match: IngredientMatchResult,
): ShortfallResult {
  const lineStatus = toLineStatus(match, ingredient);
  const optionalExcluded =
    !ingredient.required && !ingredient.selectedOptional;

  if (optionalExcluded) {
    return {
      ingredientId: ingredient.id,
      displayName: ingredient.displayName,
      requiredQuantity: ingredient.scaledQuantity,
      unit: ingredient.unit,
      pantryCoveredQuantity: match.coveredQuantity,
      shortfallQuantity: null,
      unresolved: false,
      lineStatus: "optional",
      matchStatus: match.status,
      includeInShoppingByDefault: false,
    };
  }

  if (
    match.status === "available" ||
    match.status === "assumed_available" ||
    match.status === "use_soon"
  ) {
    return {
      ingredientId: ingredient.id,
      displayName: ingredient.displayName,
      requiredQuantity: ingredient.scaledQuantity,
      unit: ingredient.unit,
      pantryCoveredQuantity: match.coveredQuantity,
      shortfallQuantity: null,
      unresolved: false,
      lineStatus,
      matchStatus: match.status,
      includeInShoppingByDefault: false,
    };
  }

  if (
    match.status === "unit_mismatch" ||
    match.status === "quantity_unknown" ||
    match.status === "probably_available"
  ) {
    return {
      ingredientId: ingredient.id,
      displayName: ingredient.displayName,
      requiredQuantity: ingredient.scaledQuantity,
      unit: ingredient.unit,
      pantryCoveredQuantity: match.coveredQuantity,
      shortfallQuantity: null,
      unresolved: true,
      lineStatus,
      matchStatus: match.status,
      includeInShoppingByDefault: match.status === "unit_mismatch",
    };
  }

  if (match.status === "personal_unavailable") {
    return {
      ingredientId: ingredient.id,
      displayName: ingredient.displayName,
      requiredQuantity: ingredient.scaledQuantity,
      unit: ingredient.unit,
      pantryCoveredQuantity: null,
      shortfallQuantity: ingredient.scaledQuantity,
      unresolved: false,
      lineStatus: "unavailable_personal_item",
      matchStatus: match.status,
      includeInShoppingByDefault: true,
    };
  }

  if (match.status === "missing" || match.status === "optional_missing") {
    return {
      ingredientId: ingredient.id,
      displayName: ingredient.displayName,
      requiredQuantity: ingredient.scaledQuantity,
      unit: ingredient.unit,
      pantryCoveredQuantity: null,
      shortfallQuantity: ingredient.scaledQuantity,
      unresolved: ingredient.scaledQuantity === null,
      lineStatus:
        match.status === "optional_missing" ? "optional" : "missing",
      matchStatus: match.status,
      includeInShoppingByDefault: match.status === "missing",
    };
  }

  // low — compute shortfall when both quantities known and same unit
  if (
    match.status === "low" &&
    ingredient.scaledQuantity &&
    match.coveredQuantity
  ) {
    const diff = subtractQuantities(
      ingredient.scaledQuantity,
      match.coveredQuantity,
    );
    const shortfall =
      diff.ok && !diff.value.startsWith("-") && diff.value !== "0"
        ? diff.value
        : ingredient.scaledQuantity;
    return {
      ingredientId: ingredient.id,
      displayName: ingredient.displayName,
      requiredQuantity: ingredient.scaledQuantity,
      unit: ingredient.unit,
      pantryCoveredQuantity: match.coveredQuantity,
      shortfallQuantity: shortfall,
      unresolved: !diff.ok,
      lineStatus: "insufficient_quantity",
      matchStatus: match.status,
      includeInShoppingByDefault: true,
    };
  }

  return {
    ingredientId: ingredient.id,
    displayName: ingredient.displayName,
    requiredQuantity: ingredient.scaledQuantity,
    unit: ingredient.unit,
    pantryCoveredQuantity: match.coveredQuantity,
    shortfallQuantity: ingredient.scaledQuantity,
    unresolved: true,
    lineStatus,
    matchStatus: match.status,
    includeInShoppingByDefault: lineStatus === "missing" || lineStatus === "insufficient_quantity",
  };
}

export function calculateShortfalls(
  ingredients: readonly ShortfallIngredient[],
  matches: readonly IngredientMatchResult[],
): ShortfallResult[] {
  const byId = new Map(matches.map((m) => [m.ingredientId, m]));
  return ingredients.map((ing) => {
    const match = byId.get(ing.id) ?? {
      ingredientId: ing.id,
      status: "missing" as const,
      pantryItemId: null,
      explanation: "No match",
      coveredQuantity: null,
    };
    return calculateShortfall(ing, match);
  });
}
