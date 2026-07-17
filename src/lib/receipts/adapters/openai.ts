import "server-only";

import { createHash } from "node:crypto";
import { parseCurrencyAmountToCents } from "../currency";
import { maskPaymentInfo } from "../mask-payment";
import type { ExtractedLineItem, ExtractedReceipt } from "../types";
import type {
  ReceiptExtractionAdapter,
  ReceiptExtractionInput,
  ReceiptExtractionResult,
} from "./types";

type OpenAiContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

/**
 * OpenAI Vision structured extraction. Credentials stay server-only.
 * Never claim success when the key is missing.
 */
export class OpenAiReceiptExtractionAdapter implements ReceiptExtractionAdapter {
  readonly name = "openai";
  readonly configured: boolean;
  private readonly apiKey: string | undefined;
  private readonly model: string;

  constructor(apiKey?: string, model = "gpt-4o-mini") {
    this.apiKey = apiKey ?? process.env.OPENAI_API_KEY;
    this.configured = Boolean(this.apiKey);
    this.model = model;
  }

  async extract(input: ReceiptExtractionInput): Promise<ReceiptExtractionResult> {
    if (!this.apiKey) {
      return {
        ok: false,
        adapter: this.name,
        configured: false,
        error: "Automatic extraction is not configured.",
      };
    }

    const b64 = Buffer.from(input.bytes).toString("base64");
    const dataUrl = `data:${input.mimeType};base64,${b64}`;
    const content: OpenAiContentPart[] = [
      {
        type: "text",
        text: `Extract receipt fields as JSON with keys: merchant, purchaseDate (YYYY-MM-DD), subtotal, tax, tip, total, currency, paymentMethodSummary, lineItems[{description, quantity, unitPrice, totalPrice}]. Never include full card numbers; mask to last 4. Numbers as decimal currency strings.`,
      },
      { type: "image_url", image_url: { url: dataUrl } },
    ];

    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.model,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content:
                "You extract grocery/retail receipt data. Output JSON only. Mask payment PANs.",
            },
            { role: "user", content },
          ],
          temperature: 0,
        }),
      });

      if (!res.ok) {
        return {
          ok: false,
          adapter: this.name,
          configured: true,
          error: `OCR provider returned ${res.status}`,
        };
      }

      const body = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const rawText = body.choices?.[0]?.message?.content ?? "{}";
      const parsed = JSON.parse(rawText) as Record<string, unknown>;
      const extraction = mapOpenAiPayload(parsed, input.bytes);
      return { ok: true, adapter: this.name, extraction };
    } catch {
      return {
        ok: false,
        adapter: this.name,
        configured: true,
        error: "OCR provider request failed",
      };
    }
  }
}

function mapOpenAiPayload(
  parsed: Record<string, unknown>,
  bytes: Uint8Array,
): ExtractedReceipt {
  const linesRaw = Array.isArray(parsed.lineItems) ? parsed.lineItems : [];
  const lineItems: ExtractedLineItem[] = linesRaw.map((row) => {
    const r = row as Record<string, unknown>;
    const desc = String(r.description ?? r.name ?? "");
    return {
      ocrText: desc,
      name: desc,
      quantity:
        typeof r.quantity === "number"
          ? r.quantity
          : parseFloat(String(r.quantity ?? "")) || null,
      unitPriceCents: parseCurrencyAmountToCents(
        r.unitPrice as string | number | undefined,
      ),
      totalPriceCents: parseCurrencyAmountToCents(
        r.totalPrice as string | number | undefined,
      ),
      confidence: 0.75,
    };
  });

  return {
    merchant: parsed.merchant ? String(parsed.merchant) : null,
    purchaseDate: parsed.purchaseDate ? String(parsed.purchaseDate) : null,
    subtotalCents: parseCurrencyAmountToCents(
      parsed.subtotal as string | number | undefined,
    ),
    taxCents: parseCurrencyAmountToCents(parsed.tax as string | number | undefined),
    tipCents: parseCurrencyAmountToCents(parsed.tip as string | number | undefined),
    totalCents: parseCurrencyAmountToCents(
      parsed.total as string | number | undefined,
    ),
    currency: String(parsed.currency ?? "USD").toUpperCase().slice(0, 3),
    paymentMethodSummary: maskPaymentInfo(
      parsed.paymentMethodSummary
        ? String(parsed.paymentMethodSummary)
        : null,
    ),
    lineItems,
    confidence: 0.75,
    contentHash: createHash("sha256").update(bytes).digest("hex").slice(0, 32),
  };
}
