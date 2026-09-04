import { describe, expect, it } from "vitest";
import { PASTE_MAX_ABS_CENTS, parsePastedCents } from "@/lib/receipts/paste/cents";
import { RECEIPT_FORMAT_EXAMPLE, RECEIPT_FORMAT_HEADER } from "@/lib/receipts/paste/format";
import { parseHouseholdOsReceipt } from "@/lib/receipts/paste/parse";
import { pasteStatusCopy, reconcilePastedReceipt } from "@/lib/receipts/paste/reconcile";
import { PASTE_MAX_CHARS, sanitizePastedReceipt } from "@/lib/receipts/paste/sanitize";

const MEMBERS = [
  { id: "m-atem", label: "Atem" },
  { id: "m-sam", label: "Sam" },
];

const CANONICAL = `HOUSEHOLDOS RECEIPT

Merchant: Walmart
Date: 2026-09-04
Paid By: Atem
Total: 84.72
Subtotal: 79.41
Tax: 5.31
Tip: 0.00
Fees: 0.00
Discount: 0.00

ITEMS
Chicken thighs | 13.48 | 1
Rice | 8.97 | 1
Paper towels | 12.94 | 1
Shampoo | 7.48 | 1

END
`;

describe("parsePastedCents", () => {
  it("parses dollar signs, whole dollars, and one decimal", () => {
    expect(parsePastedCents("84.72")).toEqual({ ok: true, cents: 8472 });
    expect(parsePastedCents("$84.72")).toEqual({ ok: true, cents: 8472 });
    expect(parsePastedCents("84")).toEqual({ ok: true, cents: 8400 });
    expect(parsePastedCents("84.7")).toEqual({ ok: true, cents: 8470 });
  });

  it("rejects malformed, negative, and overflowing amounts", () => {
    expect(parsePastedCents("not-a-number").ok).toBe(false);
    expect(parsePastedCents("-1.00").ok).toBe(false);
    expect(parsePastedCents("84.729").ok).toBe(false);
    expect(parsePastedCents(String(PASTE_MAX_ABS_CENTS)).ok).toBe(false);
    expect(parsePastedCents("1000000").ok).toBe(false);
  });
});

describe("parseHouseholdOsReceipt", () => {
  it("1. parses a full canonical receipt", () => {
    const result = parseHouseholdOsReceipt(CANONICAL, MEMBERS);
    expect(result.ok).toBe(true);
    expect(result.receipt?.merchant).toBe("Walmart");
    expect(result.receipt?.purchaseDate).toBe("2026-09-04");
    expect(result.receipt?.totalCents).toBe(8472);
    expect(result.receipt?.taxCents).toBe(531);
    expect(result.receipt?.payerMembershipId).toBe("m-atem");
    expect(result.receipt?.items).toHaveLength(4);
    expect(result.receipt?.items[0]).toMatchObject({
      description: "Chicken thighs",
      totalCents: 1348,
      quantity: 1,
    });
  });

  it("2. tolerates missing optional fields", () => {
    const result = parseHouseholdOsReceipt(
      `HOUSEHOLDOS RECEIPT
Merchant: Target
Total: 10.00
ITEMS
Milk | 10.00
END`,
    );
    expect(result.ok).toBe(true);
    expect(result.receipt?.taxCents).toBeNull();
    expect(result.receipt?.paidByRaw).toBeNull();
    expect(result.receipt?.items[0].quantity).toBe(1);
  });

  it("3-4. accepts amounts with and without dollar signs", () => {
    const withSign = parseHouseholdOsReceipt(
      `HOUSEHOLDOS RECEIPT
Merchant: Target
Total: $4.23
Tax: $4.23
ITEMS
Milk | $4.23
END`,
    );
    const without = parseHouseholdOsReceipt(
      `HOUSEHOLDOS RECEIPT
Merchant: Target
Total: 4.23
Tax: 4.23
ITEMS
Milk | 4.23
END`,
    );
    expect(withSign.receipt?.totalCents).toBe(423);
    expect(without.receipt?.taxCents).toBe(423);
    expect(withSign.receipt?.items[0].totalCents).toBe(423);
  });

  it("5-6. defaults omitted quantity and keeps quantity > 1", () => {
    const result = parseHouseholdOsReceipt(
      `HOUSEHOLDOS RECEIPT
Merchant: Shop
Total: 17.96
ITEMS
Coke Zero | 8.98
Coke Zero | 8.98 | 2
END`,
    );
    expect(result.receipt?.items[0].quantity).toBe(1);
    expect(result.receipt?.items[1].quantity).toBe(2);
  });

  it("7-9. ignores blank lines, extra spaces, and field casing", () => {
    const result = parseHouseholdOsReceipt(
      `householdos receipt

merchant - Target

total:   $42.17

items:
Milk |  4.29  |  1

end
`,
    );
    expect(result.ok).toBe(true);
    expect(result.receipt?.merchant).toBe("Target");
    expect(result.receipt?.totalCents).toBe(4217);
    expect(result.receipt?.items[0].description).toBe("Milk");
  });

  it("10-11. keeps ownership hints as suggestions and unknown members unmatched", () => {
    const result = parseHouseholdOsReceipt(
      `HOUSEHOLDOS RECEIPT
Merchant: Shop
Paid By: Nobody
Total: 29.40
ITEMS
Coke Zero | 8.98 | 2 | shared
Shampoo | 7.48 | 1 | Atem
Paper towels | 12.94 | 1 | household
Gum | 1.00 | 1 | Mystery Person
END`,
      MEMBERS,
    );
    expect(result.ok).toBe(true);
    expect(result.receipt?.payerMembershipId).toBeNull();
    expect(result.problems.some((p) => p.code === "paid_by_unmatched")).toBe(true);
    expect(result.receipt?.items[0].ownershipKind).toBe("shared");
    expect(result.receipt?.items[1].suggestedMembershipId).toBe("m-atem");
    expect(result.receipt?.items[2].ownershipKind).toBe("household");
    expect(result.receipt?.items[3].needsReview).toBe(true);
    expect(result.receipt?.items[3].suggestedMembershipId).toBeNull();
  });

  it("12. accepts a total-only receipt with an empty ITEMS section", () => {
    const result = parseHouseholdOsReceipt(
      `HOUSEHOLDOS RECEIPT
Merchant: Target
Total: 42.17
ITEMS
END`,
    );
    expect(result.ok).toBe(true);
    expect(result.receipt?.items).toHaveLength(0);
    expect(result.receipt?.totalCents).toBe(4217);
  });

  it("13-16. parses tax, tip, fees, and discount", () => {
    const result = parseHouseholdOsReceipt(
      `HOUSEHOLDOS RECEIPT
Merchant: Cafe
Total: 24.00
Tax: 2.00
Tip: 3.00
Fees: 1.00
Discount: 2.00
ITEMS
Latte | 20.00
END`,
    );
    expect(result.receipt?.taxCents).toBe(200);
    expect(result.receipt?.tipCents).toBe(300);
    expect(result.receipt?.feeCents).toBe(100);
    expect(result.receipt?.discountCents).toBe(200);
  });

  it("17. reports a reconciliation mismatch without changing items", () => {
    const result = parseHouseholdOsReceipt(
      `HOUSEHOLDOS RECEIPT
Merchant: Target
Total: 42.17
ITEMS
Milk | 4.29 | 1
Paper towels | 12.99 | 1
END`,
    );
    expect(result.ok).toBe(true);
    const rec = reconcilePastedReceipt(result.receipt!);
    expect(rec.itemsCents).toBe(1728);
    expect(rec.unaccountedCents).toBe(2489);
    expect(rec.balanced).toBe(false);
    expect(pasteStatusCopy(result.receipt!, result.problems, rec)).toBe(
      "Total does not match items",
    );
    expect(result.receipt?.items.map((i) => i.totalCents)).toEqual([429, 1299]);
  });

  it("18-20. rejects malformed, negative, and very large amounts", () => {
    expect(parseHouseholdOsReceipt(`${RECEIPT_FORMAT_HEADER}\nMerchant: A\nTotal: abc\nITEMS\nX | 1\nEND`).ok).toBe(
      false,
    );
    expect(
      parseHouseholdOsReceipt(`${RECEIPT_FORMAT_HEADER}\nMerchant: A\nTotal: 1.00\nITEMS\nX | -2.00\nEND`).ok,
    ).toBe(false);
    expect(
      parseHouseholdOsReceipt(`${RECEIPT_FORMAT_HEADER}\nMerchant: A\nTotal: 1000000\nITEMS\nX | 1.00\nEND`).ok,
    ).toBe(false);
  });

  it("21. does not treat HTML or script as executable and refuses to guess", () => {
    const result = parseHouseholdOsReceipt(
      `<script>alert(1)</script>\n<img src=x onerror=alert(1)>`,
    );
    expect(result.ok).toBe(false);
    expect(result.receipt).toBeNull();
  });

  it("22. extracts a canonical block from surrounding prose", () => {
    const result = parseHouseholdOsReceipt(
      `Here you go:\n\n${CANONICAL}\n\nLet me know if you need anything else.`,
      MEMBERS,
    );
    expect(result.ok).toBe(true);
    expect(result.receipt?.merchant).toBe("Walmart");
    expect(result.receipt?.extractedBlock.startsWith("HOUSEHOLDOS RECEIPT")).toBe(true);
  });

  it("23. refuses multiple receipt blocks", () => {
    const result = parseHouseholdOsReceipt(`${CANONICAL}\n\n${CANONICAL}`);
    expect(result.ok).toBe(false);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.error.code).toBe("multiple_receipts");
  });

  it("24. missing END is a problem but the block can still be read", () => {
    const result = parseHouseholdOsReceipt(
      `HOUSEHOLDOS RECEIPT
Merchant: Target
Total: 10.00
ITEMS
Milk | 10.00`,
    );
    expect(result.problems.some((p) => p.code === "missing_end")).toBe(true);
    expect(result.receipt?.merchant).toBe("Target");
  });

  it("25. missing ITEMS is not silently invented", () => {
    const result = parseHouseholdOsReceipt(
      `HOUSEHOLDOS RECEIPT
Merchant: Target
Total: 10.00
END`,
    );
    expect(result.ok).toBe(false);
    expect(result.problems.some((p) => p.code === "missing_items")).toBe(true);
    expect(result.receipt?.items).toEqual([]);
  });

  it("26. duplicate header fields are flagged and the first value is kept", () => {
    const result = parseHouseholdOsReceipt(
      `HOUSEHOLDOS RECEIPT
Merchant: Target
Merchant: Other
Total: 10.00
Total: 99.00
ITEMS
Milk | 10.00
END`,
    );
    expect(result.problems.some((p) => p.code === "duplicate_field")).toBe(true);
    expect(result.receipt?.merchant).toBe("Target");
    expect(result.receipt?.totalCents).toBe(1000);
  });

  it("27. accepts CRLF and LF line endings", () => {
    const crlf = CANONICAL.replace(/\n/g, "\r\n");
    expect(parseHouseholdOsReceipt(crlf, MEMBERS).ok).toBe(true);
  });

  it("28. keeps unicode merchant and item names", () => {
    const result = parseHouseholdOsReceipt(
      `HOUSEHOLDOS RECEIPT
Merchant: Café München
Total: 3.50
ITEMS
Crème brûlée | 3.50 | 1
END`,
    );
    expect(result.receipt?.merchant).toBe("Café München");
    expect(result.receipt?.items[0].description).toBe("Crème brûlée");
  });

  it("29. rejects empty input", () => {
    const result = parseHouseholdOsReceipt("   ");
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.error.code).toBe("empty");
  });

  it("30. rejects oversized input", () => {
    const result = parseHouseholdOsReceipt("x".repeat(PASTE_MAX_CHARS + 1));
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.error.code).toBe("too_large");
    expect(sanitizePastedReceipt("x".repeat(PASTE_MAX_CHARS + 1)).ok).toBe(false);
  });

  it("offers a quick-format candidate without guessing low-confidence prose", () => {
    const quick = parseHouseholdOsReceipt(
      `Target
84.72
Chicken thighs | 13.48
Rice | 8.97
Paper towels | 12.94`,
    );
    expect(quick.ok).toBe(false);
    if (quick.ok) throw new Error("expected failure");
    expect(quick.error.message).toBe("We think this is a receipt.");
    expect(quick.quickCandidate?.merchant).toBe("Target");
    expect(quick.quickCandidate?.items).toHaveLength(3);

    const prose = parseHouseholdOsReceipt("I bought some stuff at the store today for about twenty dollars.");
    expect(prose.ok).toBe(false);
    expect(prose.quickCandidate).toBeUndefined();
  });

  it("does not invent totals when the example template is incomplete", () => {
    const result = parseHouseholdOsReceipt(RECEIPT_FORMAT_EXAMPLE);
    expect(result.ok).toBe(true);
    expect(result.receipt?.totalCents).toBe(4217);
  });
});
