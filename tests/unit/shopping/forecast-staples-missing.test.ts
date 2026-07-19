import { describe, expect, it } from "vitest";
import {
  FORECAST_FORMULA_VERSION,
  confidenceMeetsThreshold,
  projectRunout,
} from "@/lib/shopping/forecast";
import { buildRecurringStapleCandidates } from "@/lib/shopping/staples";
import { buildRediscoveryMissingIngredientProposal } from "@/lib/shopping/rediscovery/missing-ingredients";

describe("supply runout forecast v1", () => {
  it("projects days from consistent restock/use history", () => {
    const result = projectRunout({
      supplyId: "s1",
      name: "Trash bags",
      currentQuantity: 10,
      quantityUnit: "item",
      reorderThreshold: 2,
      targetQuantity: 20,
      stockState: "in_stock",
      eventUnitsConsistent: true,
      now: new Date("2026-07-19T00:00:00Z"),
      events: [
        {
          eventType: "restocked",
          previousQuantity: 0,
          newQuantity: 20,
          createdAt: "2026-06-01T00:00:00Z",
        },
        {
          eventType: "used",
          previousQuantity: 20,
          newQuantity: 10,
          createdAt: "2026-06-21T00:00:00Z",
        },
        {
          eventType: "counted",
          previousQuantity: 10,
          newQuantity: 10,
          createdAt: "2026-07-01T00:00:00Z",
        },
      ],
    });
    expect(result.formulaVersion).toBe(FORECAST_FORMULA_VERSION);
    expect(result.projectedDaysRemaining).not.toBeNull();
    expect(result.explanation).toMatch(/about/i);
    expect(result.explanation).toMatch(/Estimate based on/i);
    expect(confidenceMeetsThreshold(result.confidence, "low")).toBe(true);
  });

  it("keeps threshold recommendation when forecast confidence is insufficient", () => {
    const result = projectRunout({
      supplyId: "s2",
      name: "Dish soap",
      currentQuantity: 1,
      quantityUnit: "bottle",
      reorderThreshold: 2,
      targetQuantity: 3,
      stockState: "low",
      eventUnitsConsistent: true,
      events: [
        {
          eventType: "restocked",
          previousQuantity: 0,
          newQuantity: 2,
          createdAt: "2026-07-18T00:00:00Z",
        },
      ],
    });
    expect(result.belowThreshold).toBe(true);
    expect(result.projectedDaysRemaining).toBeNull();
    expect(result.reasonCodes).toContain("supply_below_threshold");
  });

  it("does not invent runout when units are incompatible", () => {
    const result = projectRunout({
      supplyId: "s3",
      name: "Rice",
      currentQuantity: 5,
      quantityUnit: "pound",
      reorderThreshold: 1,
      targetQuantity: 10,
      stockState: "in_stock",
      eventUnitsConsistent: false,
      events: [],
    });
    expect(result.projectedDaysRemaining).toBeNull();
    expect(result.reasonCodes).toContain("forecast_unit_mismatch");
  });
});

describe("recurring staples", () => {
  it("requires minimum consistent history and explains basis", () => {
    const candidates = buildRecurringStapleCandidates(
      [
        {
          supplyId: "s1",
          name: "Rice",
          unit: "bag",
          ownershipMode: "household",
          archived: false,
          suppressed: false,
          restocks: [
            { at: "2026-01-01T00:00:00Z", quantity: 1 },
            { at: "2026-02-05T00:00:00Z", quantity: 1 },
            { at: "2026-03-12T00:00:00Z", quantity: 1 },
            { at: "2026-04-16T00:00:00Z", quantity: 1 },
          ],
        },
      ],
      { minPurchaseCount: 3, now: new Date("2026-07-19T00:00:00Z") },
    );
    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.explanation).toMatch(/Usually purchased/i);
    expect(candidates[0]?.explanation).toMatch(/Estimate based on 4 purchases/);
  });

  it("excludes personal ownership and suppressed items", () => {
    const candidates = buildRecurringStapleCandidates(
      [
        {
          supplyId: "s1",
          name: "Personal snacks",
          unit: "bag",
          ownershipMode: "personal",
          archived: false,
          suppressed: false,
          restocks: [
            { at: "2026-01-01T00:00:00Z", quantity: 1 },
            { at: "2026-02-01T00:00:00Z", quantity: 1 },
            { at: "2026-03-01T00:00:00Z", quantity: 1 },
          ],
        },
        {
          supplyId: "s2",
          name: "Paper towels",
          unit: "pack",
          ownershipMode: "household",
          archived: false,
          suppressed: true,
          restocks: [
            { at: "2026-01-01T00:00:00Z", quantity: 1 },
            { at: "2026-02-01T00:00:00Z", quantity: 1 },
            { at: "2026-03-01T00:00:00Z", quantity: 1 },
          ],
        },
      ],
      { minPurchaseCount: 3, now: new Date("2026-07-19T00:00:00Z") },
    );
    expect(candidates).toHaveLength(0);
  });
});

describe("rediscovery missing ingredients", () => {
  it("builds review-first proposal without trusting snapshot alone", () => {
    const proposal = buildRediscoveryMissingIngredientProposal({
      ingredients: [
        {
          id: "i1",
          displayName: "Parmesan",
          quantity: "1",
          unit: "item",
          quantityMode: "exact",
          required: true,
        },
        {
          id: "i2",
          displayName: "Salt",
          quantity: "1",
          unit: "teaspoon",
          quantityMode: "to_taste",
          required: false,
        },
      ],
      pantry: [],
      activeShopping: [],
    });
    expect(proposal.policyNote).toBe("review_first");
    expect(proposal.actionableCount).toBeGreaterThanOrEqual(1);
    const parmesan = proposal.lines.find((l) => l.displayName === "Parmesan");
    expect(parmesan?.lineStatus).toBe("missing");
    expect(parmesan?.excluded).toBe(false);
  });

  it("marks already-on-list items for quantity review instead of blind create", () => {
    const proposal = buildRediscoveryMissingIngredientProposal({
      ingredients: [
        {
          id: "i1",
          displayName: "Bell peppers",
          quantity: "3",
          unit: "item",
          quantityMode: "exact",
          required: true,
        },
      ],
      pantry: [],
      activeShopping: [
        {
          id: "shop1",
          name: "Bell peppers",
          quantity: "1",
          unit: "item",
          status: "requested",
          relatedRecipeIngredientId: "i1",
          relatedMealPlanId: null,
        },
      ],
    });
    const line = proposal.lines.find((l) => l.displayName === "Bell peppers");
    expect(line?.alreadyOnList).toBe(true);
    expect(line?.existingListItemId).toBe("shop1");
  });
});
