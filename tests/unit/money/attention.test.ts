import { describe, expect, it } from "vitest";
import {
  formatPaymentConfirmAttention,
  formatDisputeAttention,
  sortAttentionItems,
} from "@/lib/money/attention";

describe("attention queue", () => {
  it("orders disputes before payment confirms", () => {
    const items = sortAttentionItems([
      formatPaymentConfirmAttention({
        paymentId: "p1",
        amountCents: 2410,
        senderLabel: "Michael",
        householdId: "hh",
      }),
      formatDisputeAttention({ disputeId: "d1", householdId: "hh" }),
    ]);
    expect(items[0]?.id).toContain("dispute");
    expect(items[1]?.title).toContain("Michael");
    expect(items[1]?.body).toContain("$24.10");
    expect(items[1]?.ctaLabel).toBe("Review payment");
  });
});
