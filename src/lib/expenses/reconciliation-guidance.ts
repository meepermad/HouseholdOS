import { formatMoney } from "./display";
import type { ExpenseCalcErrorCode } from "./types";

export type ReconciliationGuidance = {
  title: string;
  explanation: string;
  /**
   * Declared total minus calculated total, when the two disagree. Positive
   * means the lines do not yet account for the whole receipt.
   */
  differenceCents: number | null;
  /** Ways the member can resolve it themselves. Never applied automatically. */
  options: string[];
};

function explainCode(code: ExpenseCalcErrorCode, message: string): string {
  switch (code) {
    case "empty_participants":
      return "One of the lines is split between specific people but nobody is selected.";
    case "incomplete_allocation":
      return "A line is missing information — for example, a personal item without an owner.";
    case "invalid_fixed_total":
      return "The exact amounts entered for a line do not add up to that line's total.";
    case "invalid_percentage_total":
      return "The percentages entered for a line do not add up to 100%.";
    case "invalid_weights":
      return "Shares must be whole numbers greater than zero.";
    case "invalid_allocation_target":
      return "Someone included in a split is no longer an active household member.";
    case "invalid_payer":
      return "The payer must be an active household member.";
    case "currency_mismatch":
      return "This expense uses a different currency than the household.";
    case "zero_basis":
      return "Tax and tip cannot be split in proportion to items until some items are assigned.";
    case "invalid_negative_result":
      return "The split produced an amount that is not a whole number of cents.";
    case "reconciliation_failure":
      return "The line items and adjustments do not add up to the receipt total.";
    default:
      return message;
  }
}

/**
 * Turn a calculation failure into a plain-language explanation plus the
 * choices available to the member. Purely descriptive — resolving the
 * difference is always an explicit edit.
 */
export function describeReconciliation(input: {
  code: ExpenseCalcErrorCode;
  message: string;
  declaredTotalCents: number;
  calculatedTotalCents?: number;
}): ReconciliationGuidance {
  const { code, message, declaredTotalCents, calculatedTotalCents } = input;
  const hasDifference =
    calculatedTotalCents !== undefined &&
    calculatedTotalCents !== declaredTotalCents;
  const differenceCents = hasDifference
    ? declaredTotalCents - calculatedTotalCents
    : null;

  const options: string[] = [];
  if (differenceCents !== null && differenceCents > 0) {
    options.push(
      `Add ${formatMoney(differenceCents)} that is not on the list yet — often tax, tip, or a fee.`,
    );
    options.push(
      `Or change the receipt total to ${formatMoney(calculatedTotalCents!)} to match the lines.`,
    );
  } else if (differenceCents !== null && differenceCents < 0) {
    options.push(
      `Remove or reduce ${formatMoney(-differenceCents)} from the line items or adjustments.`,
    );
    options.push(
      `Or change the receipt total to ${formatMoney(calculatedTotalCents!)} to match the lines.`,
    );
  } else if (code === "empty_participants" || code === "incomplete_allocation") {
    options.push("Open the line below and finish its split.");
  }

  return {
    title: hasDifference ? "Totals do not match yet" : "Not ready to confirm",
    explanation: explainCode(code, message),
    differenceCents,
    options,
  };
}
