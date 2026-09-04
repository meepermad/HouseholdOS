import { describe, expect, it } from "vitest";
import { detectHeic, sniffHeicBrand } from "@/lib/receipts/heic";
import { mapReceiptUploadFailure } from "@/lib/receipts/upload-errors";
import { validateReceiptUpload } from "@/lib/receipts/validate";

function u8(...bytes: number[]) {
  return new Uint8Array(bytes);
}

describe("receipt upload formats", () => {
  it("accepts JPEG", () => {
    const bytes = u8(0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10);
    expect(
      validateReceiptUpload({
        mimeType: "image/jpeg",
        fileName: "r.jpg",
        sizeBytes: bytes.length,
        bytes,
      }).ok,
    ).toBe(true);
  });

  it("accepts PNG", () => {
    const padded = new Uint8Array(32);
    padded.set(u8(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a));
    expect(
      validateReceiptUpload({
        mimeType: "image/png",
        fileName: "r.png",
        sizeBytes: padded.length,
        bytes: padded,
      }).ok,
    ).toBe(true);
  });

  it("accepts WebP", () => {
    const bytes = new Uint8Array(16);
    bytes.set(u8(0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50));
    expect(
      validateReceiptUpload({
        mimeType: "image/webp",
        fileName: "r.webp",
        sizeBytes: bytes.length,
        bytes,
      }).ok,
    ).toBe(true);
  });

  it("accepts PDF", () => {
    const bytes = u8(0x25, 0x50, 0x44, 0x46, 0x2d);
    expect(
      validateReceiptUpload({
        mimeType: "application/pdf",
        fileName: "r.pdf",
        sizeBytes: bytes.length,
        bytes,
      }).ok,
    ).toBe(true);
  });

  it("accepts a JPEG with empty MIME (mobile picker)", () => {
    const bytes = u8(0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10);
    expect(
      validateReceiptUpload({
        mimeType: "",
        fileName: "image",
        sizeBytes: bytes.length,
        bytes,
      }).ok,
    ).toBe(true);
  });

  it("rejects HEIC with an explicit message", () => {
    const bytes = new Uint8Array(16);
    bytes.set(u8(0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63));
    const result = validateReceiptUpload({
      mimeType: "image/heic",
      fileName: "IMG_1234.HEIC",
      sizeBytes: bytes.length,
      bytes,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/HEIC|iPhone/i);
    }
    expect(detectHeic({ bytes, mimeType: "image/heic", fileName: "x.heic" })).toBe(true);
    expect(sniffHeicBrand(bytes)).toBe(true);
  });

  it("maps storage and OCR failures to safe copy", () => {
    expect(mapReceiptUploadFailure({ stage: "storage_upload", raw: "new row violates" }).code).toBe(
      "could_not_upload",
    );
    expect(mapReceiptUploadFailure({ stage: "ocr_processing" }).code).toBe("ocr_failed");
    expect(mapReceiptUploadFailure({ offline: true }).code).toBe("connection_lost");
    expect(mapReceiptUploadFailure({ raw: "jwt expired" }).code).toBe("session_expired");
    expect(mapReceiptUploadFailure({ raw: "jwt expired" }).message).toMatch(
      /sign in again/i,
    );
    expect(mapReceiptUploadFailure({ raw: "jwt expired" }).message).toMatch(
      /add this receipt/i,
    );
    expect(mapReceiptUploadFailure({ raw: "boom" }).message).not.toMatch(/violates|rpc|sql/i);
  });

  it("rejects a huge declared size", () => {
    const result = validateReceiptUpload({
      mimeType: "image/jpeg",
      fileName: "huge.jpg",
      sizeBytes: 40 * 1024 * 1024,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/large|size/i);
  });

  it("maps worker timeout codes to a saved-receipt message, not the raw code", () => {
    const mapped = mapReceiptUploadFailure({ raw: "OCR_WORKER_TIMEOUT" });
    expect(mapped.code).toBe("ocr_failed");
    expect(mapped.message).toMatch(/manually/i);
    expect(mapped.message).not.toMatch(/OCR_WORKER_TIMEOUT/i);
  });

  it("maps OCR failure after upload as a saved receipt, not an upload failure", () => {
    const mapped = mapReceiptUploadFailure({ stage: "ocr_processing" });
    expect(mapped.code).toBe("ocr_failed");
    expect(mapped.message).toMatch(/saved/i);
    expect(mapped.message).not.toMatch(/upload failed/i);
  });

  it("maps registration failure without SQL text", () => {
    const mapped = mapReceiptUploadFailure({
      stage: "registration",
      raw: "duplicate key value violates unique constraint expense_receipts_pkey",
    });
    expect(mapped.message).not.toMatch(/duplicate key|constraint|pkey/i);
  });
});
