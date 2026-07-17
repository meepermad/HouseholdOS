import type { AcknowledgmentRules } from "./types";

export function acknowledgmentRequired(rules: AcknowledgmentRules | null | undefined): boolean {
  return Boolean(rules?.required);
}

export function isAcknowledgmentOverdue(params: {
  status: string;
  dueAt: string | null | undefined;
  now?: Date;
}): boolean {
  if (params.status === "acknowledged" || params.status === "waived") return false;
  if (!params.dueAt) return false;
  const due = new Date(params.dueAt);
  if (Number.isNaN(due.getTime())) return false;
  return (params.now ?? new Date()) > due;
}

/** Opening a document is never acknowledgment. */
export function viewingIsNotAcknowledgment(): false {
  return false;
}

export const ACKNOWLEDGMENT_UI_COPY = {
  viewed: "Viewed",
  acknowledged: "Acknowledged (receipt confirmed)",
  approved: "Approved (recorded approval)",
  signed: "Signed or accepted (only when the household uses an approval workflow)",
} as const;
