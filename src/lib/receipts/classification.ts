import type { ItemAllocationMode } from "@/types/database";
import type { LineItemClassification } from "./types";

/**
 * Map receipt line classification to expense allocation mode.
 * Does not infer personal ownership solely from who paid.
 */
export function classificationToAllocationMode(
  classification: LineItemClassification,
): ItemAllocationMode {
  switch (classification) {
    case "shared_household":
      return "equal_all";
    case "personal_purchaser":
    case "personal_other":
      return "personal";
    case "shared_selected":
      return "equal_selected";
    case "excluded":
      return "excluded";
    case "needs_review":
      return "equal_all";
    default:
      return "equal_all";
  }
}

export function classificationLabel(classification: LineItemClassification): string {
  switch (classification) {
    case "shared_household":
      return "Shared household";
    case "personal_purchaser":
      return "Personal to purchaser";
    case "personal_other":
      return "Personal to another member";
    case "shared_selected":
      return "Shared selected members";
    case "excluded":
      return "Excluded from reimbursement";
    case "needs_review":
      return "Needs review";
  }
}

export const CLASSIFICATION_OPTIONS: readonly LineItemClassification[] = [
  "shared_household",
  "personal_purchaser",
  "personal_other",
  "shared_selected",
  "excluded",
  "needs_review",
] as const;
