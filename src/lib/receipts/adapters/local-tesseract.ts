import type {
  ReceiptExtractionAdapter,
  ReceiptExtractionInput,
  ReceiptExtractionResult,
} from "./types";

/**
 * Marker adapter: OCR runs in the browser via Tesseract.js.
 * Server workers must not call cloud providers for this mode.
 * Requires no secrets or server environment variables.
 */
export class LocalTesseractReceiptExtractionAdapter
  implements ReceiptExtractionAdapter
{
  readonly name = "local_tesseract";
  readonly configured = true;

  async extract(
    _input: ReceiptExtractionInput,
  ): Promise<ReceiptExtractionResult> {
    void _input;
    return {
      ok: false,
      adapter: this.name,
      configured: true,
      error:
        "Local OCR runs on the device. Submit client extraction or enter details manually.",
    };
  }
}
