/** Structured OCR evidence produced in-browser before deterministic parsing. */

export type OcrBoundingBox = {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
};

export type OcrWord = {
  text: string;
  confidence: number;
  bbox: OcrBoundingBox;
};

export type OcrLine = {
  text: string;
  confidence: number;
  bbox: OcrBoundingBox;
  words: OcrWord[];
  pageNumber: number;
};

export type OcrBlock = {
  text: string;
  confidence: number;
  bbox: OcrBoundingBox;
  lines: OcrLine[];
  pageNumber: number;
};

export type OcrPageResult = {
  pageNumber: number;
  fullText: string;
  blocks: OcrBlock[];
  lines: OcrLine[];
  words: OcrWord[];
  confidence: number;
  width: number;
  height: number;
};

export type OcrDocumentResult = {
  pages: OcrPageResult[];
  fullText: string;
  adapter: "local_tesseract";
  processedAt: string;
  durationMs: number;
};

export type FieldReviewStatus = "pending" | "accepted" | "corrected" | "excluded";

export type UserConfidenceState =
  | "looks_clear"
  | "please_check"
  | "could_not_determine";

export type ProposedField<T> = {
  value: T;
  confidence: number | null;
  userState: UserConfidenceState;
  sourceText: string | null;
  sourceBbox: OcrBoundingBox | null;
  pageNumber: number | null;
  reviewStatus: FieldReviewStatus;
  alternatives?: Array<{ value: T; confidence: number; sourceText: string }>;
};

export type ProposedLineItem = {
  ocrText: string;
  name: string;
  quantity: number | null;
  unitPriceCents: number | null;
  totalPriceCents: number | null;
  confidence: number | null;
  userState: UserConfidenceState;
  sourceBbox: OcrBoundingBox | null;
  pageNumber: number | null;
  reviewStatus: FieldReviewStatus;
  isDiscount: boolean;
  isWeighted: boolean;
};

export type ParsedReceiptProposal = {
  merchant: ProposedField<string | null>;
  storeLocation: ProposedField<string | null>;
  purchaseDate: ProposedField<string | null>;
  purchaseTime: ProposedField<string | null>;
  currency: ProposedField<string>;
  subtotalCents: ProposedField<number | null>;
  taxCents: ProposedField<number | null>;
  tipCents: ProposedField<number | null>;
  discountCents: ProposedField<number | null>;
  totalCents: ProposedField<number | null>;
  paymentMethodSummary: ProposedField<string | null>;
  lineItems: ProposedLineItem[];
  unmatchedLines: Array<{
    text: string;
    pageNumber: number;
    bbox: OcrBoundingBox | null;
  }>;
  overallConfidence: number | null;
  dateAmbiguous: boolean;
};

export type ReceiptAliasKind = "merchant" | "item";

export type ReceiptAlias = {
  id: string;
  kind: ReceiptAliasKind;
  sourceText: string;
  normalizedSource: string;
  targetText: string;
  merchantScope: string | null;
  useCount: number;
};
