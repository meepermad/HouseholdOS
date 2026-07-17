/**
 * Deterministic, explainable preference-aware recipe scoring (Phase 7A).
 * Single ranking system with mode-specific weights — no opaque ML.
 */

import type { IngredientMatchResult } from "../match";
import { aggregatePreferences, projectPrivatePreferenceExplanations } from "./privacy";
import type {
  MemberPreferenceInput,
  PreferenceFitSummary,
  RecipeHistorySignals,
  ScoreComponent,
  ScoreComponentKey,
  ScoreRequestContext,
  ScoreableRecipe,
  ScoredRecipeResult,
} from "./types";
import {
  SCORING_THRESHOLDS,
  SCORING_VERSION,
  resolveModeWeights,
} from "./weights";

export { SCORING_VERSION };

export type ScoreRecipesInput = {
  recipes: readonly ScoreableRecipe[];
  matchesByRecipe: ReadonlyMap<string, readonly IngredientMatchResult[]>;
  preferencesByRecipe: ReadonlyMap<string, readonly MemberPreferenceInput[]>;
  historyByRecipe: ReadonlyMap<string, RecipeHistorySignals>;
  context: ScoreRequestContext;
};

function daysSince(iso: string | null | undefined, now: Date): number | null {
  if (!iso) return null;
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return null;
  return Math.floor((now.getTime() - then.getTime()) / (1000 * 60 * 60 * 24));
}

function component(
  key: ScoreComponentKey,
  value: number,
  weight: number,
): ScoreComponent {
  const raw = value * weight;
  const contribution = Object.is(raw, -0) ? 0 : Math.round(raw * 100) / 100;
  return { key, value, weight, contribution };
}

function pantryStats(matches: readonly IngredientMatchResult[]) {
  const requiredish = matches.filter((m) => m.status !== "optional_missing");
  const missingRequired = requiredish.filter(
    (m) => m.status === "missing" || m.status === "personal_unavailable",
  ).length;
  const missingOptional = matches.filter((m) => m.status === "optional_missing").length;
  const useSoonCount = matches.filter((m) => m.status === "use_soon").length;
  const unitMismatchCount = matches.filter((m) => m.status === "unit_mismatch").length;
  const availableish = matches.filter((m) =>
    [
      "available",
      "probably_available",
      "use_soon",
      "assumed_available",
      "quantity_unknown",
      "low",
    ].includes(m.status),
  ).length;
  const approximateCount = matches.filter(
    (m) => m.status === "probably_available" || m.status === "quantity_unknown",
  ).length;
  return {
    missingRequired,
    missingOptional,
    useSoonCount,
    unitMismatchCount,
    availableish,
    approximateCount,
  };
}

/**
 * Hard exclusions — never score past these gates.
 */
export function evaluateHardExclusion(
  recipe: ScoreableRecipe,
  stats: ReturnType<typeof pantryStats>,
  context: ScoreRequestContext,
): string | null {
  if (recipe.dietaryConflictHits > 0) {
    return "Conflicts with a required attendee or guest dietary constraint";
  }
  if (context.guestConstraints.length > 0 && recipe.dietaryConflictHits > 0) {
    return "Conflicts with a guest constraint for this meal";
  }
  const missingEquipment = recipe.requiredEquipment.filter(
    (eq) =>
      !recipe.availableEquipment.some(
        (a) => a.trim().toLowerCase() === eq.trim().toLowerCase(),
      ),
  );
  if (missingEquipment.length > 0) {
    return `Requires unavailable essential equipment (${missingEquipment[0]})`;
  }
  if (
    context.strictTimeLimit &&
    context.maxTotalMinutes != null &&
    recipe.totalMinutes != null &&
    recipe.totalMinutes > context.maxTotalMinutes
  ) {
    return `Exceeds strict maximum time of ${context.maxTotalMinutes} minutes`;
  }
  if (
    context.maxMissingRequired != null &&
    stats.missingRequired > context.maxMissingRequired
  ) {
    return `Exceeds maximum missing required ingredients (${context.maxMissingRequired})`;
  }
  if (recipe.excludedIngredientHits > 0) {
    return "Uses an ingredient explicitly excluded for this request";
  }
  if (recipe.servingScaleFactor > recipe.maxReasonableScaleFactor) {
    return "Serving model cannot reasonably satisfy the target";
  }
  return null;
}

function scoreOne(
  recipe: ScoreableRecipe,
  matches: readonly IngredientMatchResult[],
  preferences: readonly MemberPreferenceInput[],
  history: RecipeHistorySignals | undefined,
  context: ScoreRequestContext,
): ScoredRecipeResult {
  const now = context.now ?? new Date();
  const weights = resolveModeWeights(context.mode);
  const stats = pantryStats(matches);
  const denom = Math.max(1, recipe.requiredIngredientCount);
  const pantryCoverageRatio = stats.availableish / denom;

  const hard = evaluateHardExclusion(recipe, stats, context);
  if (hard) {
    return {
      recipeId: recipe.id,
      recipeName: recipe.name,
      totalScore: 0,
      components: [],
      reasons: [],
      warnings: [],
      excluded: true,
      hardExclusionReason: hard,
      preferenceFit: "unknown",
      pantryCoverageRatio,
      missingRequired: stats.missingRequired,
      missingOptional: stats.missingOptional,
      useSoonCount: stats.useSoonCount,
      unitMismatchCount: stats.unitMismatchCount,
    };
  }

  // Soft time filter for non-strict modes (exclude from results but not hard reason)
  if (
    !context.strictTimeLimit &&
    context.maxTotalMinutes != null &&
    recipe.totalMinutes != null &&
    recipe.totalMinutes > context.maxTotalMinutes
  ) {
    return {
      recipeId: recipe.id,
      recipeName: recipe.name,
      totalScore: 0,
      components: [],
      reasons: [],
      warnings: [],
      excluded: true,
      hardExclusionReason: `Exceeds maximum time of ${context.maxTotalMinutes} minutes`,
      preferenceFit: "unknown",
      pantryCoverageRatio,
      missingRequired: stats.missingRequired,
      missingOptional: stats.missingOptional,
      useSoonCount: stats.useSoonCount,
      unitMismatchCount: stats.unitMismatchCount,
    };
  }

  const agg = aggregatePreferences(preferences, context.preferenceScope);
  const prefProj = projectPrivatePreferenceExplanations(agg, false);

  const hist: RecipeHistorySignals = history ?? {
    timesPrepared: 0,
    lastPreparedAt: null,
    recentCategoryCount: 0,
  };

  // Attendance / leftovers must never become like/dislike signals
  void hist.preparationCancelled;
  void hist.leftoverOutcomeApproximate;
  void hist.feedbackSubmittedCount;

  const components: ScoreComponent[] = [];
  const reasons: string[] = [];
  const warnings: string[] = [];

  // pantry_coverage
  components.push(component("pantry_coverage", pantryCoverageRatio, weights.pantry_coverage));
  if (pantryCoverageRatio >= 0.75) {
    reasons.push(
      `${stats.availableish} of ${recipe.requiredIngredientCount} required ingredients appear available`,
    );
  } else if (stats.availableish > 0) {
    reasons.push(
      `${stats.availableish} of ${Math.max(recipe.requiredIngredientCount, stats.availableish + stats.missingRequired)} required ingredients appear available`,
    );
  }

  // use_soon
  components.push(
    component("use_soon_utilization", stats.useSoonCount, weights.use_soon_utilization),
  );
  if (stats.useSoonCount > 0) {
    reasons.push(
      `Uses ${stats.useSoonCount} ingredient${stats.useSoonCount === 1 ? "" : "s"} marked “use soon”`,
    );
  }
  if (hist.consumedUseSoon) {
    reasons.push("Previously helped use ingredients marked “use soon”");
  }

  // missing required (value = count; weight already negative)
  const missingValue = Math.min(
    stats.missingRequired,
    SCORING_THRESHOLDS.missingRequiredSoftCap / 5,
  );
  components.push(
    component("missing_required_count", missingValue, weights.missing_required_count),
  );
  if (stats.missingRequired === 0) {
    reasons.push("No required ingredients missing");
  } else if (stats.missingRequired === 1) {
    reasons.push("Missing only one required ingredient");
  } else {
    reasons.push(`Missing ${stats.missingRequired} required ingredients`);
  }

  components.push(
    component("missing_optional_count", stats.missingOptional, weights.missing_optional_count),
  );

  components.push(
    component("unit_uncertainty", stats.unitMismatchCount, weights.unit_uncertainty),
  );
  if (stats.unitMismatchCount >= SCORING_THRESHOLDS.unitMismatchWarningAt) {
    warnings.push(
      stats.unitMismatchCount === 1
        ? "One ingredient has an unresolved unit mismatch"
        : `${stats.unitMismatchCount} ingredients have unresolved unit mismatches`,
    );
  }
  if (stats.approximateCount > 0) {
    warnings.push("Pantry quantity is approximate");
  }

  // Preferences (never infer from attendance)
  components.push(
    component("attendee_preference", agg.preferenceScore, weights.attendee_preference),
  );
  components.push(
    component(
      "strong_dislike_penalty",
      agg.strongDislikePenaltyUnits,
      weights.strong_dislike_penalty,
    ),
  );
  components.push(
    component("favorite_bonus", agg.favoriteBonusUnits, weights.favorite_bonus),
  );
  reasons.push(...prefProj.reasons);
  warnings.push(...prefProj.warnings);
  if (agg.hasConflict) {
    // Extra conflict guardrail already in strong_dislike + favorite terms
    reasons.push("Preference fit: Mixed");
  }

  // Time fit
  let timeValue = 0;
  if (recipe.totalMinutes != null) {
    timeValue = Math.max(
      0,
      SCORING_THRESHOLDS.timeFitCap -
        Math.floor(recipe.totalMinutes / SCORING_THRESHOLDS.timeFitMinutesPerPoint),
    );
    reasons.push(`Estimated total time is ${recipe.totalMinutes} minutes`);
  }
  components.push(component("time_fit", timeValue, weights.time_fit));

  // Meal type fit
  let mealTypeValue = 0;
  if (context.mealType === "meal_prep" && recipe.mealPrepSuitable) {
    mealTypeValue = 1;
    reasons.push("Suitable for meal prep");
  } else if (
    (context.mealType === "guest_inclusive" || context.mealType === "shared_household") &&
    recipe.guestScalable
  ) {
    mealTypeValue = 1;
  }
  components.push(component("meal_type_fit", mealTypeValue, weights.meal_type_fit));

  // Equipment soft bonus when all present (hard gate already handled missing)
  components.push(
    component(
      "equipment_fit",
      recipe.requiredEquipment.length > 0 ? 1 : 0,
      weights.equipment_fit,
    ),
  );

  // Serving scalability
  const scalePenalty =
    recipe.servingScaleFactor <= 1
      ? 1
      : Math.max(0, 1 - (recipe.servingScaleFactor - 1) / recipe.maxReasonableScaleFactor);
  components.push(
    component("serving_scalability", scalePenalty, weights.serving_scalability),
  );

  // Meal prep fit
  const mealPrepValue =
    (recipe.mealPrepSuitable ? 1 : 0) +
    (hist.usedForMealPrep ? 0.5 : 0) +
    averageSecondary(
      preferences
        .filter((p) =>
          context.preferenceScope === "household" ? true : p.isAttending,
        )
        .map((p) => p.mealPrepUsefulness),
    );
  components.push(component("meal_prep_fit", mealPrepValue, weights.meal_prep_fit));
  if (context.mode === "meal_prep_friendly" && recipe.mealPrepSuitable) {
    reasons.push("Marked useful for batches, reheating, or leftovers");
  }

  // Guest fit
  const guestValue =
    (recipe.guestScalable ? 1 : 0) +
    (hist.successfulForGuests === true ? 1 : 0) +
    averageSecondary(
      preferences
        .filter((p) =>
          context.preferenceScope === "household" ? true : p.isAttending,
        )
        .map((p) => p.guestFriendliness),
    );
  components.push(component("guest_fit", guestValue, weights.guest_fit));
  if (context.mode === "guest_friendly" && recipe.guestScalable) {
    reasons.push("Scales well for guests");
  }

  // Recently prepared
  const recentDays =
    context.mode === "something_different"
      ? SCORING_THRESHOLDS.somethingDifferentRecentDays
      : SCORING_THRESHOLDS.recentPreparedDays;
  const since = daysSince(hist.lastPreparedAt, now);
  let recentValue = 0;
  if (since !== null && since < recentDays) {
    recentValue = 1 + (context.mode === "something_different" ? (recentDays - since) / recentDays : 0);
    reasons.push(
      since === 0
        ? "Prepared today (repetition penalty)"
        : since === 1
          ? "Prepared yesterday (repetition penalty)"
          : `It has not been long since last prepared (${since} days ago)`,
    );
    if (since >= 7 && context.mode !== "something_different") {
      // soften message for older-than-week but still under window in something_different
    }
  } else if (since !== null && since >= 21) {
    reasons.push(`It has not been prepared in ${Math.floor(since / 7)} weeks`);
  } else if (hist.timesPrepared === 0) {
    // novelty handled below — do not penalize new/imported
  }
  components.push(
    component("recently_prepared_penalty", recentValue, weights.recently_prepared_penalty),
  );

  // Category repetition
  const catRep = Math.max(0, hist.recentCategoryCount - 1);
  components.push(
    component("category_repetition_penalty", catRep, weights.category_repetition_penalty),
  );
  if (catRep > 0 && context.mode === "something_different") {
    reasons.push("Similar category cooked recently (variety penalty)");
  }

  // Shopping cost estimate (soft: high missing ≈ higher shopping)
  const shopValue = stats.missingRequired + (hist.shoppingRequirementHigh ? 2 : 0);
  components.push(
    component("shopping_cost_estimate", shopValue, weights.shopping_cost_estimate),
  );

  // Novelty — new imported recipes stay neutral (no popularity bonus, no dislike)
  const noveltyValue =
    hist.timesPrepared === 0 && recipe.isNewlyImported
      ? 0
      : hist.timesPrepared === 0
        ? 1
        : 0;
  components.push(component("novelty_bonus", noveltyValue, weights.novelty_bonus));
  if (recipe.isNewlyImported && hist.timesPrepared === 0) {
    // Explicit neutrality: no extra reason about "new" popularity
  }

  let totalScore = 0;
  for (const c of components) {
    totalScore += c.contribution;
  }
  totalScore = Math.round(totalScore * 100) / 100;

  if (reasons.length === 0) {
    reasons.push("Eligible household recipe");
  }

  return {
    recipeId: recipe.id,
    recipeName: recipe.name,
    totalScore,
    components,
    reasons: dedupe(reasons),
    warnings: dedupe(warnings),
    excluded: false,
    hardExclusionReason: null,
    preferenceFit: prefProj.preferenceFit,
    pantryCoverageRatio,
    missingRequired: stats.missingRequired,
    missingOptional: stats.missingOptional,
    useSoonCount: stats.useSoonCount,
    unitMismatchCount: stats.unitMismatchCount,
  };
}

function averageSecondary(values: readonly (number | null | undefined)[]): number {
  const nums = values.filter((v): v is number => typeof v === "number" && v >= 1 && v <= 5);
  if (nums.length === 0) return 0;
  const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
  return (avg - 3) / 2; // map 1–5 → -1..1 around neutral 3
}

function dedupe(lines: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of lines) {
    if (seen.has(line)) continue;
    seen.add(line);
    out.push(line);
  }
  return out;
}

/**
 * Rank recipes deterministically. Tie-break: score desc → name asc → id asc.
 */
export function scoreRecipes(input: ScoreRecipesInput): ScoredRecipeResult[] {
  const limited = input.recipes.slice(0, SCORING_THRESHOLDS.maxCandidates);
  const results: ScoredRecipeResult[] = [];

  for (const recipe of limited) {
    const scored = scoreOne(
      recipe,
      input.matchesByRecipe.get(recipe.id) ?? [],
      input.preferencesByRecipe.get(recipe.id) ?? [],
      input.historyByRecipe.get(recipe.id),
      input.context,
    );
    if (!scored.excluded) {
      results.push(scored);
    }
  }

  return results.sort((a, b) => {
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
    const nameCmp = a.recipeName.localeCompare(b.recipeName);
    if (nameCmp !== 0) return nameCmp;
    return a.recipeId.localeCompare(b.recipeId);
  });
}

/** Include excluded candidates (for diagnostics / persisted exclusion reasons). */
export function scoreRecipesIncludingExcluded(
  input: ScoreRecipesInput,
): ScoredRecipeResult[] {
  const limited = input.recipes.slice(0, SCORING_THRESHOLDS.maxCandidates);
  const results: ScoredRecipeResult[] = [];
  for (const recipe of limited) {
    results.push(
      scoreOne(
        recipe,
        input.matchesByRecipe.get(recipe.id) ?? [],
        input.preferencesByRecipe.get(recipe.id) ?? [],
        input.historyByRecipe.get(recipe.id),
        input.context,
      ),
    );
  }
  return results.sort((a, b) => {
    if (a.excluded !== b.excluded) return a.excluded ? 1 : -1;
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
    const nameCmp = a.recipeName.localeCompare(b.recipeName);
    if (nameCmp !== 0) return nameCmp;
    return a.recipeId.localeCompare(b.recipeId);
  });
}

export function explainScoredRecipe(result: ScoredRecipeResult): string[] {
  return result.reasons;
}

export function preferenceFitLabel(fit: PreferenceFitSummary): string {
  switch (fit) {
    case "strong":
      return "Preference fit: Strong";
    case "positive":
      return "Preference fit: Positive";
    case "neutral":
      return "Preference fit: Neutral";
    case "mixed":
      return "Preference fit: Mixed";
    case "negative":
      return "Preference fit: Negative";
    case "conflict":
      return "Preference fit: Mixed";
    case "unknown":
      return "Preference fit: Unknown";
  }
}
