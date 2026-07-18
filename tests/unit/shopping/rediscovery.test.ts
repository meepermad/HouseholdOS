import { describe, expect, it } from "vitest";
import {
  scoreRediscoveryCandidate,
  shouldShowRediscovery,
} from "@/lib/shopping/rediscovery/score";

const base = {
  recipeId: "r1",
  recipeName: "Chicken Alfredo",
  daysSincePrepared: 70,
  neverPrepared: false,
  isFavorite: true,
  wouldMakeAgain: true,
  wouldNotChooseAgain: false,
  okayOnly: false,
  dietaryConflict: false,
  pantryHave: 6,
  pantryTotal: 8,
  shoppingOverlap: 2,
  useSoonBonus: false,
  guestFriendly: false,
  mealPrepFavorite: false,
  snoozed: false,
  suppressed: false,
  dismissedRecently: false,
  expectedRevisitDays: 45,
  preferenceFit: "strong" as const,
};

describe("recipe rediscovery", () => {
  it("accepts liked recipes outside the rediscovery window with pantry coverage", () => {
    const result = scoreRediscoveryCandidate(base, 45);
    expect(result.eligible).toBe(true);
    expect(result.explanation).toMatch(/Forgotten favorite/i);
    expect(result.explanation).not.toMatch(/membership|user id/i);
  });

  it("rejects recipes prepared too recently", () => {
    const result = scoreRediscoveryCandidate(
      { ...base, daysSincePrepared: 10 },
      45,
    );
    expect(result.eligible).toBe(false);
  });

  it("rejects strong dislike", () => {
    const result = scoreRediscoveryCandidate(
      { ...base, wouldNotChooseAgain: true, preferenceFit: "conflict" },
      45,
    );
    expect(result.eligible).toBe(false);
  });

  it("rejects neutral-only recipes", () => {
    const result = scoreRediscoveryCandidate(
      {
        ...base,
        isFavorite: false,
        wouldMakeAgain: false,
        okayOnly: true,
        preferenceFit: "neutral",
      },
      45,
    );
    expect(result.eligible).toBe(false);
  });

  it("rejects suppressed and snoozed recipes", () => {
    expect(
      scoreRediscoveryCandidate({ ...base, suppressed: true }, 45).eligible,
    ).toBe(false);
    expect(
      scoreRediscoveryCandidate({ ...base, snoozed: true }, 45).eligible,
    ).toBe(false);
  });

  it("enforces smart cadence budget", () => {
    expect(
      shouldShowRediscovery({
        cadence: "smart",
        daysSinceLastSuggestion: 3,
        tripsSinceLastSuggestion: 0,
        strongCandidateCount: 2,
        hasAcceptedMeals: false,
      }),
    ).toBe(false);
    expect(
      shouldShowRediscovery({
        cadence: "smart",
        daysSinceLastSuggestion: 12,
        tripsSinceLastSuggestion: 1,
        strongCandidateCount: 2,
        hasAcceptedMeals: false,
      }),
    ).toBe(true);
    expect(
      shouldShowRediscovery({
        cadence: "off",
        daysSinceLastSuggestion: 100,
        tripsSinceLastSuggestion: 5,
        strongCandidateCount: 2,
        hasAcceptedMeals: false,
      }),
    ).toBe(false);
  });

  it("rejects dietary hard conflicts", () => {
    expect(
      scoreRediscoveryCandidate({ ...base, dietaryConflict: true }, 45).eligible,
    ).toBe(false);
  });

  it("scores shopping overlap and pantry coverage into explanation", () => {
    const result = scoreRediscoveryCandidate(
      { ...base, pantryHave: 8, pantryTotal: 10, shoppingOverlap: 3 },
      45,
    );
    expect(result.eligible).toBe(true);
    expect(result.score).toBeGreaterThan(0);
    expect(result.explanation).toMatch(/ingredients/i);
  });

  it("suppresses weak candidates when none are strong", () => {
    expect(
      shouldShowRediscovery({
        cadence: "smart",
        daysSinceLastSuggestion: 30,
        tripsSinceLastSuggestion: 3,
        strongCandidateCount: 0,
        hasAcceptedMeals: false,
      }),
    ).toBe(false);
  });

  it("keeps preference explanations privacy-safe", () => {
    const result = scoreRediscoveryCandidate(
      { ...base, preferenceFit: "mixed" },
      45,
    );
    expect(result.explanation).not.toMatch(/Atem|Andrew|membership_/i);
  });
});
