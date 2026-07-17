export type {
  GuestConstraintInput,
  MemberPreferenceInput,
  PreferenceFitSummary,
  PreferenceScope,
  PreferenceSignal,
  RankingMode,
  RecipeHistorySignals,
  ScoreComponent,
  ScoreComponentKey,
  ScoreRequestContext,
  ScoreableRecipe,
  ScoredRecipeResult,
} from "./types";
export {
  PREFERENCE_FIT_SUMMARIES,
  PREFERENCE_SCOPES,
  PREFERENCE_SIGNALS,
  RANKING_MODES,
  SCORE_COMPONENT_KEYS,
} from "./types";

export {
  BASE_WEIGHTS,
  MODE_WEIGHT_MULTIPLIERS,
  PREFERENCE_SIGNAL_SCORES,
  SCORING_THRESHOLDS,
  SCORING_VERSION,
  resolveModeWeights,
} from "./weights";

export {
  aggregatePreferences,
  projectPrivatePreferenceExplanations,
  selectRelevantPreferences,
} from "./privacy";
export type { PreferenceAggregate } from "./privacy";

export {
  evaluateHardExclusion,
  explainScoredRecipe,
  preferenceFitLabel,
  scoreRecipes,
  scoreRecipesIncludingExcluded,
} from "./score";
export type { ScoreRecipesInput } from "./score";

export {
  MATERIAL_RECALC_TRIGGERS,
  acceptedPlanRecalcNotice,
  shouldRecalculateRecommendations,
} from "./recalc";
export type {
  AcceptedPlanRecalcNotice,
  RecommendationRecalcTrigger,
} from "./recalc";
