/** Forgotten Favorites rediscovery scoring — extends recipe scoring concepts. */

export const REDISCOVERY_SCORING_VERSION = "1";

export type RediscoveryCadence =
  | "off"
  | "weekly"
  | "every_other_trip"
  | "monthly"
  | "smart";

export type RediscoveryCandidateInput = {
  recipeId: string;
  recipeName: string;
  daysSincePrepared: number | null;
  neverPrepared: boolean;
  isFavorite: boolean;
  wouldMakeAgain: boolean;
  wouldNotChooseAgain: boolean;
  okayOnly: boolean;
  dietaryConflict: boolean;
  pantryHave: number;
  pantryTotal: number;
  shoppingOverlap: number;
  useSoonBonus: boolean;
  guestFriendly: boolean;
  mealPrepFavorite: boolean;
  snoozed: boolean;
  suppressed: boolean;
  dismissedRecently: boolean;
  expectedRevisitDays: number;
  preferenceFit: "strong" | "positive" | "neutral" | "mixed" | "negative" | "conflict" | "unknown";
};

export type RediscoveryResult = {
  recipeId: string;
  recipeName: string;
  score: number;
  eligible: boolean;
  explanation: string;
  reasonCodes: string[];
  pantryHave: number;
  pantryTotal: number;
  preferenceFit: RediscoveryCandidateInput["preferenceFit"];
  missingCount: number;
};

export function scoreRediscoveryCandidate(
  input: RediscoveryCandidateInput,
  minDaysSincePrepared: number,
): RediscoveryResult {
  const missingCount = Math.max(0, input.pantryTotal - input.pantryHave);
  const reasonCodes: string[] = [];
  let score = 0;

  if (input.suppressed || input.snoozed || input.dismissedRecently) {
    return ineligible(input, missingCount, "Suppressed or snoozed.");
  }
  if (input.dietaryConflict || input.preferenceFit === "conflict") {
    return ineligible(input, missingCount, "Hard preference conflict.");
  }
  if (input.wouldNotChooseAgain) {
    return ineligible(input, missingCount, "Marked would not choose again.");
  }
  if (!input.isFavorite && !input.wouldMakeAgain) {
    return ineligible(input, missingCount, "No strong positive feedback.");
  }
  if (input.okayOnly && !input.isFavorite && !input.wouldMakeAgain) {
    return ineligible(input, missingCount, "Neutral feedback only.");
  }

  const days = input.daysSincePrepared;
  if (!input.neverPrepared && days != null && days < minDaysSincePrepared) {
    return ineligible(input, missingCount, "Prepared too recently.");
  }
  if (!input.neverPrepared && days != null && days < input.expectedRevisitDays) {
    // Soft: still allow if well past half interval
    if (days < input.expectedRevisitDays * 0.75) {
      return ineligible(input, missingCount, "Within expected revisit interval.");
    }
  }

  if (input.isFavorite) {
    score += 40;
    reasonCodes.push("favorite");
  }
  if (input.wouldMakeAgain) {
    score += 30;
    reasonCodes.push("would_make_again");
  }
  if (days != null) {
    const overdue = Math.max(0, days - input.expectedRevisitDays);
    score += Math.min(35, overdue / 3);
    reasonCodes.push("time_since_prepared");
  } else if (input.neverPrepared) {
    score += 5;
  }

  const coverage =
    input.pantryTotal > 0 ? input.pantryHave / input.pantryTotal : 0;
  score += coverage * 25;
  reasonCodes.push("pantry_coverage");
  score += Math.min(15, input.shoppingOverlap * 5);
  if (input.shoppingOverlap > 0) reasonCodes.push("shopping_overlap");
  score -= missingCount * 4;
  if (input.useSoonBonus) {
    score += 8;
    reasonCodes.push("use_soon");
  }
  if (input.guestFriendly) {
    score += 6;
    reasonCodes.push("guest_friendly");
  }
  if (input.mealPrepFavorite) {
    score += 6;
    reasonCodes.push("meal_prep");
  }
  if (input.preferenceFit === "strong" || input.preferenceFit === "positive") {
    score += 10;
  }
  if (input.preferenceFit === "negative" || input.preferenceFit === "mixed") {
    score -= 12;
  }

  const weeks =
    days != null ? Math.max(1, Math.round(days / 7)) : null;
  const explanation = [
    "Forgotten favorite",
    input.isFavorite || input.wouldMakeAgain
      ? "Expected participants previously marked this positively."
      : null,
    weeks != null ? `It was last prepared about ${weeks} weeks ago.` : null,
    input.pantryTotal > 0
      ? `You already have or are buying ${input.pantryHave} of ${input.pantryTotal} ingredients.`
      : null,
  ]
    .filter(Boolean)
    .join(" ");

  // Require practical context: liked + gap + some coverage or shopping overlap
  const practical =
    coverage >= 0.4 || input.shoppingOverlap >= 1 || missingCount <= 3;
  if (!practical || score < 40) {
    return ineligible(input, missingCount, "Weak rediscovery candidate.");
  }

  return {
    recipeId: input.recipeId,
    recipeName: input.recipeName,
    score,
    eligible: true,
    explanation,
    reasonCodes,
    pantryHave: input.pantryHave,
    pantryTotal: input.pantryTotal,
    preferenceFit: input.preferenceFit,
    missingCount,
  };
}

function ineligible(
  input: RediscoveryCandidateInput,
  missingCount: number,
  reason: string,
): RediscoveryResult {
  return {
    recipeId: input.recipeId,
    recipeName: input.recipeName,
    score: 0,
    eligible: false,
    explanation: reason,
    reasonCodes: [],
    pantryHave: input.pantryHave,
    pantryTotal: input.pantryTotal,
    preferenceFit: input.preferenceFit,
    missingCount,
  };
}

export function shouldShowRediscovery(params: {
  cadence: RediscoveryCadence;
  daysSinceLastSuggestion: number | null;
  tripsSinceLastSuggestion: number;
  strongCandidateCount: number;
  hasAcceptedMeals: boolean;
}): boolean {
  if (params.cadence === "off") return false;
  if (params.strongCandidateCount === 0) return false;
  const days = params.daysSinceLastSuggestion ?? 999;
  switch (params.cadence) {
    case "weekly":
      return days >= 7;
    case "monthly":
      return days >= 28;
    case "every_other_trip":
      return params.tripsSinceLastSuggestion >= 2;
    case "smart":
      if (days < 5) return false;
      if (params.hasAcceptedMeals && days < 10) return false;
      return days >= 10 || params.tripsSinceLastSuggestion >= 2;
    default:
      return false;
  }
}
