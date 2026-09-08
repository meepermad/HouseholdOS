import { describe, expect, it } from "vitest";
import { copyFormatExample, PASTE_FIXTURES } from "@/lib/receipts/paste/fixtures";
import { normalizeReceiptPasteInput } from "@/lib/receipts/paste/normalize";
import { parseHouseholdOsReceipt } from "@/lib/receipts/paste/parse";
import { canContinueItemized } from "@/lib/receipts/paste/problems";
import { reconcilePastedReceipt } from "@/lib/receipts/paste/reconcile";

const WALMART = PASTE_FIXTURES[0]!.text;

function expectFixture(id: (typeof PASTE_FIXTURES)[number]["id"]) {
  const fixture = PASTE_FIXTURES.find((row) => row.id === id)!;
  const result = parseHouseholdOsReceipt(fixture.text);
  expect(result.ok).toBe(true);
  expect(result.receipt?.merchant).toBe(fixture.expected.merchant);
  expect(result.receipt?.purchaseDate).toBe(fixture.expected.purchaseDate);
  expect(result.receipt?.totalCents).toBe(fixture.expected.totalCents);
  expect(result.receipt?.subtotalCents).toBe(fixture.expected.subtotalCents);
  expect(result.receipt?.taxCents).toBe(fixture.expected.taxCents);
  expect(result.receipt?.items).toHaveLength(fixture.expected.itemCount);
  const itemSubtotal = result.receipt!.items.reduce((sum, item) => sum + item.totalCents, 0);
  expect(itemSubtotal).toBe(fixture.expected.itemSubtotalCents);
  expect(reconcilePastedReceipt(result.receipt!).balanced).toBe(fixture.expected.reconciled);
}

describe("operator paste fixtures", () => {
  it("parses the exact Walmart operator fixture", () => {
    expectFixture("walmart");
  });

  it("parses Dollar General", () => {
    expectFixture("dollar_general");
  });

  it("parses ALDI without multiplying line totals by quantity", () => {
    expectFixture("aldi");
    const result = parseHouseholdOsReceipt(PASTE_FIXTURES.find((f) => f.id === "aldi")!.text);
    const penne = result.receipt!.items.find((i) => i.description === "Penne Pasta");
    expect(penne).toMatchObject({ totalCents: 218, quantity: 2, derivedUnitPriceCents: 109 });
    const eggRolls = result.receipt!.items.find((i) => i.description === "Egg Rolls");
    expect(eggRolls).toMatchObject({ totalCents: 778, quantity: 2, derivedUnitPriceCents: 389 });
    const itemSum = result.receipt!.items.reduce((sum, item) => sum + item.totalCents, 0);
    expect(itemSum).toBe(10817);
    expect(itemSum).not.toBe(218 * 2 + (10817 - 218));
  });

  it("parses punctuation descriptions", () => {
    expectFixture("punctuation");
  });

  it("parses the copy-format example with the same parser", () => {
    const result = parseHouseholdOsReceipt(copyFormatExample());
    expect(result.ok).toBe(true);
    expect(copyFormatExample()).toBe(WALMART);
  });
});

describe("ChatGPT copy path", () => {
  it("parses a markdown text fence", () => {
    const result = parseHouseholdOsReceipt("```text\n" + WALMART + "```\n");
    expect(result.ok).toBe(true);
    expect(result.receipt?.merchant).toBe("Walmart");
    expect(result.receipt?.items).toHaveLength(6);
  });

  it("parses a generic markdown fence", () => {
    const result = parseHouseholdOsReceipt("```\n" + WALMART + "```\n");
    expect(result.ok).toBe(true);
    expect(result.receipt?.totalCents).toBe(5541);
  });

  it("parses surrounding ChatGPT prose and ignores the heading outside the block", () => {
    const result = parseHouseholdOsReceipt(
      `Here is the receipt:\n\n${WALMART}\nYou can paste this into HouseholdOS.\n`,
    );
    expect(result.ok).toBe(true);
    expect(result.receipt?.merchant).toBe("Walmart");

    const withHeading = parseHouseholdOsReceipt(
      `Walmart — September 4, 2026 — $55.41\n\n${WALMART}`,
    );
    expect(withHeading.ok).toBe(true);
    expect(withHeading.receipt?.totalCents).toBe(5541);
    expect(withHeading.receipt?.items).toHaveLength(6);
  });

  it("tolerates header colon, markdown bold, blockquotes, and zero-width spaces", () => {
    expect(parseHouseholdOsReceipt(WALMART.replace("HOUSEHOLDOS RECEIPT", "HOUSEHOLDOS RECEIPT:")).ok).toBe(true);
    expect(parseHouseholdOsReceipt(WALMART.replace("HOUSEHOLDOS RECEIPT", "**HOUSEHOLDOS RECEIPT**")).ok).toBe(true);
    expect(parseHouseholdOsReceipt(WALMART.replace("HOUSEHOLDOS RECEIPT", "HouseholdOS Receipt")).ok).toBe(true);
    const quoted = WALMART.split("\n").map((l) => (l ? `> ${l}` : ">")).join("\n");
    expect(parseHouseholdOsReceipt(quoted).ok).toBe(true);
    expect(parseHouseholdOsReceipt("\u200B" + WALMART).ok).toBe(true);
  });
});

describe("normalization and tolerant syntax", () => {
  it("normalizes unicode spaces, smart punctuation, and unicode pipes", () => {
    const weird = WALMART.replace(/ /g, "\u00A0")
      .replace("9-inch", "9\u2011inch")
      .replace(/ \| /g, " \u2502 ")
      .replace("Hershey's", "Hershey\u2019s");
    const normalized = normalizeReceiptPasteInput(weird);
    expect(normalized.text.includes("HOUSEHOLDOS RECEIPT")).toBe(true);
    const result = parseHouseholdOsReceipt(weird);
    expect(result.ok).toBe(true);
    expect(result.receipt?.items).toHaveLength(6);
  });

  it("keeps meaningful description punctuation", () => {
    const names = [
      "Hershey's Baking Cocoa",
      "Slap Ya Mama Low-Sodium Seasoning",
      "Boneless Skinless Chicken Thighs",
      "Great Value 9-inch Plates, 100 count",
      "Poo-Pourri Citrus Toilet Spray",
      "Fresh 80% Lean Ground Beef",
    ];
    for (const name of names) {
      const result = parseHouseholdOsReceipt(
        `HOUSEHOLDOS RECEIPT\nMerchant: Shop\nTotal: 1.00\nITEMS\n${name} | 1.00 | 1\nEND`,
      );
      expect(result.receipt?.items[0]?.description).toBe(name);
    }
  });

  it("accepts spaced field separators and dollar signs", () => {
    const result = parseHouseholdOsReceipt(
      `HOUSEHOLDOS RECEIPT:\nMerchant : Walmart\nDate: 2026-09-04\nTotal: $55.41\nSubtotal: 51.50\nTax: 3.91\nITEMS:\nMilk | $4.97 | 1\nEND:\n`,
    );
    expect(result.ok).toBe(true);
    expect(result.receipt?.merchant).toBe("Walmart");
    expect(result.receipt?.totalCents).toBe(5541);
  });

  it("rejects ambiguous money strings", () => {
    expect(parseHouseholdOsReceipt(`HOUSEHOLDOS RECEIPT\nMerchant: A\nTotal: 55.4.1\nITEMS\nX | 1\nEND`).ok).toBe(false);
    expect(parseHouseholdOsReceipt(`HOUSEHOLDOS RECEIPT\nMerchant: A\nTotal: $5O.41\nITEMS\nX | 1\nEND`).ok).toBe(false);
    expect(parseHouseholdOsReceipt(`HOUSEHOLDOS RECEIPT\nMerchant: A\nTotal: abc\nITEMS\nX | 1\nEND`).ok).toBe(false);
  });

  it("escapes pipes in descriptions and reports too many delimiters", () => {
    const escaped = parseHouseholdOsReceipt(
      `HOUSEHOLDOS RECEIPT\nMerchant: A\nTotal: 4.99\nITEMS\nCandy \\| Special Edition | 4.99 | 1\nEND`,
    );
    expect(escaped.receipt?.items[0]?.description).toBe("Candy | Special Edition");
    expect(escaped.receipt?.items[0]?.totalCents).toBe(499);

    const tooMany = parseHouseholdOsReceipt(
      `HOUSEHOLDOS RECEIPT\nMerchant: A\nTotal: 4.99\nITEMS\nCandy | Special | Edition | 4.99 | 1\nEND`,
    );
    expect(tooMany.receipt?.merchant).toBe("A");
    expect(tooMany.receipt?.items).toHaveLength(0);
    expect(tooMany.problems.some((p) => p.code === "too_many_delimiters")).toBe(true);
    expect(tooMany.problems[0]?.originalLine).toContain("Candy | Special | Edition");
    expect(tooMany.problems[0]?.suggestedAction).toMatch(/\\\|/);
  });

  it("keeps 8 parsed items when 1 item line fails", () => {
    const result = parseHouseholdOsReceipt(
      `HOUSEHOLDOS RECEIPT\nMerchant: Shop\nTotal: 10.00\nITEMS
Milk | 1.00 | 1
Bread | 1.00 | 1
Eggs | 1.00 | 1
Butter | 1.00 | 1
Cheese | 1.00 | 1
Apples | 1.00 | 1
Bananas | 1.00 | 1
Yogurt | 1.00 | 1
Broken | nope | 1
END`,
    );
    expect(result.receipt?.merchant).toBe("Shop");
    expect(result.receipt?.items).toHaveLength(8);
    expect(result.problems.some((p) => p.originalLine?.includes("Broken"))).toBe(true);
    expect(
      canContinueItemized({
        merchant: result.receipt!.merchant,
        totalCents: result.receipt!.totalCents,
        problems: result.problems,
      }),
    ).toBe(false);
  });

  it("treats parse success and reconciliation mismatch as different questions", () => {
    const result = parseHouseholdOsReceipt(
      `HOUSEHOLDOS RECEIPT\nMerchant: Shop\nTotal: 55.41\nITEMS\nMilk | 51.50 | 1\nEND\n`,
    );
    expect(result.ok).toBe(true);
    const rec = reconcilePastedReceipt(result.receipt!);
    expect(rec.balanced).toBe(false);
    expect(rec.receiptTotalCents).toBe(5541);
    expect(rec.accountedForCents).toBe(5150);
    expect(rec.unaccountedCents).toBe(391);
  });

  it("assumes format v1 and rejects unknown formats", () => {
    const v1 = parseHouseholdOsReceipt(
      `HOUSEHOLDOS RECEIPT\nFormat: 1\nMerchant: Shop\nTotal: 1.00\nITEMS\nMilk | 1.00\nEND`,
    );
    expect(v1.ok).toBe(true);
    expect(v1.receipt?.formatVersion).toBe(1);
    const future = parseHouseholdOsReceipt(
      `HOUSEHOLDOS RECEIPT\nFormat: 99\nMerchant: Shop\nTotal: 1.00\nITEMS\nMilk | 1.00\nEND`,
    );
    expect(future.ok).toBe(false);
    expect(future.problems.some((p) => p.code === "unknown_format")).toBe(true);
  });
});
