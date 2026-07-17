import type {
  ReceiptExtractionAdapter,
  ReceiptExtractionInput,
  ReceiptExtractionResult,
} from "./types";

/** Manual-only fallback when no OCR provider credentials are configured. */
export class DisabledReceiptExtractionAdapter implements ReceiptExtractionAdapter {
  readonly name = "disabled";
  readonly configured = false;

  async extract(_input: ReceiptExtractionInput): Promise<ReceiptExtractionResult> {
    void _input;
    return {
      ok: false,
      adapter: this.name,
      configured: false,
      error: "Automatic extraction is not configured. Review and enter details manually.",
    };
  }
}
