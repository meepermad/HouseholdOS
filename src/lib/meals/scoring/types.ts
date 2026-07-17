/** Phase 7A preference-aware recommendation types. */

export const PREFERENCE_SIGNALS = [
  "favorite",
  "would_make_again",
  "okay",
  "would_not_choose_again",
  "have_not_tried",
] as const;
export type PreferenceSignal = (typeof PREFERENCE_SIGNALS)[number];

export const RANKING_MODES = [
  "best_overall",
  "use_what_we_have",
  "use_food_soon",
  "household_favorite",
  "fastest",
  "fewest_missing_items",
  "meal_prep_friendly",
  "guest_friendly",
  "something_different",
] as const;
export type RankingMode = (typeof RANKING_MODES)[number];

export const PREFERENCE_SCOPES = ["attendees", "household"] as const;
export type PreferenceScope = (typeof PREFERENCE_SCOPES)[number];

export const PREFERENCE_FIT_SUMMARIES = [
  "strong",
  "positive",
  "neutral",
  "mixed",
  "negative",
  "conflict",
  "unknown",
] as const;
export type PreferenceFitSummary = (typeof PREFERENCE_FIT_SUMMARIES)[number];

export const SCORE_COMPONENT_KEYS = [
  "pantry_coverage",
  "use_soon_utilization",
  "missing_required_count",
  "missing_optional_count",
  "unit_uncertainty",
  "attendee_preference",
  "strong_dislike_penalty",
  "favorite_bonus",
  "time_fit",
  "meal_type_fit",
  "equipment_fit",
  "serving_scalability",
  "meal_prep_fit",
  "guest_fit",
  "recently_prepared_penalty",
  "category_repetition_penalty",
  "shopping_cost_estimate",
  "novelty_bonus",
] as const;
export type ScoreComponentKey = (typeof SCORE_COMPONENT_KEYS)[number];

export type MemberPreferenceInput = {
  membershipId: string;
  /** Whether this member is expected to attend / eat this meal. */
  isAttending: boolean;
  signal: PreferenceSignal;
  isFavorite?: boolean;
  /** Optional secondary ratings 1–5; soft only. */
  mealPrepUsefulness?: number | null;
  guestFriendliness?: number | null;
  /** When true, identity may appear in organizer-facing named details (rare). */
  shareIdentityWithOrganizer?: boolean;
  displayName?: string;
};

export type GuestConstraintInput = {
  /** Meal-scoped only; never permanent guest profiles. */
  label: string;
};

export type RecipeHistorySignals = {
  timesPrepared: number;
  lastPreparedAt: string | null;
  /** Recent category repetitions in household meal history (count in window). */
  recentCategoryCount: number;
  usedForMealPrep?: boolean;
  shoppingRequirementHigh?: boolean;
  preparationCancelled?: boolean;
  leftoverOutcomeApproximate?: boolean;
  successfulForGuests?: boolean | null;
  consumedUseSoon?: boolean;
  /** Explicit feedback count — not used as like/dislike inference. */
  feedbackSubmittedCount?: number;
};

export type ScoreableRecipe = {
  id: string;
  name: string;
  category: string;
  totalMinutes: number | null;
  prepMinutes: number | null;
  baseServings: number;
  /** Essential equipment ids or labels the recipe requires. */
  requiredEquipment: readonly string[];
  /** Equipment currently available to the household. */
  availableEquipment: readonly string[];
  /** Ingredients explicitly excluded for this request that hit this recipe. */
  excludedIngredientHits: number;
  /** Hard dietary/guest conflict count (required exclusions). */
  dietaryConflictHits: number;
  requiredIngredientCount: number;
  optionalIngredientCount: number;
  /** Soft: recipe tagged meal-prep friendly. */
  mealPrepSuitable: boolean;
  /** Soft: recipe scales well for guests. */
  guestScalable: boolean;
  /** True when recipe was recently imported with no preference history. */
  isNewlyImported: boolean;
  /** Serving scale factor needed to meet target (1 = exact base). */
  servingScaleFactor: number;
  /** Soft ceiling beyond which scaling is unreasonable (hard gate). */
  maxReasonableScaleFactor: number;
};

export type ScoreRequestContext = {
  mode: RankingMode;
  preferenceScope: PreferenceScope;
  maxTotalMinutes: number | null;
  /** When true, exceeding maxTotalMinutes is a hard exclusion. */
  strictTimeLimit: boolean;
  maxMissingRequired: number | null;
  targetServings: number | null;
  mealType: string | null;
  guestConstraints: readonly GuestConstraintInput[];
  /** Ingredient labels that hard-exclude when present on the recipe. */
  excludeIngredients: readonly string[];
  now?: Date;
};

export type ScoreComponent = {
  key: ScoreComponentKey;
  value: number;
  weight: number;
  contribution: number;
};

export type ScoredRecipeResult = {
  recipeId: string;
  recipeName: string;
  totalScore: number;
  components: ScoreComponent[];
  reasons: string[];
  warnings: string[];
  excluded: boolean;
  hardExclusionReason: string | null;
  preferenceFit: PreferenceFitSummary;
  pantryCoverageRatio: number;
  missingRequired: number;
  missingOptional: number;
  useSoonCount: number;
  unitMismatchCount: number;
};
