import type { ExtractedReceipt } from "../types";

export type ReceiptExtractionInput = {
  mimeType: string;
  fileName: string;
  bytes: Uint8Array;
  householdId: string;
  receiptId: string;
};

export type ReceiptExtractionResult =
  | {
      ok: true;
      adapter: string;
      extraction: ExtractedReceipt;
    }
  | {
      ok: false;
      adapter: string;
      configured: boolean;
      error: string;
    };

export interface ReceiptExtractionAdapter {
  readonly name: string;
  readonly configured: boolean;
  extract(input: ReceiptExtractionInput): Promise<ReceiptExtractionResult>;
}
