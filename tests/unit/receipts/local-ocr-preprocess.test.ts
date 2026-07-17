/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from "vitest";
import { suggestReceiptBounds } from "@/lib/receipts/preprocess/pipeline";
import { RECEIPT_PDF_MAX_BYTES } from "@/lib/receipts/client/pdf-render";
import { RECEIPT_MAX_PDF_PAGES } from "@/lib/receipts/types";

describe("image preprocessing helpers", () => {
  it("suggests padded receipt bounds", () => {
    const bounds = suggestReceiptBounds(1000, 2000);
    expect(bounds.x).toBeGreaterThan(0);
    expect(bounds.y).toBeGreaterThan(0);
    expect(bounds.width).toBeLessThan(1000);
    expect(bounds.height).toBeLessThan(2000);
  });
});

describe("PDF limits", () => {
  it("enforces strict size and page ceilings", () => {
    expect(RECEIPT_PDF_MAX_BYTES).toBeLessThanOrEqual(10 * 1024 * 1024);
    expect(RECEIPT_MAX_PDF_PAGES).toBeLessThanOrEqual(10);
  });
});

describe("memory and cancellation markers", () => {
  it("exports cancel/terminate entry points", async () => {
    const mod = await import("@/lib/receipts/client/tesseract-session");
    expect(typeof mod.cancelLocalOcr).toBe("function");
    expect(typeof mod.terminateLocalOcrWorker).toBe("function");
    mod.cancelLocalOcr();
  });
});

describe("offline draft discard", () => {
  it("defines offline draft store helpers", async () => {
    vi.stubGlobal("indexedDB", undefined);
    const mod = await import("@/lib/receipts/client/offline-draft");
    expect(typeof mod.discardOfflineReceiptDraft).toBe("function");
    expect(typeof mod.saveOfflineReceiptDraft).toBe("function");
  });
});
