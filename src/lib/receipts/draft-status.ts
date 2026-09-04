/**
 * Plain-language receipt draft labels. Status codes stay internal.
 */

import type { ReceiptStatus } from "./types";

export type DraftPrimaryAction =
  | "continue"
  | "claim_mine"
  | "review"
  | "retry_reading"
  | "enter_manually"
  | "view";

export function receiptDraftHeadline(input: {
  status: ReceiptStatus | string;
  ocrOutcome?: string | null;
  waitingCount?: number;
  isPayer?: boolean;
  currentUserNeedsToClaim?: boolean;
}): { title: string; action: DraftPrimaryAction } {
  const status = input.status;
  if (status === "failed" || input.ocrOutcome === "failed") {
    return { title: "Needs your details", action: "enter_manually" };
  }
  if (status === "uploaded" || status === "extracting" || input.ocrOutcome === "pending") {
    return { title: "Processing receipt", action: "retry_reading" };
  }
  if (status === "claiming") {
    if (input.currentUserNeedsToClaim) {
      return { title: "Select what is yours", action: "claim_mine" };
    }
    const waiting = input.waitingCount ?? 0;
    if (waiting > 0) {
      return {
        title:
          waiting === 1
            ? "Waiting for 1 person to claim items"
            : `Waiting for ${waiting} people to claim items`,
        action: input.isPayer ? "review" : "view",
      };
    }
    return { title: "Needs your review", action: "review" };
  }
  if (status === "ready_for_review") {
    return { title: "Needs your review", action: "review" };
  }
  if (status === "needs_review") {
    return { title: "Needs your review", action: "continue" };
  }
  if (status === "confirmed") {
    return { title: "Submitted", action: "view" };
  }
  return { title: "Continue this receipt", action: "continue" };
}

export function receiptStatusLabel(status: ReceiptStatus | string): string {
  switch (status) {
    case "uploaded":
    case "extracting":
      return "Reading receipt";
    case "needs_review":
      return "Needs review";
    case "claiming":
      return "Waiting for claims";
    case "ready_for_review":
      return "Ready to submit";
    case "confirmed":
      return "Submitted";
    case "failed":
      return "Could not read automatically";
    case "rejected":
      return "Discarded";
    default:
      return "Receipt";
  }
}
