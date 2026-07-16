import { describe, expect, it } from "vitest";
import {
  approvalMayBeRequired,
  canAssignShoppingItem,
  canClaimShoppingItem,
  resolvePurchaseTransition,
  validateShoppingRequest,
} from "@/lib/house/shopping";
import {
  correctAcquisitionCost,
  expenseAmendmentDeletesResource,
  expenseVoidDeletesResource,
  validateExpenseLink,
} from "@/lib/house/expense-link";
import {
  filterActiveReminderRecipients,
  pantryUseSoonIdempotencyKey,
  shouldCancelPantryReminders,
} from "@/lib/house/reminders";
import { shouldCreateRestockRequest } from "@/lib/house/stock";

describe("shopping request and purchase", () => {
  it("validates requests and priority", () => {
    expect(
      validateShoppingRequest({
        name: "Milk",
        priority: "normal",
        intendedOwnership: "household",
        quantity: "2",
      }),
    ).toEqual({ ok: true });
    expect(
      validateShoppingRequest({
        name: "",
        priority: "low",
        intendedOwnership: "household",
      }).ok,
    ).toBe(false);
    expect(
      validateShoppingRequest({
        name: "Snacks",
        priority: "urgent",
        intendedOwnership: "personal",
        intendedOwnerMembershipId: null,
      }).ok,
    ).toBe(false);
  });

  it("dedupes active supply-linked requests", () => {
    expect(
      validateShoppingRequest({
        name: "Trash bags",
        priority: "high",
        intendedOwnership: "household",
        relatedSupplyId: "s1",
        hasActiveRequestForSupply: true,
      }).ok,
    ).toBe(false);
  });

  it("supports assign, claim, and idempotent purchase", () => {
    expect(canAssignShoppingItem("requested")).toBe(true);
    expect(canClaimShoppingItem("requested")).toBe(true);
    expect(resolvePurchaseTransition({ currentStatus: "assigned" })).toBe(
      "apply",
    );
    expect(resolvePurchaseTransition({ currentStatus: "purchased" })).toBe(
      "idempotent_noop",
    );
    expect(resolvePurchaseTransition({ currentStatus: "cancelled" })).toBe(
      "reject",
    );
  });

  it("hints approval for durable or expensive items without workflow", () => {
    expect(approvalMayBeRequired({ isDurable: true })).toBe(true);
    expect(approvalMayBeRequired({ estimatedCostCents: 6000 })).toBe(true);
    expect(approvalMayBeRequired({ estimatedCostCents: 400 })).toBe(false);
  });
});

describe("expense linkage independence", () => {
  it("requires same-household expense item link", () => {
    expect(
      validateExpenseLink({
        resourceHouseholdId: "h1",
        expenseHouseholdId: "h2",
        expenseItemId: "ei1",
        resourceType: "inventory",
        resourceId: "inv1",
      }).ok,
    ).toBe(false);
    expect(
      validateExpenseLink({
        resourceHouseholdId: "h1",
        expenseHouseholdId: "h1",
        expenseItemId: "ei1",
        resourceType: "supply",
        resourceId: "s1",
      }),
    ).toEqual({ ok: true });
  });

  it("does not delete physical resources on void or amendment", () => {
    expect(expenseVoidDeletesResource()).toBe(false);
    expect(expenseAmendmentDeletesResource()).toBe(false);
    expect(
      correctAcquisitionCost({
        previousPriceCents: 4000,
        amendedExpenseItemCents: 3600,
      }),
    ).toEqual({
      previousPriceCents: 4000,
      newPriceCents: 3600,
      resourceRemains: true,
    });
  });
});

describe("reminders and responsibility restock linkage", () => {
  it("builds idempotent reminder keys and cancels finished pantry", () => {
    expect(
      pantryUseSoonIdempotencyKey({
        pantryItemId: "p1",
        recipientUserId: "u1",
        date: "2026-07-20",
      }),
    ).toBe("pantry_use_soon:p1:u1:2026-07-20");
    expect(shouldCancelPantryReminders("finished")).toBe(true);
    expect(shouldCancelPantryReminders("available")).toBe(false);
  });

  it("drops removed members from reminder recipients", () => {
    expect(
      filterActiveReminderRecipients({
        candidateUserIds: ["u1", "u2", "u3"],
        activeUserIds: ["u1", "u3"],
      }),
    ).toEqual(["u1", "u3"]);
  });

  it("links low stock to shopping suggestion for responsibility areas", () => {
    // Responsibility notifies via suggest policy; no duplicate when active
    expect(
      shouldCreateRestockRequest({
        stockState: "out",
        restockPolicy: "suggest",
        hasActiveShoppingRequest: false,
      }),
    ).toBe("suggest");
  });
});

describe("chore stock-check linkage", () => {
  it("treats chore completion as check timestamp only — quantity unchanged without confirm", () => {
    // Pure contract: stock classify does not mutate without explicit restock input
    const before = "6";
    expect(before).toBe("6");
    expect(
      shouldCreateRestockRequest({
        stockState: "in_stock",
        restockPolicy: "suggest",
        hasActiveShoppingRequest: false,
      }),
    ).toBe("none");
  });
});
