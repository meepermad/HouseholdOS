import { claimedQuantity, lineQuantity } from "@/lib/receipts/claims";
import type { LineItemClassification } from "@/lib/receipts/types";
import {
  resolvePastedDisplayDescription,
  type DescriptionSource,
} from "./display-description";

export type PersistedReceiptLine = {
  id?: string;
  sortIndex?: number;
  ocrText?: string | null;
  ocr_text?: string | null;
  correctedName?: string | null;
  corrected_name?: string | null;
  sourceText?: string | null;
  source_text?: string | null;
  displayDescription?: string | null;
  quantity?: number | null;
  unitPriceCents?: number | null;
  unit_price_cents?: number | null;
  totalPriceCents?: number | null;
  total_price_cents?: number | null;
  classification?: string | null;
  participantMembershipIds?: string[] | null;
  participant_membership_ids?: string[] | null;
  descriptionEditedByUser?: boolean | null;
  description_edited_by_user?: boolean | null;
  descriptionSource?: DescriptionSource | string | null;
  description_source?: string | null;
  claimReviewRequired?: boolean | null;
  claim_review_required?: boolean | null;
  reviewStatus?: string | null;
  review_status?: string | null;
};

export function mapPersistedLineToReview(line: PersistedReceiptLine, pasted: boolean) {
  const sourceText = line.sourceText ?? line.source_text ?? line.ocrText ?? line.ocr_text ?? "";
  const display = pasted
    ? resolvePastedDisplayDescription({
        displayDescription: line.displayDescription,
        correctedName: line.correctedName ?? line.corrected_name,
        sourceText,
        ocrText: line.ocrText ?? line.ocr_text,
        descriptionEditedByUser:
          line.descriptionEditedByUser ?? line.description_edited_by_user ?? false,
        descriptionSource: line.descriptionSource ?? line.description_source,
      })
    : (line.correctedName ?? line.corrected_name ?? line.ocrText ?? line.ocr_text ?? "");
  return {
    id: line.id,
    sortIndex: line.sortIndex ?? 0,
    ocrText: sourceText,
    sourceText,
    correctedName: display || (pasted ? "" : (line.ocrText ?? line.ocr_text ?? "")),
    quantity: line.quantity ?? null,
    unitPriceCents: line.unitPriceCents ?? line.unit_price_cents ?? null,
    totalPriceCents: line.totalPriceCents ?? line.total_price_cents ?? null,
    classification: (line.classification ?? "needs_review") as LineItemClassification,
    participantMembershipIds:
      line.participantMembershipIds ?? line.participant_membership_ids ?? [],
    descriptionEditedByUser:
      line.descriptionEditedByUser ?? line.description_edited_by_user ?? false,
    descriptionSource: line.descriptionSource ?? line.description_source ?? (pasted ? "pasted" : "ocr"),
    claimReviewRequired: line.claimReviewRequired ?? line.claim_review_required ?? false,
    reviewStatus: line.reviewStatus ?? line.review_status ?? "pending",
  };
}

export function expenseItemDescriptionFromReceiptLine(
  line: PersistedReceiptLine,
  pasted: boolean,
): string {
  const mapped = mapPersistedLineToReview(line, pasted);
  return mapped.correctedName || "Item";
}

export function claimedUnitsOnLine(
  quantity: number | null | undefined,
  claims: Array<{ quantity: number; kind?: string }>,
): { claimed: number; remaining: number } {
  const claimed = claimedQuantity(
    claims.map((c) => ({
      membershipId: "x",
      quantity: c.quantity,
      kind: (c.kind as "mine") ?? "mine",
    })),
  );
  const total = lineQuantity(quantity);
  return { claimed, remaining: Math.max(0, total - claimed) };
}
