/**
 * Pure helpers for when recommendation context should be recalculated.
 * Never auto-replace an accepted meal plan recipe.
 */

export type RecommendationRecalcTrigger =
  | "attendance"
  | "guest_count"
  | "serving_target"
  | "pantry_stock"
  | "shopping_purchase"
  | "required_constraints"
  | "recommendation_mode"
  | "meal_time_limit"
  | "recipe_feedback"
  | "recipe_archive_status";

export const MATERIAL_RECALC_TRIGGERS: readonly RecommendationRecalcTrigger[] = [
  "attendance",
  "guest_count",
  "serving_target",
  "pantry_stock",
  "shopping_purchase",
  "required_constraints",
  "recommendation_mode",
  "meal_time_limit",
  "recipe_feedback",
  "recipe_archive_status",
] as const;

export function shouldRecalculateRecommendations(
  trigger: RecommendationRecalcTrigger,
): boolean {
  return (MATERIAL_RECALC_TRIGGERS as readonly string[]).includes(trigger);
}

export type AcceptedPlanRecalcNotice = {
  shouldReplaceRecipe: false;
  message: string;
};

/**
 * For an already-accepted plan, surface a review notice — organizer decides.
 */
export function acceptedPlanRecalcNotice(): AcceptedPlanRecalcNotice {
  return {
    shouldReplaceRecipe: false,
    message:
      "Recommendation inputs changed. Review updated pantry and shopping requirements.",
  };
}
