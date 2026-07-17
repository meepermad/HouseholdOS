import { assertNoPortionOwnership } from "@/lib/house/quantity";
import type {
  MealPlanStatus,
  MealType,
  MealVisibility,
  ShoppingPrepPolicy,
} from "./types";
import { DEFAULT_SHOPPING_PREP_POLICY } from "./types";

export const MEAL_STATUS_TRANSITIONS: Record<
  MealPlanStatus,
  readonly MealPlanStatus[]
> = {
  draft: ["planned", "shopping_needed", "cancelled"],
  planned: ["shopping_needed", "ready", "preparing", "cancelled"],
  shopping_needed: ["ready", "planned", "cancelled"],
  ready: ["preparing", "planned", "cancelled"],
  preparing: ["prepared", "cancelled"],
  prepared: [],
  cancelled: [],
};

export function canTransitionMealStatus(
  from: MealPlanStatus,
  to: MealPlanStatus,
): boolean {
  if (from === to) return true;
  return MEAL_STATUS_TRANSITIONS[from].includes(to);
}

export function defaultVisibilityForMealType(mealType: MealType): MealVisibility {
  switch (mealType) {
    case "personal":
      return "creator_only";
    case "shared_household":
    case "guest_inclusive":
    case "open_household":
    case "meal_prep":
    default:
      return "household";
  }
}

/** Personal meals notify no one by default. */
export function shouldNotifyHouseholdForMeal(mealType: MealType): boolean {
  return mealType !== "personal";
}

export function shouldRequireAttendance(mealType: MealType): boolean {
  return mealType === "shared_household" || mealType === "guest_inclusive";
}

export function shouldAutoCreateChores(mealType: MealType): boolean {
  // Chore creation is always explicit — never automatic for personal.
  return mealType !== "personal";
}

export type FulfillmentPhase =
  | "request_submitted"
  | "ranked"
  | "recipe_accepted"
  | "meal_plan_ready"
  | "shopping_proposed"
  | "shopping_applied";

/**
 * Shopping list mutation is forbidden until a recipe is accepted onto a meal plan.
 */
export function mayMutateShoppingFromRequest(phase: FulfillmentPhase): boolean {
  return (
    phase === "recipe_accepted" ||
    phase === "meal_plan_ready" ||
    phase === "shopping_proposed" ||
    phase === "shopping_applied"
  );
}

export function shouldAutoApplyShopping(
  policy: ShoppingPrepPolicy,
  phase: FulfillmentPhase,
): boolean {
  return (
    policy === "automatic_on_acceptance" &&
    (phase === "recipe_accepted" || phase === "meal_plan_ready")
  );
}

export function resolveShoppingPrepPolicy(
  value: string | null | undefined,
): ShoppingPrepPolicy {
  if (
    value === "manual" ||
    value === "suggest_and_confirm" ||
    value === "automatic_on_acceptance"
  ) {
    return value;
  }
  return DEFAULT_SHOPPING_PREP_POLICY;
}

/** Leftovers / batches must never carry portion memberships. */
export function assertMealBatchHasNoPortions(portionMembershipIds?: readonly string[]) {
  return assertNoPortionOwnership({ portionMembershipIds });
}

export function validateRecipeBasics(input: {
  name: string;
  baseServings: number;
  prepMinutes?: number | null;
  cookMinutes?: number | null;
}): { ok: true } | { ok: false; error: string } {
  const name = input.name.trim();
  if (name.length < 1 || name.length > 200) {
    return { ok: false, error: "Recipe name must be 1–200 characters" };
  }
  if (!Number.isFinite(input.baseServings) || input.baseServings < 1) {
    return { ok: false, error: "Base servings must be at least 1" };
  }
  if (
    input.prepMinutes != null &&
    (!Number.isFinite(input.prepMinutes) || input.prepMinutes < 0)
  ) {
    return { ok: false, error: "Preparation time is invalid" };
  }
  if (
    input.cookMinutes != null &&
    (!Number.isFinite(input.cookMinutes) || input.cookMinutes < 0)
  ) {
    return { ok: false, error: "Cooking time is invalid" };
  }
  return { ok: true };
}

export function totalEstimatedMinutes(
  prep: number | null | undefined,
  cook: number | null | undefined,
): number | null {
  if (prep == null && cook == null) return null;
  return (prep ?? 0) + (cook ?? 0);
}
