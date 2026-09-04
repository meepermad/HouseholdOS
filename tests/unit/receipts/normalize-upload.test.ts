import { afterEach, describe, expect, it, vi } from "vitest";
import { normalizeReceiptUpload } from "@/lib/receipts/client/normalize-upload";
import {
  RECEIPT_CAMERA_ACCEPT,
  RECEIPT_HEIC_DECODE_MAX_BYTES,
  RECEIPT_LIBRARY_ACCEPT,
} from "@/lib/receipts/types";

function heicBytes(size = 16): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(size);
  bytes.set([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63]);
  return bytes;
}

describe("normalizeReceiptUpload", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("passes PDFs through without decoding", async () => {
    const file = new File([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d])], "r.pdf", {
      type: "application/pdf",
    });
    const result = await normalizeReceiptUpload(file);
    expect(result.convertedFromHeic).toBe(false);
    expect(result.file).toBe(file);
  });

  it("maps a HEIC the browser cannot decode to a human message", async () => {
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async () => {
        throw new Error("EncodingError");
      }),
    );
    const file = new File([heicBytes()], "IMG_1234.HEIC", { type: "image/heic" });
    await expect(normalizeReceiptUpload(file)).rejects.toThrow(/HEIC|iPhone/i);
  });

  it("refuses oversized HEIC before attempting a decode", async () => {
    const decode = vi.fn();
    vi.stubGlobal("createImageBitmap", decode);
    const oversized = heicBytes(RECEIPT_HEIC_DECODE_MAX_BYTES + 1);
    const file = new File([oversized], "huge.heic", { type: "image/heic" });
    await expect(normalizeReceiptUpload(file)).rejects.toThrow(/HEIC|iPhone/i);
    expect(decode).not.toHaveBeenCalled();
  });
});

describe("receipt file accept lists", () => {
  it("omits HEIC so iOS Photos converts to JPEG", () => {
    expect(RECEIPT_LIBRARY_ACCEPT).not.toMatch(/heic|heif/i);
    expect(RECEIPT_CAMERA_ACCEPT).not.toMatch(/heic|heif/i);
    expect(RECEIPT_LIBRARY_ACCEPT).toMatch(/image\/jpeg/);
    expect(RECEIPT_LIBRARY_ACCEPT).toMatch(/application\/pdf/);
  });
});
