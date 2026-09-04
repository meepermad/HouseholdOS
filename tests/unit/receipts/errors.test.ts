import { describe, expect, it } from "vitest";
import {
  describeReceiptReadFailure,
  mapReceiptRpcError,
  SHARE_NEEDS_PERSON,
} from "@/lib/receipts/errors";
import { mapReceiptUploadFailure } from "@/lib/receipts/upload-errors";

describe("receipt error copy", () => {
  it("maps empty or invalid member lists to a share instruction", () => {
    expect(mapReceiptRpcError("No valid household members selected")).toBe(
      SHARE_NEEDS_PERSON,
    );
    expect(
      mapReceiptRpcError("invalid input syntax for type uuid: \"\""),
    ).toBe(SHARE_NEEDS_PERSON);
    expect(mapReceiptRpcError("invalid input value")).toMatch(
      /who shares this receipt/i,
    );
    expect(mapReceiptRpcError("invalid input value")).not.toBe("Invalid input");
  });

  it("never shows OCR_WORKER_TIMEOUT as the only message", () => {
    const copy = describeReceiptReadFailure({
      ocrOutcome: "timeout",
      lastError: "OCR_WORKER_TIMEOUT",
    });
    expect(copy.explanation).not.toMatch(/OCR_WORKER_TIMEOUT/i);
    expect(copy.nextStep).toMatch(/enter the merchant|clearer photo/i);
    expect(copy.actions.map((a) => a.kind)).toEqual([
      "enter_manually",
      "try_again",
    ]);
    expect(mapReceiptRpcError("OCR_WORKER_TIMEOUT")).not.toMatch(
      /OCR_WORKER_TIMEOUT/i,
    );
    expect(mapReceiptUploadFailure({ raw: "OCR_WORKER_TIMEOUT" }).message).not.toMatch(
      /OCR_WORKER_TIMEOUT/i,
    );
  });

  it("explains a failed read and what to do next", () => {
    const copy = describeReceiptReadFailure({
      ocrOutcome: "failed",
      lastError: "tesseract could not read the image",
    });
    expect(copy.title).toMatch(/could not read/i);
    expect(copy.explanation.length).toBeGreaterThan(10);
    expect(copy.nextStep).toMatch(/enter/i);
  });
});
