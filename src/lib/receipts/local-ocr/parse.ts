import { maskPaymentInfo } from "../mask-payment";
import {
  extractLabeledAmounts,
  pickFirstOfKind,
  selectTotalCandidates,
} from "./amounts";
import { toUserConfidenceState } from "./confidence-ui";
import { extractDateCandidates, extractPurchaseTime } from "./dates";
import { groupLineItems } from "./line-items";
import { extractStoreLocation, selectMerchantCandidate } from "./merchant";
import { normalizeOcrText } from "./normalize";
import type {
  OcrDocumentResult,
  OcrLine,
  ParsedReceiptProposal,
  ProposedField,
  ReceiptAlias,
} from "./types";

function field<T>(
  value: T,
  confidence: number | null,
  sourceText: string | null,
  extras?: Partial<ProposedField<T>>,
): ProposedField<T> {
  return {
    value,
    confidence,
    userState: toUserConfidenceState(confidence),
    sourceText,
    sourceBbox: extras?.sourceBbox ?? null,
    pageNumber: extras?.pageNumber ?? null,
    reviewStatus: "pending",
    alternatives: extras?.alternatives,
  };
}

function flattenLines(doc: OcrDocumentResult): OcrLine[] {
  return doc.pages.flatMap((p) => p.lines);
}

/**
 * Deterministic receipt parser — no LLM on the free local path.
 */
export function parseReceiptFromOcr(
  doc: OcrDocumentResult,
  options?: { aliases?: ReceiptAlias[] },
): ParsedReceiptProposal {
  const aliases = options?.aliases ?? [];
  const lines = flattenLines(doc);
  const textLines = lines.map((l) => l.text);
  const fullText = normalizeOcrText(doc.fullText || textLines.join("\n"));

  const merchantCand = selectMerchantCandidate(lines, aliases);
  const location = extractStoreLocation(lines);
  const dates = extractDateCandidates(fullText);
  const bestDate = dates[0] ?? null;
  const time = extractPurchaseTime(fullText);

  const amounts = extractLabeledAmounts(textLines);
  const { selected: totalSel, alternatives: totalAlts } =
    selectTotalCandidates(amounts);
  const subtotal = pickFirstOfKind(amounts, "subtotal");
  const tax = pickFirstOfKind(amounts, "tax");
  const tip = pickFirstOfKind(amounts, "tip");
  const discount = pickFirstOfKind(amounts, "discount");

  const grouped = groupLineItems(lines, {
    aliases,
    merchant: merchantCand?.value ?? null,
  });

  const paymentMatch = fullText.match(
    /\b((?:Visa|Mastercard|Amex|Discover|Debit|Credit|Cash|Apple Pay|Google Pay)[^\n]{0,40})/i,
  );
  const paymentSummary = maskPaymentInfo(paymentMatch?.[1] ?? null);

  const confidences = [
    merchantCand?.confidence,
    bestDate?.confidence,
    totalSel?.confidence,
    ...grouped.items.map((i) => i.confidence ?? 0),
  ].filter((c): c is number => typeof c === "number");
  const overall =
    confidences.length > 0
      ? confidences.reduce((a, b) => a + b, 0) / confidences.length
      : null;

  return {
    merchant: field(merchantCand?.value ?? null, merchantCand?.confidence ?? null, merchantCand?.sourceText ?? null, {
      sourceBbox: merchantCand?.bbox ?? null,
      pageNumber: merchantCand?.pageNumber ?? null,
    }),
    storeLocation: field(location.value, location.confidence || null, location.sourceText),
    purchaseDate: field(
      bestDate?.isoDate ?? null,
      bestDate?.confidence ?? null,
      bestDate?.sourceText ?? null,
      {
        alternatives: dates.slice(1, 4).map((d) => ({
          value: d.isoDate,
          confidence: d.confidence,
          sourceText: d.sourceText,
        })),
      },
    ),
    purchaseTime: field(time.value, time.confidence || null, time.sourceText),
    currency: field("USD", 0.9, null),
    subtotalCents: field(subtotal?.cents ?? null, subtotal?.confidence ?? null, subtotal?.sourceText ?? null),
    taxCents: field(tax?.cents ?? null, tax?.confidence ?? null, tax?.sourceText ?? null),
    tipCents: field(tip?.cents ?? null, tip?.confidence ?? null, tip?.sourceText ?? null),
    discountCents: field(discount?.cents ?? null, discount?.confidence ?? null, discount?.sourceText ?? null),
    totalCents: field(totalSel?.cents ?? null, totalSel?.confidence ?? null, totalSel?.sourceText ?? null, {
      alternatives: totalAlts.map((a) => ({
        value: a.cents,
        confidence: a.confidence,
        sourceText: a.sourceText,
      })),
    }),
    paymentMethodSummary: field(paymentSummary, paymentSummary ? 0.7 : null, paymentMatch?.[1] ?? null),
    lineItems: grouped.items,
    unmatchedLines: grouped.unmatched,
    overallConfidence: overall,
    dateAmbiguous: Boolean(bestDate?.ambiguous),
  };
}

/** Aggregate multi-page OCR into one document result. */
export function aggregateOcrPages(
  pages: OcrDocumentResult["pages"],
  meta?: { durationMs?: number },
): OcrDocumentResult {
  return {
    pages,
    fullText: pages.map((p) => `--- Page ${p.pageNumber} ---\n${p.fullText}`).join("\n\n"),
    adapter: "local_tesseract",
    processedAt: new Date().toISOString(),
    durationMs: meta?.durationMs ?? 0,
  };
}
