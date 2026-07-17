import "server-only";

import { DisabledReceiptExtractionAdapter } from "./disabled";
import { FixtureReceiptExtractionAdapter } from "./fixture";
import { OpenAiReceiptExtractionAdapter } from "./openai";
import type { ReceiptExtractionAdapter } from "./types";

/**
 * Resolve OCR adapter from env.
 * RECEIPT_OCR_PROVIDER=openai|fixture|disabled (default: openai if key else disabled)
 */
export function resolveReceiptExtractionAdapter(
  env: NodeJS.ProcessEnv = process.env,
): ReceiptExtractionAdapter {
  const forced = (env.RECEIPT_OCR_PROVIDER ?? "").toLowerCase().trim();
  if (forced === "fixture") return new FixtureReceiptExtractionAdapter();
  if (forced === "disabled") return new DisabledReceiptExtractionAdapter();
  if (forced === "openai" || (!forced && env.OPENAI_API_KEY)) {
    const adapter = new OpenAiReceiptExtractionAdapter(env.OPENAI_API_KEY);
    if (adapter.configured) return adapter;
  }
  return new DisabledReceiptExtractionAdapter();
}

export function describeReceiptOcrStatus(
  env: NodeJS.ProcessEnv = process.env,
): { configured: boolean; provider: string; message: string } {
  const adapter = resolveReceiptExtractionAdapter(env);
  if (!adapter.configured) {
    return {
      configured: false,
      provider: adapter.name,
      message:
        "Automatic extraction is not configured. You can still upload receipts and enter details manually.",
    };
  }
  return {
    configured: true,
    provider: adapter.name,
    message: `Automatic extraction via ${adapter.name} is available.`,
  };
}
