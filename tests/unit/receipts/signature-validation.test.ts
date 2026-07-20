import { describe, expect, it } from "vitest";
import { validateReceiptUpload, sniffMime } from "@/lib/receipts/validate";

function u8(...bytes: number[]) {
  return new Uint8Array(bytes);
}

describe("receipt signature validation", () => {
  it("accepts JPEG magic bytes matching declared MIME", () => {
    const bytes = u8(0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10);
    expect(sniffMime(bytes)).toBe("image/jpeg");
    const result = validateReceiptUpload({
      mimeType: "image/jpeg",
      fileName: "r.jpg",
      sizeBytes: bytes.length,
      bytes,
    });
    expect(result.ok).toBe(true);
  });

  it("rejects MIME mismatch vs magic bytes", () => {
    const bytes = u8(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
    // minimal IHDR-ish padding
    const padded = new Uint8Array(32);
    padded.set(bytes);
    const result = validateReceiptUpload({
      mimeType: "image/jpeg",
      fileName: "r.jpg",
      sizeBytes: padded.length,
      bytes: padded,
    });
    expect(result.ok).toBe(false);
  });

  it("rejects invalid magic bytes", () => {
    const bytes = u8(0x00, 0x01, 0x02, 0x03, 0x04, 0x05);
    const result = validateReceiptUpload({
      mimeType: "image/png",
      fileName: "r.png",
      sizeBytes: bytes.length,
      bytes,
    });
    expect(result.ok).toBe(false);
  });

  it("rejects PDF without %PDF signature when bytes provided", () => {
    const bytes = u8(0x25, 0x21, 0x50, 0x53); // %!PS
    const result = validateReceiptUpload({
      mimeType: "application/pdf",
      fileName: "r.pdf",
      sizeBytes: bytes.length,
      bytes,
    });
    expect(result.ok).toBe(false);
  });
});
