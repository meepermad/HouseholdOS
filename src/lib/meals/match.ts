import { compareQuantities } from "@/lib/house/quantity";
import type { QuantityUnit } from "@/lib/house/types";
import {
  buildAliasTable,
  namesMatch,
  type AliasTable,
} from "./normalize";
import { canCompareUnits } from "./scale";
import type { PantryMatchStatus, QuantityMode } from "./types";

export type AuthorizedPantryItem = {
  id: string;
  name: string;
  normalizedName?: string | null;
  quantity: string | null;
  unit: QuantityUnit;
  quantityIsApproximate: boolean;
  state: string;
  useSoonAt?: string | null;
  communalAvailable: boolean;
  ownershipMode: string;
  /** True when viewer is allowed to use this item for the meal. */
  usableByViewer: boolean;
  /** True when a match exists but details must stay private. */
  privateUnavailable?: boolean;
  isStaple?: boolean;
};

export type IngredientMatchInput = {
  id: string;
  displayName: string;
  normalizedName?: string;
  quantity: string | null;
  unit: QuantityUnit;
  quantityMode: QuantityMode;
  required: boolean;
};

export type IngredientMatchResult = {
  ingredientId: string;
  status: PantryMatchStatus;
  pantryItemId: string | null;
  explanation: string;
  coveredQuantity: string | null;
};

export type MatchOptions = {
  aliases?: AliasTable;
  assumeStaplesAvailable?: boolean;
  today?: string; // YYYY-MM-DD
};

function isUseSoonState(item: AuthorizedPantryItem, today?: string): boolean {
  if (item.state === "use_soon") return true;
  if (!item.useSoonAt || !today) return false;
  return item.useSoonAt <= today;
}

/**
 * Match a single recipe ingredient against authorized pantry projections.
 * Never reveals private pantry owner or quantities for unauthorized items.
 */
export function matchIngredient(
  ingredient: IngredientMatchInput,
  pantry: readonly AuthorizedPantryItem[],
  options: MatchOptions = {},
): IngredientMatchResult {
  const aliases = options.aliases ?? buildAliasTable();
  const name = ingredient.normalizedName ?? ingredient.displayName;

  // Private unavailable shadow match (authorized projection only signals existence)
  const privateHit = pantry.find(
    (p) => p.privateUnavailable && namesMatch(name, p.name, aliases),
  );
  if (privateHit) {
    return {
      ingredientId: ingredient.id,
      status: "personal_unavailable",
      pantryItemId: null,
      explanation:
        "A matching item may exist, but it is not available for this meal.",
      coveredQuantity: null,
    };
  }

  if (
    options.assumeStaplesAvailable &&
    pantry.some(
      (p) =>
        p.isStaple &&
        p.usableByViewer &&
        namesMatch(name, p.normalizedName || p.name, aliases),
    )
  ) {
    return {
      ingredientId: ingredient.id,
      status: "assumed_available",
      pantryItemId:
        pantry.find(
          (p) =>
            p.isStaple &&
            namesMatch(name, p.normalizedName || p.name, aliases),
        )?.id ?? null,
      explanation: "Treated as a household staple (assumed available).",
      coveredQuantity: null,
    };
  }

  const candidates = pantry.filter(
    (p) =>
      !p.privateUnavailable &&
      p.usableByViewer &&
      namesMatch(name, p.normalizedName || p.name, aliases),
  );

  if (candidates.length === 0) {
    if (!ingredient.required || ingredient.quantityMode === "optional") {
      return {
        ingredientId: ingredient.id,
        status: "optional_missing",
        pantryItemId: null,
        explanation: "Optional ingredient is not in the pantry.",
        coveredQuantity: null,
      };
    }
    return {
      ingredientId: ingredient.id,
      status: "missing",
      pantryItemId: null,
      explanation: "No authorized usable pantry match exists.",
      coveredQuantity: null,
    };
  }

  const sameUnit = candidates.find((c) => canCompareUnits(c.unit, ingredient.unit));
  if (!sameUnit) {
    return {
      ingredientId: ingredient.id,
      status: "unit_mismatch",
      pantryItemId: candidates[0]!.id,
      explanation:
        "A likely match exists, but quantities cannot be safely compared.",
      coveredQuantity: null,
    };
  }

  if (isUseSoonState(sameUnit, options.today)) {
    return {
      ingredientId: ingredient.id,
      status: "use_soon",
      pantryItemId: sameUnit.id,
      explanation: "Ingredient exists and should be used soon.",
      coveredQuantity: sameUnit.quantity,
    };
  }

  if (sameUnit.quantity === null || ingredient.quantity === null) {
    if (sameUnit.state === "low") {
      return {
        ingredientId: ingredient.id,
        status: "low",
        pantryItemId: sameUnit.id,
        explanation: "Ingredient exists but may not be sufficient.",
        coveredQuantity: sameUnit.quantity,
      };
    }
    if (sameUnit.quantityIsApproximate || sameUnit.quantity === null) {
      return {
        ingredientId: ingredient.id,
        status: "probably_available",
        pantryItemId: sameUnit.id,
        explanation:
          "A matching item exists, but quantity is approximate or unknown.",
        coveredQuantity: sameUnit.quantity,
      };
    }
    return {
      ingredientId: ingredient.id,
      status: "quantity_unknown",
      pantryItemId: sameUnit.id,
      explanation: "Availability is known, but adequacy cannot be determined.",
      coveredQuantity: sameUnit.quantity,
    };
  }

  const cmp = compareQuantities(sameUnit.quantity, ingredient.quantity);
  if (cmp < 0 || sameUnit.state === "low") {
    return {
      ingredientId: ingredient.id,
      status: "low",
      pantryItemId: sameUnit.id,
      explanation: "Ingredient exists but may not be sufficient.",
      coveredQuantity: sameUnit.quantity,
    };
  }

  if (sameUnit.quantityIsApproximate) {
    return {
      ingredientId: ingredient.id,
      status: "probably_available",
      pantryItemId: sameUnit.id,
      explanation:
        "A matching item exists, but quantity is approximate or unknown.",
      coveredQuantity: sameUnit.quantity,
    };
  }

  return {
    ingredientId: ingredient.id,
    status: "available",
    pantryItemId: sameUnit.id,
    explanation: "Matching pantry item appears sufficient.",
    coveredQuantity: sameUnit.quantity,
  };
}

export function matchIngredients(
  ingredients: readonly IngredientMatchInput[],
  pantry: readonly AuthorizedPantryItem[],
  options: MatchOptions = {},
): IngredientMatchResult[] {
  return ingredients.map((ing) => matchIngredient(ing, pantry, options));
}
