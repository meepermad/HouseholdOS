import "server-only";

import { DisabledReceiptExtractionAdapter } from "./disabled";
import { FixtureReceiptExtractionAdapter } from "./fixture";
import { LocalTesseractReceiptExtractionAdapter } from "./local-tesseract";
import { OpenAiReceiptExtractionAdapter } from "./openai";
import { describeProviderChoices as providerChoices } from "./provider-copy";
import type { ReceiptExtractionAdapter } from "./types";

export type ReceiptOcrProvider =
  | "local_tesseract"
  | "openai"
  | "fixture"
  | "disabled";

/**
 * Resolve OCR adapter from env.
 * RECEIPT_OCR_PROVIDER=local_tesseract|openai|fixture|disabled
 *
 * Default: local_tesseract (free, private, on-device).
 * Cloud extraction is never selected merely because OPENAI_API_KEY exists.
 */
export function resolveReceiptExtractionAdapter(
  env: NodeJS.ProcessEnv = process.env,
): ReceiptExtractionAdapter {
  const forced = (env.RECEIPT_OCR_PROVIDER ?? "").toLowerCase().trim();

  if (forced === "fixture") return new FixtureReceiptExtractionAdapter();
  if (forced === "disabled") return new DisabledReceiptExtractionAdapter();
  if (forced === "openai") {
    const adapter = new OpenAiReceiptExtractionAdapter(env.OPENAI_API_KEY);
    if (adapter.configured) return adapter;
    return new DisabledReceiptExtractionAdapter();
  }
  if (forced === "local_tesseract" || !forced) {
    return new LocalTesseractReceiptExtractionAdapter();
  }
  return new LocalTesseractReceiptExtractionAdapter();
}

export function describeReceiptOcrStatus(
  env: NodeJS.ProcessEnv = process.env,
): {
  configured: boolean;
  provider: string;
  message: string;
  privacyLabel: string;
  cloudAvailable: boolean;
} {
  const adapter = resolveReceiptExtractionAdapter(env);
  const cloudAvailable =
    Boolean(env.OPENAI_API_KEY) &&
    (env.RECEIPT_OCR_PROVIDER ?? "").toLowerCase().trim() === "openai";

  if (adapter.name === "local_tesseract") {
    return {
      configured: true,
      provider: adapter.name,
      message:
        "Processed privately on this device. Review and confirm every field before creating an expense.",
      privacyLabel: "Processed privately on this device",
      cloudAvailable: false,
    };
  }

  if (adapter.name === "openai" && adapter.configured) {
    return {
      configured: true,
      provider: adapter.name,
      message:
        "Optional cloud extraction is configured. Receipts are sent to that provider only when you choose cloud extraction.",
      privacyLabel: "Cloud extraction configured (explicit use only)",
      cloudAvailable: true,
    };
  }

  if (!adapter.configured) {
    return {
      configured: false,
      provider: adapter.name,
      message:
        "Automatic extraction is not configured. Enter the receipt manually.",
      privacyLabel: "Automatic extraction is not configured",
      cloudAvailable,
    };
  }

  return {
    configured: true,
    provider: adapter.name,
    message: `Automatic extraction via ${adapter.name} is available.`,
    privacyLabel: `Provider: ${adapter.name}`,
    cloudAvailable,
  };
}

export function describeProviderChoices() {
  return providerChoices();
}
