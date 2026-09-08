import { describe, expect, it } from "vitest";
import { parsePastedCents } from "@/lib/receipts/paste/cents";
import { PASTE_FIXTURE_ALDI } from "@/lib/receipts/paste/fixtures";
import { normalizeReceiptPasteInput } from "@/lib/receipts/paste/normalize";
import { parseHouseholdOsReceipt } from "@/lib/receipts/paste/parse";
import { pastedReceiptToExtraction } from "@/lib/receipts/paste/to-extraction";
import { reconcileLineItemsWithTotal } from "@/lib/receipts/totals";
import { allocateQuantityClaims } from "@/lib/receipts/claims";
import { buildReceiptExpenseItems } from "@/lib/receipts/split-preview";
import { planReceiptAdjustments } from "@/lib/receipts/expense-handoff";

describe("quantity semantics: amount is the line total", () => {
  it("does not multiply ALDI line totals by quantity in parser, extraction, or totals", () => {
    const parsed = parseHouseholdOsReceipt(PASTE_FIXTURE_ALDI);
    expect(parsed.ok).toBe(true);
    const egg = parsed.receipt!.items.find((i) => i.description === "Egg Rolls")!;
    expect(egg.totalCents).toBe(778);
    expect(egg.quantity).toBe(2);
    expect(egg.derivedUnitPriceCents).toBe(389);

    const extraction = pastedReceiptToExtraction(parsed.receipt!);
    const extractedEgg = extraction.lineItems.find((i) => i.name === "Egg Rolls")!;
    expect(extractedEgg.totalPriceCents).toBe(778);
    expect(extractedEgg.lineTotalCents).toBe(778);
    expect(extractedEgg.quantity).toBe(2);
    expect(extractedEgg.unitPriceCents).toBe(389);
    expect(extractedEgg.derivedUnitPriceCents).toBe(389);

    const totals = reconcileLineItemsWithTotal({
      lineItems: extraction.lineItems,
      subtotalCents: parsed.receipt!.subtotalCents,
      taxCents: parsed.receipt!.taxCents,
      tipCents: parsed.receipt!.tipCents,
      totalCents: parsed.receipt!.totalCents,
    });
    expect(totals.lineSumCents).toBe(10817);
    expect(totals.balanced).toBe(true);
  });

  it("allocates claims against the line total, not unit price × quantity twice", () => {
    const split = allocateQuantityClaims({
      totalCents: 778,
      totalQuantity: 2,
      claims: [
        { membershipId: "a", quantity: 1, kind: "quantity" },
        { membershipId: "b", quantity: 1, kind: "quantity" },
      ],
    });
    expect(split.reduce((sum, row) => sum + row.amountCents, 0)).toBe(778);
    expect(split.every((row) => row.amountCents === 389)).toBe(true);
  });

  it("builds expense items from line totals", () => {
    const items = buildReceiptExpenseItems({
      lines: [
        {
          id: "egg",
          name: "Egg Rolls",
          totalCents: 778,
          classification: "shared_household",
          participantMembershipIds: [],
          quantity: 2,
        },
      ],
      purchaserMembershipId: "payer",
      eligibleMembershipIds: ["payer", "other"],
      declaredTotalCents: 11136,
    });
    expect(items[0]?.totalCents).toBe(778);
  });

  it("plans tax from item subtotal without multiplying quantities", () => {
    const plans = planReceiptAdjustments({
      declaredTotalCents: 11136,
      itemSubtotalCents: 10817,
      taxCents: 319,
      tipCents: null,
    });
    expect(plans.find((p) => p.type === "tax")?.amountCents).toBe(319);
  });
});

describe("normalization stays out of financial guessing", () => {
  it("does not turn OCR-like letters into digits", () => {
    expect(parsePastedCents("$5O.41").ok).toBe(false);
    expect(parsePastedCents("55.4.1").ok).toBe(false);
  });

  it("maps unicode dollars after NFKC without changing ASCII names", () => {
    const normalized = normalizeReceiptPasteInput("Total: ＄12.00\nHershey's Baking Cocoa");
    expect(normalized.text).toContain("Hershey's Baking Cocoa");
    expect(parsePastedCents("＄12.00").ok).toBe(true);
  });
});
