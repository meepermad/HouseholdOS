import { describe, expect, it } from "vitest";
import {
  addQuantities,
  assertGuestFreePantryModel,
  assertNoPortionOwnership,
  assertSameUnit,
  classifySupplyStock,
  compareQuantities,
  parseQuantity,
  quantityToScaled,
} from "@/lib/house/quantity";
import {
  applyRestock,
  buildStockCorrection,
  classifyLeftoverRemaining,
  shouldCreateRestockRequest,
} from "@/lib/house/stock";
import {
  classifyPantryDateState,
  isEnteredDatePassed,
  isUseSoon,
  pantryStateFromDates,
} from "@/lib/house/pantry-dates";
import {
  resolveResourceProjection,
  projectPersonalItemForViewer,
} from "@/lib/house/visibility";

describe("quantity decimal safety", () => {
  it("parses fixed decimals and rejects excess precision", () => {
    expect(parseQuantity("3.5")).toEqual({ ok: true, canonical: "3.5" });
    expect(parseQuantity("1.234").ok).toBe(true);
    expect(parseQuantity("1.2345").ok).toBe(false);
    expect(quantityToScaled("1.5")).toBe(BigInt(1500));
  });

  it("adds and compares without float drift", () => {
    expect(addQuantities("0.1", "0.2")).toBe("0.3");
    expect(compareQuantities("3", "3.0")).toBe(0);
    expect(compareQuantities("2", "3")).toBe(-1);
  });

  it("refuses cross-unit conversion", () => {
    expect(assertSameUnit("roll", "roll")).toEqual({ ok: true });
    expect(assertSameUnit("roll", "pack").ok).toBe(false);
  });
});

describe("supply stock classification", () => {
  it("classifies exact and approximate quantities", () => {
    expect(
      classifySupplyStock({
        quantity: "12",
        reorderThreshold: "3",
      }),
    ).toBe("in_stock");
    expect(
      classifySupplyStock({
        quantity: "3",
        reorderThreshold: "3",
      }),
    ).toBe("low");
    expect(
      classifySupplyStock({
        quantity: "0",
        reorderThreshold: "3",
      }),
    ).toBe("out");
    expect(
      classifySupplyStock({
        quantity: null,
        reorderThreshold: null,
      }),
    ).toBe("unknown");
  });

  it("respects explicit low/out even when quantity present", () => {
    expect(
      classifySupplyStock({
        quantity: "10",
        reorderThreshold: "2",
        explicitState: "low",
      }),
    ).toBe("low");
  });

  it("restocks and corrects stock", () => {
    const restocked = applyRestock({
      currentQuantity: "4",
      restockAmount: "8",
      unit: "roll",
      currentUnit: "roll",
    });
    expect(restocked).toMatchObject({ ok: true, newQuantity: "12" });

    const cross = applyRestock({
      currentQuantity: "4",
      restockAmount: "8",
      unit: "pack",
      currentUnit: "roll",
    });
    expect(cross.ok).toBe(false);

    const correction = buildStockCorrection({
      expectedQuantity: "6",
      actualQuantity: "4",
      reason: "Household count",
    });
    expect(correction).toMatchObject({
      delta: "-2",
      newQuantity: "4",
      eventType: "corrected",
    });
  });

  it("dedupes active restock requests", () => {
    expect(
      shouldCreateRestockRequest({
        stockState: "low",
        restockPolicy: "suggest",
        hasActiveShoppingRequest: false,
      }),
    ).toBe("suggest");
    expect(
      shouldCreateRestockRequest({
        stockState: "low",
        restockPolicy: "automatic",
        hasActiveShoppingRequest: true,
      }),
    ).toBe("none");
    expect(
      shouldCreateRestockRequest({
        stockState: "low",
        restockPolicy: "automatic",
        hasActiveShoppingRequest: false,
      }),
    ).toBe("create");
  });
});

describe("pantry dates and leftovers", () => {
  it("classifies use-soon and entered-date-passed without safety claims", () => {
    expect(
      isUseSoon({ useSoon: "2026-07-10", asOf: "2026-07-16" }),
    ).toBe(true);
    expect(
      isEnteredDatePassed({ useBy: "2026-07-15", asOf: "2026-07-16" }),
    ).toBe(true);
    const classified = classifyPantryDateState({
      useBy: "2026-07-15",
      asOf: "2026-07-16",
    });
    expect(classified.reviewLabel).toContain("Past entered date");
    expect(classified.reviewLabel).toContain("Review before use");
    expect(pantryStateFromDates({ useBy: "2026-07-15", asOf: "2026-07-16" })).toBe(
      "expired",
    );
  });

  it("supports leftover approximate remaining states", () => {
    expect(classifyLeftoverRemaining("about_half")).toBe("about_half");
    expect(classifyLeftoverRemaining("plenty")).toBe("plenty");
  });

  it("enforces guest-free and no portion ownership", () => {
    expect(assertGuestFreePantryModel({ ownerMembershipId: "m1" })).toEqual({
      ok: true,
    });
    expect(
      assertGuestFreePantryModel({
        ownerMembershipId: null,
        guestIds: ["g1"],
      }).ok,
    ).toBe(false);
    expect(assertNoPortionOwnership({})).toEqual({ ok: true });
    expect(
      assertNoPortionOwnership({ portionMembershipIds: ["m1"] }).ok,
    ).toBe(false);
  });

  it("projects personal pantry safely", () => {
    const mode = resolveResourceProjection({
      visibility: "owner_only",
      ownershipMode: "personal",
      ownerMembershipId: "m1",
      selectedMembershipIds: [],
      viewerMembershipId: "m2",
      isHouseholdCoordinator: false,
    });
    expect(
      projectPersonalItemForViewer({
        item: { id: "p1", notes: "dietary" },
        mode,
      }),
    ).toBeNull();
  });

  it("marks communal pantry as household-visible", () => {
    expect(
      resolveResourceProjection({
        visibility: "household",
        ownershipMode: "household",
        ownerMembershipId: null,
        selectedMembershipIds: [],
        viewerMembershipId: "m2",
        isHouseholdCoordinator: false,
      }),
    ).toBe("full");
  });
});
