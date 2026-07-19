/**
 * Pure builder for Forgotten Favorite → missing-ingredient shopping proposals.
 * Always recalculates against current pantry + list; never trusts suggestion snapshot alone.
 */

import type { QuantityUnit } from "@/lib/house/types";
import {
  matchIngredients,
  type AuthorizedPantryItem,
  type IngredientMatchInput,
} from "@/lib/meals/match";
import { calculateShortfalls } from "@/lib/meals/shortfall";
import {
  buildShoppingPrepLines,
  type ActiveShoppingItem,
  type ShoppingPrepLine,
} from "@/lib/meals/shopping-prep";
import { canonicalShoppingKey } from "@/lib/shopping/recommendations/normalize";

export type RediscoveryIngredientInput = {
  id: string;
  displayName: string;
  quantity: string | null;
  unit: QuantityUnit;
  quantityMode: "exact" | "optional" | "approximate" | "to_taste" | "as_needed";
  required: boolean;
};

export type MissingIngredientProposalLine = {
  recipeIngredientId: string;
  displayName: string;
  required: boolean;
  requiredQuantity: string | null;
  shortfallQuantity: string | null;
  quantityUnit: string;
  lineStatus: string;
  unitMismatch: boolean;
  excluded: boolean;
  alreadyOnList: boolean;
  existingListItemId: string | null;
  explanation: string;
};

export type MissingIngredientProposal = {
  lines: MissingIngredientProposalLine[];
  actionableCount: number;
  policyNote: "review_first";
};

function toProposalLine(line: ShoppingPrepLine): MissingIngredientProposalLine {
  return {
    recipeIngredientId: line.ingredientId,
    displayName: line.displayName,
    required: line.includeInShoppingByDefault || line.lineStatus !== "optional",
    requiredQuantity: line.requiredQuantity,
    shortfallQuantity: line.shortfallQuantity,
    quantityUnit: line.unit,
    lineStatus: line.lineStatus,
    unitMismatch: line.unresolved || line.lineStatus === "needs_unit_review",
    excluded: line.excluded,
    alreadyOnList: line.alreadyOnList,
    existingListItemId:
      line.action.kind === "update" || line.action.kind === "preserve_purchased"
        ? line.action.shoppingItemId
        : line.action.kind === "create"
          ? null
          : null,
    explanation:
      line.lineStatus === "needs_unit_review"
        ? "Unit needs review before adding."
        : line.alreadyOnList
          ? "Already on the shopping list; quantity may be increased if shortfall is higher."
          : line.lineStatus === "missing" ||
              line.lineStatus === "insufficient_quantity"
            ? "Missing or insufficient in authorized pantry."
            : line.lineStatus,
  };
}

/**
 * Build a reviewable missing-ingredient proposal for a rediscovered recipe.
 * Rediscovery stays review-first regardless of household meal shopping-prep policy.
 */
export function buildRediscoveryMissingIngredientProposal(params: {
  ingredients: readonly RediscoveryIngredientInput[];
  pantry: readonly AuthorizedPantryItem[];
  activeShopping: readonly ActiveShoppingItem[];
  includeOptional?: boolean;
}): MissingIngredientProposal {
  const matchInputs: IngredientMatchInput[] = params.ingredients.map((ing) => ({
    id: ing.id,
    displayName: ing.displayName,
    quantity: ing.quantity,
    unit: ing.unit,
    quantityMode: ing.quantityMode,
    required: ing.required || params.includeOptional === true,
  }));

  const matches = matchIngredients(matchInputs, params.pantry, {
    assumeStaplesAvailable: true,
  });

  const shortfalls = calculateShortfalls(
    params.ingredients.map((ing) => ({
      id: ing.id,
      displayName: ing.displayName,
      scaledQuantity: ing.quantity,
      unit: ing.unit,
      quantityMode: ing.quantityMode,
      required: ing.required,
      selectedOptional: params.includeOptional === true && !ing.required,
    })),
    matches,
  );

  const lines = buildShoppingPrepLines(shortfalls, params.activeShopping).map(
    toProposalLine,
  );

  // Deduplicate by normalized name preferring required missing lines
  const seen = new Map<string, MissingIngredientProposalLine>();
  for (const line of lines) {
    const key = canonicalShoppingKey(line.displayName);
    const prev = seen.get(key);
    if (!prev) {
      seen.set(key, line);
      continue;
    }
    const prevActionable =
      !prev.excluded &&
      ["missing", "insufficient_quantity", "needs_unit_review"].includes(
        prev.lineStatus,
      );
    const nextActionable =
      !line.excluded &&
      ["missing", "insufficient_quantity", "needs_unit_review"].includes(
        line.lineStatus,
      );
    if (nextActionable && !prevActionable) seen.set(key, line);
  }

  const deduped = [...seen.values()];
  const actionableCount = deduped.filter(
    (l) =>
      !l.excluded &&
      ["missing", "insufficient_quantity", "needs_unit_review"].includes(
        l.lineStatus,
      ),
  ).length;

  return {
    lines: deduped,
    actionableCount,
    policyNote: "review_first",
  };
}
