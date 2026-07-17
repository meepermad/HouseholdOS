import type { QuantityUnit } from "@/lib/house/types";
import { addQuantities, compareQuantities } from "@/lib/house/quantity";
import type { ShortfallResult } from "./shortfall";
import type { ShoppingPrepPolicy } from "./types";
import { DEFAULT_SHOPPING_PREP_POLICY } from "./types";

export type ActiveShoppingItem = {
  id: string;
  name: string;
  quantity: string | null;
  unit: QuantityUnit;
  status: string;
  relatedRecipeIngredientId: string | null;
  relatedMealPlanId: string | null;
};

export type ShoppingPrepAction =
  | { kind: "none" }
  | { kind: "create"; quantity: string | null; unit: QuantityUnit; name: string }
  | {
      kind: "update";
      shoppingItemId: string;
      quantity: string | null;
      unit: QuantityUnit;
    }
  | { kind: "preserve_purchased"; shoppingItemId: string };

export type ShoppingPrepLine = ShortfallResult & {
  action: ShoppingPrepAction;
  excluded: boolean;
  substituteName: string | null;
  alreadyOnList: boolean;
};

export type ShoppingPrepProposal = {
  policy: ShoppingPrepPolicy;
  lines: ShoppingPrepLine[];
  /** True when policy would write shopping immediately after accept. */
  appliesAutomatically: boolean;
  /** True when UI should show one-step confirmation. */
  requiresConfirmation: boolean;
};

const ACTIVE = new Set([
  "requested",
  "approved",
  "assigned",
  "in_cart",
]);

export function isPurchasedStatus(status: string): boolean {
  return status === "purchased";
}

export function isActiveShoppingStatus(status: string): boolean {
  return ACTIVE.has(status);
}

/**
 * Consolidate shortfalls with existing shopping rows.
 * Never proposes delete/cancel of purchased items.
 */
export function buildShoppingPrepLines(
  shortfalls: readonly ShortfallResult[],
  activeShopping: readonly ActiveShoppingItem[],
  opts: {
    excludedIngredientIds?: ReadonlySet<string>;
    substitutions?: ReadonlyMap<string, string>;
    quantityOverrides?: ReadonlyMap<string, string>;
  } = {},
): ShoppingPrepLine[] {
  return shortfalls.map((sf) => {
    const excluded =
      opts.excludedIngredientIds?.has(sf.ingredientId) === true ||
      !sf.includeInShoppingByDefault;
    const substitute = opts.substitutions?.get(sf.ingredientId) ?? null;
    const qtyOverride = opts.quantityOverrides?.get(sf.ingredientId);
    const quantity = qtyOverride ?? sf.shortfallQuantity;
    const name = substitute ?? sf.displayName;

    const linked = activeShopping.find(
      (s) => s.relatedRecipeIngredientId === sf.ingredientId,
    );
    const purchased = activeShopping.find(
      (s) =>
        s.relatedRecipeIngredientId === sf.ingredientId &&
        isPurchasedStatus(s.status),
    );

    if (purchased) {
      return {
        ...sf,
        lineStatus: "already_on_shopping_list",
        action: {
          kind: "preserve_purchased",
          shoppingItemId: purchased.id,
        },
        excluded: true,
        substituteName: substitute,
        alreadyOnList: true,
      };
    }

    if (sf.lineStatus === "available" || sf.lineStatus === "optional") {
      return {
        ...sf,
        action: { kind: "none" },
        excluded: true,
        substituteName: substitute,
        alreadyOnList: false,
      };
    }

    if (linked && isActiveShoppingStatus(linked.status)) {
      const nextQty =
        quantity && linked.quantity && linked.unit === sf.unit
          ? compareQuantities(quantity, linked.quantity) > 0
            ? quantity
            : linked.quantity
          : quantity ?? linked.quantity;
      return {
        ...sf,
        lineStatus: "already_on_shopping_list",
        shortfallQuantity: nextQty,
        action: excluded
          ? { kind: "none" }
          : {
              kind: "update",
              shoppingItemId: linked.id,
              quantity: nextQty,
              unit: sf.unit,
            },
        excluded,
        substituteName: substitute,
        alreadyOnList: true,
      };
    }

    // Compatible name+unit consolidation with unrelated active request
    const compatible = activeShopping.find(
      (s) =>
        isActiveShoppingStatus(s.status) &&
        s.name.toLowerCase() === name.toLowerCase() &&
        s.unit === sf.unit &&
        !s.relatedRecipeIngredientId,
    );
    if (compatible && quantity && compatible.quantity) {
      const combined = addQuantities(compatible.quantity, quantity);
      return {
        ...sf,
        shortfallQuantity: combined,
        action: excluded
          ? { kind: "none" }
          : {
              kind: "update",
              shoppingItemId: compatible.id,
              quantity: combined,
              unit: sf.unit,
            },
        excluded,
        substituteName: substitute,
        alreadyOnList: true,
      };
    }

    if (
      sf.lineStatus === "needs_unit_review" ||
      sf.unresolved && sf.lineStatus === "probably_available"
    ) {
      return {
        ...sf,
        action: excluded
          ? { kind: "none" }
          : {
              kind: "create",
              quantity,
              unit: sf.unit,
              name,
            },
        excluded: excluded || sf.lineStatus === "needs_unit_review",
        substituteName: substitute,
        alreadyOnList: false,
      };
    }

    return {
      ...sf,
      action: excluded
        ? { kind: "none" }
        : {
            kind: "create",
            quantity,
            unit: sf.unit,
            name,
          },
      excluded,
      substituteName: substitute,
      alreadyOnList: false,
    };
  });
}

export function applyShoppingPrepPolicy(
  policy: ShoppingPrepPolicy = DEFAULT_SHOPPING_PREP_POLICY,
  lines: ShoppingPrepLine[],
): ShoppingPrepProposal {
  return {
    policy,
    lines,
    appliesAutomatically: policy === "automatic_on_acceptance",
    requiresConfirmation:
      policy === "suggest_and_confirm" || policy === "manual",
  };
}

/**
 * Recalculate proposal when servings/attendance change.
 * Purchased linked items are preserved (action preserve_purchased / never delete).
 */
export function recalculateShoppingPrep(args: {
  shortfalls: readonly ShortfallResult[];
  activeShopping: readonly ActiveShoppingItem[];
  policy?: ShoppingPrepPolicy;
  excludedIngredientIds?: ReadonlySet<string>;
  substitutions?: ReadonlyMap<string, string>;
  quantityOverrides?: ReadonlyMap<string, string>;
}): ShoppingPrepProposal {
  const lines = buildShoppingPrepLines(args.shortfalls, args.activeShopping, {
    excludedIngredientIds: args.excludedIngredientIds,
    substitutions: args.substitutions,
    quantityOverrides: args.quantityOverrides,
  });
  return applyShoppingPrepPolicy(
    args.policy ?? DEFAULT_SHOPPING_PREP_POLICY,
    lines,
  );
}

/** Lines that would mutate shopping when confirmed / auto-applied. */
export function actionableShoppingLines(
  proposal: ShoppingPrepProposal,
): ShoppingPrepLine[] {
  return proposal.lines.filter(
    (l) =>
      !l.excluded &&
      (l.action.kind === "create" || l.action.kind === "update"),
  );
}

export function assertNeverDeletesPurchased(
  previous: readonly ActiveShoppingItem[],
  nextActions: readonly ShoppingPrepAction[],
): boolean {
  const purchasedIds = new Set(
    previous.filter((p) => isPurchasedStatus(p.status)).map((p) => p.id),
  );
  for (const action of nextActions) {
    if (action.kind === "none" || action.kind === "create") continue;
    if (
      (action.kind === "update" || action.kind === "preserve_purchased") &&
      purchasedIds.has(action.shoppingItemId)
    ) {
      // update of purchased is not allowed — only preserve
      if (action.kind === "update") return false;
    }
  }
  return true;
}
