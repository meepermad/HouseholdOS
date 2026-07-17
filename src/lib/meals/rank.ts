import type { IngredientMatchResult } from "./match";
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
};

export type RankRequestConstraints = {
  maxTotalMinutes?: number | null;
  maxMissingIngredients?: number | null;
  categories?: readonly RecipeCategory[];
  prioritizeIngredientNames?: readonly string[];
  excludeIngredientNames?: readonly string[];
  pantryOnly?: boolean;
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
};

const MAX_CANDIDATES = 100;

function daysSince(iso: string | null | undefined, now: Date): number | null {
  if (!iso) return null;
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return null;
  return Math.floor((now.getTime() - then.getTime()) / (1000 * 60 * 60 * 24));
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
  const limited = recipes.slice(0, MAX_CANDIDATES);
  const results: RankedRecipe[] = [];

  for (const recipe of limited) {
    const matches = matchesByRecipe.get(recipe.id) ?? [];
    const requiredMatches = matches.filter((m) => {
      // optional_missing is not required
      return m.status !== "optional_missing";
    });

    const missingRequired = requiredMatches.filter(
      (m) =>
        m.status === "missing" ||
        m.status === "personal_unavailable",
    ).length;
    const useSoonCount = matches.filter((m) => m.status === "use_soon").length;
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
    const denom = Math.max(1, recipe.requiredIngredientCount);
    const pantryCoverageRatio = availableish / denom;

    // Soft filters
    if (
      constraints.maxTotalMinutes != null &&
      recipe.totalMinutes != null &&
      recipe.totalMinutes > constraints.maxTotalMinutes
    ) {
      continue;
    }
    if (
      constraints.maxMissingIngredients != null &&
      missingRequired > constraints.maxMissingIngredients
    ) {
      continue;
    }
    if (
      constraints.categories &&
      constraints.categories.length > 0 &&
      !constraints.categories.includes(recipe.category)
    ) {
      continue;
    }
    if (constraints.pantryOnly && missingRequired > 0) {
      continue;
    }
    if ((recipe.excludedIngredientHits ?? 0) > 0) {
      continue;
    }

    let score = 0;
    const reasons: string[] = [];

    score += Math.round(pantryCoverageRatio * 40);
    if (pantryCoverageRatio >= 0.75) {
      reasons.push("Strong pantry coverage");
    }

    score += Math.max(0, 20 - missingRequired * 5);
    if (missingRequired === 0) {
      reasons.push("No required ingredients missing");
    } else if (missingRequired === 1) {
      reasons.push("Missing only one required ingredient");
    } else {
      reasons.push(`Missing ${missingRequired} required ingredients`);
    }

    score += useSoonCount * 8;
    if (useSoonCount > 0) {
      reasons.push(
        `Uses ${useSoonCount} ingredient${useSoonCount === 1 ? "" : "s"} marked “use soon”`,
      );
    }

    if (recipe.totalMinutes != null) {
      score += Math.max(0, 15 - Math.floor(recipe.totalMinutes / 10));
      reasons.push(`Estimated total time: ${recipe.totalMinutes} minutes`);
    }

    if (constraints.categories?.includes(recipe.category)) {
      score += 10;
      reasons.push(`Matches requested category (${recipe.category})`);
    }

    if (recipe.isFavorite) {
      score += 12;
      reasons.push("Marked as a favorite");
    }

    if (recipe.personalRating != null) {
      score += recipe.personalRating * 2;
    }
    if (recipe.householdRating != null) {
      score += recipe.householdRating;
    }

    const since = daysSince(recipe.lastPreparedAt, now);
    if (since !== null && since < 7) {
      score -= 15;
      reasons.push("Recently cooked (slight penalty)");
    }

    if (constraints.prioritizeIngredientNames?.length) {
      reasons.push(
        `Prioritizes pantry items: ${constraints.prioritizeIngredientNames.slice(0, 3).join(", ")}`,
      );
      score += 5;
    }

    if (reasons.length === 0) {
      reasons.push("Eligible household recipe");
    }

    results.push({
      recipeId: recipe.id,
      recipe,
      score,
      reasons,
      missingRequired,
      useSoonCount,
      pantryCoverageRatio,
    });
  }

  return results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.recipe.name.localeCompare(b.recipe.name);
  });
}

export function explainRanking(ranked: RankedRecipe): string[] {
  return ranked.reasons;
}
