/**
 * Centralized, versioned recommendation weights.
 * Do not scatter magic numbers — import from here (and keep SQL in sync).
 */

import type { RankingMode, ScoreComponentKey } from "./types";

/** Bump when scoring math changes incompatibly. */
export const SCORING_VERSION = "1" as const;

export type ScoreWeights = Record<ScoreComponentKey, number>;

/** Base contributions used by best_overall (and as foundation for other modes). */
export const BASE_WEIGHTS: ScoreWeights = {
  pantry_coverage: 40,
  use_soon_utilization: 8,
  missing_required_count: -5,
  missing_optional_count: -1,
  unit_uncertainty: -2,
  attendee_preference: 1,
  strong_dislike_penalty: -25,
  favorite_bonus: 12,
  time_fit: 1,
  meal_type_fit: 8,
  equipment_fit: 5,
  serving_scalability: 6,
  meal_prep_fit: 10,
  guest_fit: 10,
  recently_prepared_penalty: -15,
  category_repetition_penalty: -6,
  shopping_cost_estimate: -3,
  novelty_bonus: 4,
};

/** Per-mode multipliers applied to BASE_WEIGHTS contributions. */
export const MODE_WEIGHT_MULTIPLIERS: Record<
  RankingMode,
  Partial<ScoreWeights>
> = {
  best_overall: {},
  use_what_we_have: {
    pantry_coverage: 1.6,
    missing_required_count: 1.8,
    use_soon_utilization: 0.7,
    shopping_cost_estimate: 1.4,
  },
  use_food_soon: {
    use_soon_utilization: 2.5,
    pantry_coverage: 1.1,
    recently_prepared_penalty: 0.5,
  },
  household_favorite: {
    attendee_preference: 2.2,
    favorite_bonus: 2,
    strong_dislike_penalty: 1.5,
    pantry_coverage: 0.7,
  },
  fastest: {
    time_fit: 3,
    pantry_coverage: 0.6,
    meal_prep_fit: 0.4,
  },
  fewest_missing_items: {
    missing_required_count: 2.5,
    missing_optional_count: 1.5,
    pantry_coverage: 1.3,
    shopping_cost_estimate: 1.5,
  },
  meal_prep_friendly: {
    meal_prep_fit: 2.5,
    serving_scalability: 1.4,
    time_fit: 0.8,
  },
  guest_friendly: {
    guest_fit: 2.5,
    serving_scalability: 1.6,
    strong_dislike_penalty: 1.3,
  },
  something_different: {
    recently_prepared_penalty: 2.2,
    category_repetition_penalty: 2,
    novelty_bonus: 2.5,
    favorite_bonus: 0.5,
  },
};

export const PREFERENCE_SIGNAL_SCORES = {
  favorite: 18,
  would_make_again: 12,
  okay: 2,
  would_not_choose_again: -20,
  have_not_tried: 0,
} as const;

/** Caps and thresholds used by hard gates / soft scoring. */
export const SCORING_THRESHOLDS = {
  maxCandidates: 100,
  recentPreparedDays: 7,
  somethingDifferentRecentDays: 21,
  categoryRepetitionWindow: 3,
  missingRequiredSoftCap: 20,
  timeFitCap: 15,
  timeFitMinutesPerPoint: 10,
  conflictDislikeFavoriteThreshold: 1,
  maxReasonableScaleDefault: 4,
  unitMismatchWarningAt: 1,
} as const;

export function resolveModeWeights(mode: RankingMode): ScoreWeights {
  const multipliers = MODE_WEIGHT_MULTIPLIERS[mode];
  const out = { ...BASE_WEIGHTS };
  for (const key of Object.keys(out) as ScoreComponentKey[]) {
    const m = multipliers[key];
    if (m != null) {
      out[key] = BASE_WEIGHTS[key] * m;
    }
  }
  return out;
}
