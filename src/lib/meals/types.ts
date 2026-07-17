/** Phase 6.5 meal / recipe domain types (pure). */

export const RECIPE_CATEGORIES = [
  "breakfast",
  "lunch",
  "dinner",
  "snack",
  "dessert",
  "side",
  "soup_stew",
  "salad",
  "sandwich_wrap",
  "pasta",
  "rice_grain",
  "baked",
  "slow_cooker",
  "grill",
  "meal_prep",
  "other",
] as const;
export type RecipeCategory = (typeof RECIPE_CATEGORIES)[number];

export const RECIPE_VISIBILITIES = [
  "household",
  "creator_only",
  "selected_members",
] as const;
export type RecipeVisibility = (typeof RECIPE_VISIBILITIES)[number];

export const RECIPE_DIFFICULTIES = [
  "easy",
  "medium",
  "hard",
  "unknown",
] as const;
export type RecipeDifficulty = (typeof RECIPE_DIFFICULTIES)[number];

export const QUANTITY_MODES = [
  "exact",
  "approximate",
  "to_taste",
  "as_needed",
  "optional",
] as const;
export type QuantityMode = (typeof QUANTITY_MODES)[number];

export const MEAL_TYPES = [
  "shared_household",
  "guest_inclusive",
  "personal",
  "open_household",
  "meal_prep",
] as const;
export type MealType = (typeof MEAL_TYPES)[number];

export const MEAL_PLAN_STATUSES = [
  "draft",
  "planned",
  "shopping_needed",
  "ready",
  "preparing",
  "prepared",
  "cancelled",
] as const;
export type MealPlanStatus = (typeof MEAL_PLAN_STATUSES)[number];

export const MEAL_ATTENDANCE_STATUSES = [
  "going",
  "maybe",
  "not_going",
  "no_response",
] as const;
export type MealAttendanceStatus = (typeof MEAL_ATTENDANCE_STATUSES)[number];

export const GUEST_COST_POLICIES = [
  "host_covers",
  "participants_share",
  "organizer_covers",
  "excluded_from_split",
  "manual",
] as const;
export type GuestCostPolicy = (typeof GUEST_COST_POLICIES)[number];

export const SHOPPING_PREP_POLICIES = [
  "manual",
  "suggest_and_confirm",
  "automatic_on_acceptance",
] as const;
export type ShoppingPrepPolicy = (typeof SHOPPING_PREP_POLICIES)[number];

export const DEFAULT_SHOPPING_PREP_POLICY: ShoppingPrepPolicy =
  "suggest_and_confirm";

export const PANTRY_MATCH_STATUSES = [
  "available",
  "probably_available",
  "low",
  "use_soon",
  "missing",
  "personal_unavailable",
  "unit_mismatch",
  "quantity_unknown",
  "optional_missing",
  "assumed_available",
] as const;
export type PantryMatchStatus = (typeof PANTRY_MATCH_STATUSES)[number];

export const SHOPPING_PREP_LINE_STATUSES = [
  "available",
  "probably_available",
  "insufficient_quantity",
  "missing",
  "already_on_shopping_list",
  "optional",
  "needs_unit_review",
  "unavailable_personal_item",
] as const;
export type ShoppingPrepLineStatus = (typeof SHOPPING_PREP_LINE_STATUSES)[number];

export const BATCH_REMAINING_STATES = [
  "plenty",
  "about_half",
  "low",
  "finished",
  "unknown",
] as const;
export type BatchRemainingState = (typeof BATCH_REMAINING_STATES)[number];

export const MEAL_VISIBILITIES = [
  "household",
  "participants",
  "creator_only",
] as const;
export type MealVisibility = (typeof MEAL_VISIBILITIES)[number];

export {
  PREFERENCE_SIGNALS,
  RANKING_MODES,
  PREFERENCE_SCOPES,
  PREFERENCE_FIT_SUMMARIES,
  SCORE_COMPONENT_KEYS,
} from "./scoring/types";
export type {
  PreferenceSignal,
  RankingMode,
  PreferenceScope,
  PreferenceFitSummary,
  ScoreComponentKey,
} from "./scoring/types";
