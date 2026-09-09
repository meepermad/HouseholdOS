import { describe, expect, it } from "vitest";
import { receiptReviewFormKey } from "@/lib/receipts/review-identity";

describe("receiptReviewFormKey", () => {
  it("stays stable across claim and classification changes", () => {
    expect(receiptReviewFormKey("receipt-1")).toBe("receipt-1");
    expect(receiptReviewFormKey("receipt-1")).toBe(receiptReviewFormKey("receipt-1"));
    expect(receiptReviewFormKey("receipt-1")).not.toContain("personal_purchaser");
    expect(receiptReviewFormKey("receipt-1")).not.toContain("mine");
  });
});
