/**
 * Backward-compatible ranking facade over Phase 7A scoring.
 * Prefer scoreRecipes() for new code.
 */

import type { IngredientMatchResult } from "./match";
import {
  scoreRecipes,
  type MemberPreferenceInput,
  type RankingMode,
  type RecipeHistorySignals,
  type ScoreableRecipe,
  type PreferenceScope,
} from "./scoring";
import type { RecipeCategory } from "./types";

export type RankableRecipe = {
  id: string;
  name: string;
  category: RecipeCategory;
  totalMinutes: number | null;
  baseServings: number;
  isFavorite?: boolean;
  personalRating?: number | null;
  householdRating?: number | null;
  lastPreparedAt?: string | null;
  timesPrepared?: number;
  /** Ingredient ids that conflict with exclude list. */
  excludedIngredientHits?: number;
  requiredIngredientCount: number;
  prepMinutes?: number | null;
  requiredEquipment?: readonly string[];
  availableEquipment?: readonly string[];
  dietaryConflictHits?: number;
  optionalIngredientCount?: number;
  mealPrepSuitable?: boolean;
  guestScalable?: boolean;
  isNewlyImported?: boolean;
  servingScaleFactor?: number;
  maxReasonableScaleFactor?: number;
};

export type RankRequestConstraints = {
  maxTotalMinutes?: number | null;
  maxMissingIngredients?: number | null;
  categories?: readonly RecipeCategory[];
  prioritizeIngredientNames?: readonly string[];
  excludeIngredientNames?: readonly string[];
  pantryOnly?: boolean;
  rankingMode?: RankingMode;
  preferenceScope?: PreferenceScope;
  strictTimeLimit?: boolean;
  mealType?: string | null;
  targetServings?: number | null;
  /** Attendee preferences keyed by recipe id (optional; favorites also on recipe). */
  preferencesByRecipe?: ReadonlyMap<string, readonly MemberPreferenceInput[]>;
  historyByRecipe?: ReadonlyMap<string, RecipeHistorySignals>;
};

export type RankExplanation = {
  recipeId: string;
  score: number;
  reasons: string[];
  missingRequired: number;
  useSoonCount: number;
  pantryCoverageRatio: number;
};

export type RankedRecipe = RankExplanation & {
  recipe: RankableRecipe;
  warnings?: string[];
  preferenceFit?: string;
  components?: Array<{ key: string; contribution: number }>;
};

function toScoreable(recipe: RankableRecipe): ScoreableRecipe {
  return {
    id: recipe.id,
    name: recipe.name,
    category: recipe.category,
    totalMinutes: recipe.totalMinutes,
    prepMinutes: recipe.prepMinutes ?? null,
    baseServings: recipe.baseServings,
    requiredEquipment: recipe.requiredEquipment ?? [],
    availableEquipment: recipe.availableEquipment ?? [],
    excludedIngredientHits: recipe.excludedIngredientHits ?? 0,
    dietaryConflictHits: recipe.dietaryConflictHits ?? 0,
    requiredIngredientCount: recipe.requiredIngredientCount,
    optionalIngredientCount: recipe.optionalIngredientCount ?? 0,
    mealPrepSuitable: recipe.mealPrepSuitable ?? recipe.category === "meal_prep",
    guestScalable: recipe.guestScalable ?? true,
    isNewlyImported: recipe.isNewlyImported ?? false,
    servingScaleFactor: recipe.servingScaleFactor ?? 1,
    maxReasonableScaleFactor: recipe.maxReasonableScaleFactor ?? 4,
  };
}

function legacyPrefsForRecipe(
  recipe: RankableRecipe,
): MemberPreferenceInput[] {
  const prefs: MemberPreferenceInput[] = [];
  if (recipe.isFavorite) {
    prefs.push({
      membershipId: "self",
      isAttending: true,
      signal: "favorite",
      isFavorite: true,
    });
  } else if (recipe.personalRating != null) {
    const signal =
      recipe.personalRating >= 4
        ? "would_make_again"
        : recipe.personalRating <= 2
          ? "would_not_choose_again"
          : "okay";
    prefs.push({
      membershipId: "self",
      isAttending: true,
      signal,
    });
  }
  return prefs;
}

/**
 * Deterministic recipe ranking with explainable reasons.
 * No opaque AI ranking.
 */
export function rankRecipes(
  recipes: readonly RankableRecipe[],
  matchesByRecipe: ReadonlyMap<string, readonly IngredientMatchResult[]>,
  constraints: RankRequestConstraints = {},
  now = new Date(),
): RankedRecipe[] {
  // Soft category filter (legacy behavior)
  let filtered = [...recipes];
  if (constraints.categories && constraints.categories.length > 0) {
    filtered = filtered.filter((r) =>
      constraints.categories!.includes(r.category),
    );
  }
  if (constraints.pantryOnly) {
    // Applied via maxMissingRequired = 0
  }

  const preferencesByRecipe = new Map<string, MemberPreferenceInput[]>();
  const historyByRecipe = new Map<string, RecipeHistorySignals>();

  for (const recipe of filtered) {
    const fromConstraint = constraints.preferencesByRecipe?.get(recipe.id);
    preferencesByRecipe.set(
      recipe.id,
      fromConstraint ? [...fromConstraint] : legacyPrefsForRecipe(recipe),
    );
    const hist = constraints.historyByRecipe?.get(recipe.id);
    historyByRecipe.set(recipe.id, {
      timesPrepared: recipe.timesPrepared ?? hist?.timesPrepared ?? 0,
      lastPreparedAt: recipe.lastPreparedAt ?? hist?.lastPreparedAt ?? null,
      recentCategoryCount: hist?.recentCategoryCount ?? 0,
      usedForMealPrep: hist?.usedForMealPrep,
      shoppingRequirementHigh: hist?.shoppingRequirementHigh,
      preparationCancelled: hist?.preparationCancelled,
      leftoverOutcomeApproximate: hist?.leftoverOutcomeApproximate,
      successfulForGuests: hist?.successfulForGuests,
      consumedUseSoon: hist?.consumedUseSoon,
      feedbackSubmittedCount: hist?.feedbackSubmittedCount,
    });
  }

  const scored = scoreRecipes({
    recipes: filtered.map(toScoreable),
    matchesByRecipe,
    preferencesByRecipe,
    historyByRecipe,
    context: {
      mode: constraints.rankingMode ?? "best_overall",
      preferenceScope: constraints.preferenceScope ?? "attendees",
      maxTotalMinutes: constraints.maxTotalMinutes ?? null,
      strictTimeLimit: constraints.strictTimeLimit ?? false,
      maxMissingRequired: constraints.pantryOnly
        ? 0
        : (constraints.maxMissingIngredients ?? null),
      targetServings: constraints.targetServings ?? null,
      mealType: constraints.mealType ?? null,
      guestConstraints: [],
      excludeIngredients: constraints.excludeIngredientNames ?? [],
      now,
    },
  });

  const byId = new Map(filtered.map((r) => [r.id, r]));
  return scored.map((s) => {
    const recipe = byId.get(s.recipeId)!;
    const reasons = [...s.reasons];
    if (constraints.prioritizeIngredientNames?.length) {
      reasons.push(
        `Prioritizes pantry items: ${constraints.prioritizeIngredientNames.slice(0, 3).join(", ")}`,
      );
    }
    if (
      constraints.categories?.includes(recipe.category) &&
      !reasons.some((r) => /category/i.test(r))
    ) {
      reasons.push(`Matches requested category (${recipe.category})`);
    }
    return {
      recipeId: s.recipeId,
      recipe,
      score: s.totalScore,
      reasons,
      missingRequired: s.missingRequired,
      useSoonCount: s.useSoonCount,
      pantryCoverageRatio: s.pantryCoverageRatio,
      warnings: s.warnings,
      preferenceFit: s.preferenceFit,
      components: s.components.map((c) => ({
        key: c.key,
        contribution: c.contribution,
      })),
    };
  });
}

export function explainRanking(ranked: RankedRecipe): string[] {
  return ranked.reasons;
}
