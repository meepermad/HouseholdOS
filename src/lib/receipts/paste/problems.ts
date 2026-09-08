export type PasteProblemCode =
  | "empty"
  | "too_large"
  | "multiple_receipts"
  | "missing_end"
  | "missing_items"
  | "missing_merchant"
  | "missing_total"
  | "malformed_amount"
  | "malformed_quantity"
  | "too_many_delimiters"
  | "negative_amount"
  | "overflow_amount"
  | "duplicate_field"
  | "paid_by_unmatched"
  | "totals_mismatch"
  | "ambiguous"
  | "html_or_script"
  | "unknown_format";

export type PasteProblemSeverity = "blocker" | "review";

export type PasteProblem = {
  code: PasteProblemCode;
  message: string;
  severity: PasteProblemSeverity;
  lineNumber?: number;
  originalLine?: string;
  reason?: string;
  suggestedAction?: string;
};

export function userFacingPasteError(
  problems: readonly PasteProblem[],
  fallback?: PasteProblem | null,
): string {
  const blocker = problems.find((p) => p.severity === "blocker");
  return (
    blocker?.message ??
    fallback?.message ??
    problems[0]?.message ??
    "We could not confidently understand part of this receipt."
  );
}

export function itemLineIssues(problems: readonly PasteProblem[]): PasteProblem[] {
  return problems.filter(
    (p) =>
      p.originalLine != null &&
      (p.code === "malformed_amount" ||
        p.code === "malformed_quantity" ||
        p.code === "too_many_delimiters" ||
        p.code === "negative_amount" ||
        p.code === "overflow_amount" ||
        p.code === "ambiguous"),
  );
}

export function canContinueItemized(input: {
  merchant: string | null;
  totalCents: number | null;
  problems: readonly PasteProblem[];
}): boolean {
  if (!input.merchant || input.totalCents == null) return false;
  if (input.problems.some((p) => p.severity === "blocker")) return false;
  if (itemLineIssues(input.problems).length > 0) return false;
  return true;
}

export function canContinueTotalOnly(input: {
  merchant: string | null;
  totalCents: number | null;
  problems: readonly PasteProblem[];
}): boolean {
  if (!input.merchant || input.totalCents == null) return false;
  return !input.problems.some(
    (p) =>
      p.severity === "blocker" &&
      (p.code === "overflow_amount" ||
        p.code === "unknown_format" ||
        p.code === "too_large" ||
        p.code === "html_or_script" ||
        p.code === "multiple_receipts"),
  );
}
