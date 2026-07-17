import { describe, expect, it } from "vitest";
import { normalizeAliasKey, normalizeOcrLine, normalizeOcrText } from "@/lib/receipts/local-ocr/normalize";
import { selectMerchantCandidate } from "@/lib/receipts/local-ocr/merchant";
import { extractDateCandidates } from "@/lib/receipts/local-ocr/dates";
import {
  extractLabeledAmounts,
  selectTotalCandidates,
} from "@/lib/receipts/local-ocr/amounts";
import { parseCurrencyAmountToCents, formatCentsAsUsd } from "@/lib/receipts/currency";
import {
  inferQuantityFromLine,
  parseQuantityExpression,
} from "@/lib/receipts/local-ocr/quantity";
import { groupLineItems } from "@/lib/receipts/local-ocr/line-items";
import {
  aggregateOcrPages,
  parseReceiptFromOcr,
} from "@/lib/receipts/local-ocr/parse";
import {
  buildReconciliationSummary,
  computeAdjustmentToBalance,
} from "@/lib/receipts/local-ocr/reconcile";
import { maskPaymentInfo } from "@/lib/receipts/mask-payment";
import { projectOcrConfidence, confidenceLabel } from "@/lib/receipts/confidence";
import { toUserConfidenceState } from "@/lib/receipts/local-ocr/confidence-ui";
import {
  applyAliasCorrection,
  findAlias,
  shouldSuggestMerchantPattern,
} from "@/lib/receipts/local-ocr/aliases";
import { selectOcrRetention, redactOcrForPersistence } from "@/lib/receipts/local-ocr/retention";
import { LocalTesseractReceiptExtractionAdapter } from "@/lib/receipts/adapters/local-tesseract";
import type { OcrLine, ReceiptAlias } from "@/lib/receipts/local-ocr/types";

function line(
  text: string,
  pageNumber = 1,
  confidence = 0.9,
  bbox = { x0: 0, y0: 0, x1: 100, y1: 20 },
): OcrLine {
  return { text, confidence, bbox, words: [], pageNumber };
}

describe("OCR line normalization", () => {
  it("collapses whitespace and trims", () => {
    expect(normalizeOcrLine("  MILK   2%  ")).toBe("MILK 2%");
    expect(normalizeOcrText("A\n\n  B  \nC")).toBe("A\nB\nC");
  });
});

describe("merchant candidate selection", () => {
  it("prefers early prominent non-header lines", () => {
    const cand = selectMerchantCandidate([
      line("THANK YOU", 1, 0.9, { x0: 0, y0: 0, x1: 100, y1: 40 }),
      line("WAL-MART #1234", 1, 0.9, { x0: 0, y0: 40, x1: 200, y1: 90 }),
      line("TOTAL 12.00", 1, 0.9),
    ]);
    expect(cand?.value).toMatch(/WAL-MART/i);
  });

  it("applies household merchant aliases", () => {
    const aliases: ReceiptAlias[] = [
      {
        id: "1",
        kind: "merchant",
        sourceText: "WAL-MART #1234",
        normalizedSource: normalizeAliasKey("WAL-MART #1234"),
        targetText: "Walmart",
        merchantScope: null,
        useCount: 2,
      },
    ];
    const cand = selectMerchantCandidate([line("WAL-MART #1234")], aliases);
    expect(cand?.value).toBe("Walmart");
  });
});

describe("date extraction", () => {
  it("parses common US formats", () => {
    expect(extractDateCandidates("07/29/2026")[0]?.isoDate).toBe("2026-07-29");
    expect(extractDateCandidates("7/29/26")[0]?.isoDate).toBe("2026-07-29");
    expect(extractDateCandidates("2026-07-29")[0]?.isoDate).toBe("2026-07-29");
    expect(extractDateCandidates("Jul 29, 2026")[0]?.isoDate).toBe("2026-07-29");
  });

  it("marks ambiguous MDY dates", () => {
    const c = extractDateCandidates("01/02/2026")[0];
    expect(c?.ambiguous).toBe(true);
    expect(c?.isoDate).toBe("2026-01-02");
  });
});

describe("labeled amounts", () => {
  it("extracts subtotal tax tip discount and total", () => {
    const amounts = extractLabeledAmounts([
      "SUBTOTAL 10.00",
      "TAX 0.80",
      "TIP 1.00",
      "DISCOUNT -0.50",
      "TOTAL 11.30",
    ]);
    expect(pickCents(amounts, "subtotal")).toBe(1000);
    expect(pickCents(amounts, "tax")).toBe(80);
    expect(pickCents(amounts, "tip")).toBe(100);
    expect(pickCents(amounts, "discount")).toBe(-50);
    expect(pickCents(amounts, "total")).toBe(1130);
  });

  it("ranks total alternatives", () => {
    const amounts = extractLabeledAmounts([
      "SALE TOTAL 20.00",
      "GRAND TOTAL 21.50",
      "CHANGE 0.50",
    ]);
    const { selected, alternatives } = selectTotalCandidates(amounts);
    expect(selected?.cents).toBe(2150);
    expect(alternatives.some((a) => a.cents === 2000)).toBe(true);
  });
});

function pickCents(
  amounts: ReturnType<typeof extractLabeledAmounts>,
  kind: string,
) {
  return amounts.find((a) => a.kind === kind)?.cents ?? null;
}

describe("price and quantity parsing", () => {
  it("parses prices and negatives", () => {
    expect(parseCurrencyAmountToCents("$12.34")).toBe(1234);
    expect(parseCurrencyAmountToCents("(3.50)")).toBe(-350);
    expect(formatCentsAsUsd(1234)).toBe("$12.34");
  });

  it("parses weighted and qty expressions", () => {
    const w = parseQuantityExpression("1.25 lb @ 2.00 APPLES");
    expect(w.isWeighted).toBe(true);
    expect(w.quantity).toBe(1.25);
    expect(w.unitPriceCents).toBe(200);
    expect(inferQuantityFromLine("2 x SOAP", 400, 200)).toBe(2);
  });
});

describe("line-item grouping", () => {
  it("groups description and price with continuation", () => {
    const { items, unmatched } = groupLineItems([
      line("GV MLK 2% GL 3.49"),
      line("+ ORGANIC"),
      line("HCF TRASH 13G 8.99"),
      line("RANDOM HEADER"),
    ]);
    expect(items[0]?.totalPriceCents).toBe(349);
    expect(items[0]?.name.toUpperCase()).toContain("MLK");
    expect(items.some((i) => i.name.toUpperCase().includes("ORGANIC") || i.ocrText.includes("ORGANIC") || items[0]?.name.includes("ORGANIC"))).toBe(true);
    expect(unmatched.length).toBeGreaterThanOrEqual(1);
  });

  it("preserves unmatched text", () => {
    const { unmatched } = groupLineItems([
      line("THANK YOU FOR SHOPPING"),
      line("AUTH CODE 123"),
    ]);
    expect(unmatched.map((u) => u.text).join(" ")).toMatch(/THANK YOU|AUTH/i);
  });
});

describe("integer-cent reconciliation", () => {
  it("balances and computes adjustments", () => {
    const summary = buildReconciliationSummary({
      lineItems: [
        { totalPriceCents: 1000, quantity: 1, unitPriceCents: 1000 },
        { totalPriceCents: 250, quantity: 1, unitPriceCents: 250 },
      ],
      subtotalCents: 1250,
      taxCents: 100,
      tipCents: 0,
      discountCents: 0,
      totalCents: 1350,
    });
    expect(summary.balanced).toBe(true);
    expect(summary.differenceCents).toBe(0);
    expect(
      computeAdjustmentToBalance({
        reviewedItemsCents: 1250,
        taxCents: 100,
        tipCents: 0,
        discountCents: 0,
        totalCents: 1400,
      }),
    ).toBe(50);
  });
});

describe("payment masking and confidence", () => {
  it("masks sensitive payment digits", () => {
    expect(maskPaymentInfo("Visa 4111111111111111")).toMatch(/•••• 1111/);
  });

  it("projects confidence to user states", () => {
    expect(projectOcrConfidence(90)).toBe(0.9);
    expect(confidenceLabel(0.9)).toBe("Looks clear");
    expect(toUserConfidenceState(0.4)).toBe("could_not_determine");
  });
});

describe("aliases", () => {
  const aliases: ReceiptAlias[] = [
    {
      id: "a",
      kind: "item",
      sourceText: "GV MLK 2% GL",
      normalizedSource: normalizeAliasKey("GV MLK 2% GL"),
      targetText: "Great Value 2% Milk",
      merchantScope: "Walmart",
      useCount: 3,
    },
  ];

  it("applies item aliases", () => {
    expect(applyAliasCorrection(aliases, "item", "GV MLK 2% GL", "Walmart")).toBe(
      "Great Value 2% Milk",
    );
    expect(findAlias(aliases, "item", "GV MLK 2% GL")?.targetText).toBe(
      "Great Value 2% Milk",
    );
    expect(shouldSuggestMerchantPattern(3)).toBe(true);
  });
});

describe("parser + pdf page aggregation + retention + idempotency", () => {
  it("parses a fixture document", () => {
    const doc = aggregateOcrPages([
      {
        pageNumber: 1,
        fullText: "WALMART\n07/29/2026\nMILK 3.49\nBREAD 2.00\nSUBTOTAL 5.49\nTAX 0.41\nTOTAL 5.90\nVisa 4111111111111111",
        blocks: [],
        lines: [
          line("WALMART"),
          line("07/29/2026"),
          line("MILK 3.49"),
          line("BREAD 2.00"),
          line("SUBTOTAL 5.49"),
          line("TAX 0.41"),
          line("TOTAL 5.90"),
          line("Visa 4111111111111111"),
        ],
        words: [],
        confidence: 0.88,
        width: 400,
        height: 800,
      },
    ]);
    expect(doc.fullText).toContain("Page 1");
    const parsed = parseReceiptFromOcr(doc);
    expect(parsed.merchant.value).toMatch(/WALMART/i);
    expect(parsed.purchaseDate.value).toBe("2026-07-29");
    expect(parsed.totalCents.value).toBe(590);
    expect(parsed.taxCents.value).toBe(41);
    expect(parsed.lineItems.length).toBeGreaterThanOrEqual(2);
    expect(parsed.paymentMethodSummary.value).toMatch(/••••/);
  });

  it("selects OCR retention policy", () => {
    const sel = selectOcrRetention();
    expect(sel.keepFullText).toBe(true);
    expect(sel.keepRawEnginePayload).toBe(false);
    expect(redactOcrForPersistence("secret", { ...sel, keepFullText: false }).fullText).toBeNull();
  });

  it("local adapter requires no secrets and is idempotent marker", async () => {
    const adapter = new LocalTesseractReceiptExtractionAdapter();
    expect(adapter.configured).toBe(true);
    expect(adapter.name).toBe("local_tesseract");
    const a = await adapter.extract({
      mimeType: "image/jpeg",
      fileName: "r.jpg",
      bytes: new Uint8Array([1, 2, 3]),
      householdId: "h",
      receiptId: "r",
    });
    const b = await adapter.extract({
      mimeType: "image/jpeg",
      fileName: "r.jpg",
      bytes: new Uint8Array([1, 2, 3]),
      householdId: "h",
      receiptId: "r",
    });
    expect(a.ok).toBe(false);
    expect(b.ok).toBe(false);
    if (!a.ok && !b.ok) {
      expect(a.error).toBe(b.error);
    }
  });
});
