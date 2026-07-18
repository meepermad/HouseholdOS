import { describe, expect, it } from "vitest";
import { buildShoppingRecommendations } from "@/lib/shopping/recommendations/build";
import { consolidateCandidates } from "@/lib/shopping/recommendations/dedupe";
import { makeCandidate } from "@/lib/shopping/recommendations/candidates";
import { canonicalShoppingKey } from "@/lib/shopping/recommendations/normalize";

describe("shopping recommendations", () => {
  it("creates urgent candidate for soon accepted meal ingredient", () => {
    const items = buildShoppingRecommendations({
      mealIngredients: [
        {
          id: "1",
          name: "Chicken breast",
          quantity: 4,
          unit: "pound",
          mealLabel: "Tuesday dinner",
          mealId: "m1",
          accepted: true,
          soon: true,
        },
      ],
      openRequests: [],
      supplies: [],
      staples: [],
      sharedPurchases: [],
      forgotten: [],
      openListNormalizedKeys: [],
      horizonDays: 10,
      includeSupplyForecasts: true,
      includeRecurringStaples: true,
      includeProposedMeals: true,
      includeGuestNeeds: true,
      forecastConfidence: "medium",
      mode: "everything",
      today: "2026-07-18",
    });
    expect(items[0]?.name).toBe("Chicken breast");
    expect(items[0]?.priorityBand).toBe("urgent");
    expect(items[0]?.explanation).toMatch(/Tuesday/);
  });

  it("marks supply below threshold as recommended", () => {
    const items = buildShoppingRecommendations({
      mealIngredients: [],
      openRequests: [],
      supplies: [
        {
          id: "s1",
          name: "Dish soap",
          quantity: 1,
          reorderThreshold: 2,
          stockState: "low",
          projectedDaysRemaining: null,
          purchaseCount: 2,
        },
      ],
      staples: [],
      sharedPurchases: [],
      forgotten: [],
      openListNormalizedKeys: [],
      horizonDays: 10,
      includeSupplyForecasts: true,
      includeRecurringStaples: true,
      includeProposedMeals: true,
      includeGuestNeeds: true,
      forecastConfidence: "medium",
      mode: "running_low",
    });
    expect(items).toHaveLength(1);
    expect(items[0]?.reasonCodes).toContain("supply_below_threshold");
  });

  it("excludes low-confidence forecasts when threshold is high", () => {
    const items = buildShoppingRecommendations({
      mealIngredients: [],
      openRequests: [],
      supplies: [
        {
          id: "s1",
          name: "Paper towels",
          quantity: 5,
          reorderThreshold: 1,
          stockState: "in_stock",
          projectedDaysRemaining: 4,
          purchaseCount: 1,
        },
      ],
      staples: [],
      sharedPurchases: [],
      forgotten: [],
      openListNormalizedKeys: [],
      horizonDays: 10,
      includeSupplyForecasts: true,
      includeRecurringStaples: true,
      includeProposedMeals: true,
      includeGuestNeeds: true,
      forecastConfidence: "high",
      mode: "everything",
    });
    expect(items).toHaveLength(0);
  });

  it("consolidates compatible units and flags mismatches", () => {
    const a = makeCandidate({
      name: "Dish Soap",
      priorityBand: "recommended",
      suggestedQuantity: 1,
      suggestedUnit: "bottle",
      explanation: "Below threshold.",
      reasonCodes: ["supply_below_threshold"],
      sources: [],
      modeTags: ["running_low"],
    });
    const b = makeCandidate({
      name: "dishwashing liquid",
      priorityBand: "consider",
      suggestedQuantity: 1,
      suggestedUnit: "bottle",
      explanation: "Open request.",
      reasonCodes: ["open_shopping_request"],
      sources: [],
      modeTags: ["open_requests"],
    });
    expect(canonicalShoppingKey("Dish Soap")).toBe(
      canonicalShoppingKey("dishwashing liquid"),
    );
    const merged = consolidateCandidates([a, b]);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.suggestedQuantity).toBe(2);
    expect(merged[0]?.unitMismatch).toBe(false);

    const c = makeCandidate({
      name: "Dish Soap",
      priorityBand: "recommended",
      suggestedQuantity: 1,
      suggestedUnit: "bottle",
      explanation: "A",
      reasonCodes: ["a"],
      sources: [],
      modeTags: ["running_low"],
    });
    const d = makeCandidate({
      name: "dish soap",
      priorityBand: "recommended",
      suggestedQuantity: 2,
      suggestedUnit: "ounce",
      explanation: "B",
      reasonCodes: ["b"],
      sources: [],
      modeTags: ["running_low"],
    });
    const mismatched = consolidateCandidates([c, d]);
    expect(mismatched[0]?.unitMismatch).toBe(true);
  });

  it("keeps personal and shared candidates separate", () => {
    const shared = makeCandidate({
      name: "Rice",
      priorityBand: "consider",
      visibility: "shared",
      explanation: "Staple",
      reasonCodes: ["recurring_staple"],
      sources: [],
      modeTags: ["recurring_staples"],
    });
    const personal = makeCandidate({
      name: "Rice",
      priorityBand: "recommended",
      visibility: "personal",
      ownerMembershipId: "m1",
      explanation: "Personal request",
      reasonCodes: ["open_shopping_request"],
      sources: [],
      modeTags: ["open_requests"],
    });
    const merged = consolidateCandidates([shared, personal]);
    expect(merged).toHaveLength(2);
  });

  it("surfaces forgotten items", () => {
    const items = buildShoppingRecommendations({
      mealIngredients: [],
      openRequests: [],
      supplies: [],
      staples: [],
      sharedPurchases: [],
      forgotten: [{ id: "e1", name: "Parmesan", quantity: 1, unit: "item" }],
      openListNormalizedKeys: [],
      horizonDays: 10,
      includeSupplyForecasts: true,
      includeRecurringStaples: true,
      includeProposedMeals: true,
      includeGuestNeeds: true,
      forecastConfidence: "medium",
      mode: "forgotten",
    });
    expect(items[0]?.reasonCodes).toContain("forgotten_item");
  });

  it("skips candidates already on the open list", () => {
    const items = buildShoppingRecommendations({
      mealIngredients: [
        {
          id: "1",
          name: "Chicken breast",
          quantity: 2,
          unit: "pound",
          mealLabel: "Dinner",
          mealId: "m1",
          accepted: true,
          soon: true,
        },
      ],
      openRequests: [],
      supplies: [],
      staples: [],
      sharedPurchases: [],
      forgotten: [],
      openListNormalizedKeys: [canonicalShoppingKey("Chicken breast")],
      horizonDays: 10,
      includeSupplyForecasts: true,
      includeRecurringStaples: true,
      includeProposedMeals: true,
      includeGuestNeeds: true,
      forecastConfidence: "medium",
      mode: "everything",
    });
    expect(items).toHaveLength(0);
  });

  it("includes guest-related meal needs in guest_event mode", () => {
    const items = buildShoppingRecommendations({
      mealIngredients: [
        {
          id: "1",
          name: "Paper plates",
          quantity: 20,
          unit: "item",
          mealLabel: "Saturday guest dinner",
          mealId: "m2",
          accepted: true,
          soon: true,
          guestRelated: true,
        },
      ],
      openRequests: [],
      supplies: [],
      staples: [],
      sharedPurchases: [],
      forgotten: [],
      openListNormalizedKeys: [],
      horizonDays: 10,
      includeSupplyForecasts: true,
      includeRecurringStaples: true,
      includeProposedMeals: true,
      includeGuestNeeds: true,
      forecastConfidence: "medium",
      mode: "guest_event",
    });
    expect(items[0]?.priorityBand).toBe("urgent");
    expect(items[0]?.explanation).toMatch(/Saturday guest dinner/);
  });

  it("includes recurring staples approaching interval", () => {
    const items = buildShoppingRecommendations({
      mealIngredients: [],
      openRequests: [],
      supplies: [],
      staples: [
        {
          id: "st1",
          name: "Rice",
          relatedSupplyId: null,
          typicalIntervalDays: 35,
          daysSinceLastPurchase: 42,
          lastQuantity: 1,
          unit: "bag",
          purchaseCount: 3,
        },
      ],
      sharedPurchases: [],
      forgotten: [],
      openListNormalizedKeys: [],
      horizonDays: 10,
      includeSupplyForecasts: true,
      includeRecurringStaples: true,
      includeProposedMeals: true,
      includeGuestNeeds: true,
      forecastConfidence: "medium",
      mode: "recurring_staples",
    });
    expect(items[0]?.reasonCodes).toContain("recurring_staple");
    expect(items[0]?.priorityBand).toBe("consider");
  });

  it("orders urgent before consider", () => {
    const items = buildShoppingRecommendations({
      mealIngredients: [
        {
          id: "1",
          name: "Chicken",
          quantity: 1,
          unit: "pound",
          mealLabel: "Tonight",
          mealId: "m1",
          accepted: true,
          soon: true,
        },
      ],
      openRequests: [],
      supplies: [],
      staples: [
        {
          id: "st1",
          name: "Rice",
          relatedSupplyId: null,
          typicalIntervalDays: 35,
          daysSinceLastPurchase: 40,
          lastQuantity: 1,
          unit: "bag",
          purchaseCount: 3,
        },
      ],
      sharedPurchases: [],
      forgotten: [],
      openListNormalizedKeys: [],
      horizonDays: 10,
      includeSupplyForecasts: true,
      includeRecurringStaples: true,
      includeProposedMeals: true,
      includeGuestNeeds: true,
      forecastConfidence: "medium",
      mode: "everything",
    });
    const bands = items.map((i) => i.priorityBand);
    const urgentIdx = bands.indexOf("urgent");
    const considerIdx = bands.indexOf("consider");
    expect(urgentIdx).toBeGreaterThanOrEqual(0);
    expect(considerIdx).toBeGreaterThan(urgentIdx);
  });
});
