import { describe, expect, it } from "vitest";
import { parseHouseholdOsReceipt } from "@/lib/receipts/paste/parse";
import { pastedReceiptToExtraction } from "@/lib/receipts/paste/to-extraction";
import { applyPasteEdits } from "@/lib/receipts/paste/overrides";
import { PASTE_FIXTURE_WALMART } from "@/lib/receipts/paste/fixtures";
import { isPasteParserDebugEnabled } from "@/lib/receipts/paste/debug";

describe("client/server paste parser parity", () => {
  it("uses the same parseHouseholdOsReceipt module for client preview and server persist", () => {
    const client = parseHouseholdOsReceipt(PASTE_FIXTURE_WALMART);
    const server = parseHouseholdOsReceipt(PASTE_FIXTURE_WALMART);
    expect(client).toEqual(server);
    expect(client.ok).toBe(true);
    const extraction = pastedReceiptToExtraction(server.receipt!);
    expect(extraction.proposed.merchant).toBe("Walmart");
    expect(extraction.proposed.totalCents).toBe(5541);
    expect(extraction.lineItems).toHaveLength(6);
    expect(extraction.processingMeta.source).toBe("paste");
    expect(extraction.processingMeta.quantitySemantics).toBe("line_total");
    expect(extraction.lineItems.every((line) => line.totalPriceCents === line.lineTotalCents)).toBe(
      true,
    );
  });

  it("keeps server edits on integer cents", () => {
    const parsed = parseHouseholdOsReceipt(PASTE_FIXTURE_WALMART);
    const applied = applyPasteEdits(parsed.receipt!, {
      payerMembershipId: "m1",
      items: parsed.receipt!.items.map((item) => ({
        description: item.description,
        totalCents: item.totalCents,
        quantity: item.quantity,
      })),
    });
    expect("error" in applied).toBe(false);
    if ("error" in applied) return;
    expect(applied.items).toHaveLength(6);
    expect(applied.payerMembershipId).toBe("m1");
  });

  it("hides the parser debugger in production", () => {
    expect(isPasteParserDebugEnabled({ NODE_ENV: "production", APP_ENV: "production" })).toBe(false);
    expect(isPasteParserDebugEnabled({ NODE_ENV: "development", APP_ENV: "development" })).toBe(true);
  });
});
