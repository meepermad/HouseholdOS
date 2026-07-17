export type {
  BatchRemainingState,
  GuestCostPolicy,
  MealAttendanceStatus,
  MealPlanStatus,
  MealType,
  MealVisibility,
  PantryMatchStatus,
  QuantityMode,
  RecipeCategory,
  RecipeDifficulty,
  RecipeVisibility,
  ShoppingPrepLineStatus,
  ShoppingPrepPolicy,
} from "./types";
export {
  BATCH_REMAINING_STATES,
  DEFAULT_SHOPPING_PREP_POLICY,
  GUEST_COST_POLICIES,
  MEAL_ATTENDANCE_STATUSES,
  MEAL_PLAN_STATUSES,
  MEAL_TYPES,
  MEAL_VISIBILITIES,
  PANTRY_MATCH_STATUSES,
  QUANTITY_MODES,
  RECIPE_CATEGORIES,
  RECIPE_DIFFICULTIES,
  RECIPE_VISIBILITIES,
  SHOPPING_PREP_LINE_STATUSES,
  SHOPPING_PREP_POLICIES,
} from "./types";

export {
  COMMON_INGREDIENT_ALIASES,
  areDistinctCreamVariants,
  buildAliasTable,
  namesMatch,
  normalizeForMatch,
  normalizeIngredientName,
  resolveCanonicalName,
  singularizeToken,
} from "./normalize";
export type { AliasTable } from "./normalize";

export {
  decimalSafeScale,
  scaleFactor,
  scaleIngredient,
  scaleIngredients,
  subtractQuantities,
} from "./scale";
export type { ScalableIngredient, ScaledIngredient } from "./scale";

export { estimateServings } from "./serving-estimate";
export type { ServingEstimate, ServingEstimateInput } from "./serving-estimate";

export { matchIngredient, matchIngredients } from "./match";
export type {
  AuthorizedPantryItem,
  IngredientMatchInput,
  IngredientMatchResult,
  MatchOptions,
} from "./match";

export { calculateShortfall, calculateShortfalls } from "./shortfall";
export type { ShortfallIngredient, ShortfallResult } from "./shortfall";

export {
  actionableShoppingLines,
  applyShoppingPrepPolicy,
  assertNeverDeletesPurchased,
  buildShoppingPrepLines,
  isActiveShoppingStatus,
  isPurchasedStatus,
  recalculateShoppingPrep,
} from "./shopping-prep";
export type {
  ActiveShoppingItem,
  ShoppingPrepAction,
  ShoppingPrepLine,
  ShoppingPrepProposal,
} from "./shopping-prep";

export { explainRanking, rankRecipes } from "./rank";
export type {
  RankExplanation,
  RankRequestConstraints,
  RankableRecipe,
  RankedRecipe,
} from "./rank";

export {
  SCORING_VERSION,
  BASE_WEIGHTS,
  resolveModeWeights,
  scoreRecipes,
  scoreRecipesIncludingExcluded,
  explainScoredRecipe,
  preferenceFitLabel,
  evaluateHardExclusion,
  aggregatePreferences,
  projectPrivatePreferenceExplanations,
  selectRelevantPreferences,
  shouldRecalculateRecommendations,
  acceptedPlanRecalcNotice,
  MATERIAL_RECALC_TRIGGERS,
  PREFERENCE_SIGNALS,
  RANKING_MODES,
  PREFERENCE_SCOPES,
  PREFERENCE_FIT_SUMMARIES,
  SCORE_COMPONENT_KEYS,
} from "./scoring";
export type {
  GuestConstraintInput,
  MemberPreferenceInput,
  PreferenceAggregate,
  PreferenceFitSummary,
  PreferenceScope,
  PreferenceSignal,
  RankingMode,
  RecipeHistorySignals,
  ScoreComponent,
  ScoreComponentKey,
  ScoreRequestContext,
  ScoreRecipesInput,
  ScoreableRecipe,
  ScoredRecipeResult,
  RecommendationRecalcTrigger,
  AcceptedPlanRecalcNotice,
} from "./scoring";

export {
  projectDietaryConstraintsForOrganizer,
  sanitizeDietaryForNotification,
} from "./dietary-privacy";
export type { DietaryConstraint, DietaryProjection } from "./dietary-privacy";

export { suggestMealExpenseAllocation } from "./expense-suggestion";
export type {
  MealExpenseParticipant,
  MealExpenseShare,
  MealExpenseSuggestion,
  MealExpenseSuggestionInput,
} from "./expense-suggestion";

export {
  MEAL_STATUS_TRANSITIONS,
  assertMealBatchHasNoPortions,
  canTransitionMealStatus,
  defaultVisibilityForMealType,
  mayMutateShoppingFromRequest,
  resolveShoppingPrepPolicy,
  shouldAutoApplyShopping,
  shouldAutoCreateChores,
  shouldNotifyHouseholdForMeal,
  shouldRequireAttendance,
  totalEstimatedMinutes,
  validateRecipeBasics,
} from "./lifecycle";
export type { FulfillmentPhase } from "./lifecycle";

export {
  listRecipes,
  getRecipe,
  listMealPlansForWeek,
  getMealPlan,
  listMealPrepBatches,
  getMealBatch,
  getMealSettings,
  getMealRequest,
} from "./queries";
export type {
  RecipeListItem,
  MealPlanListItem,
  MealBatchListItem,
} from "./queries";
