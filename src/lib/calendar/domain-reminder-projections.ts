/**
 * Helpers for projecting finance / inventory reminders onto the calendar
 * without mutating source-of-truth domain records.
 */

import { resolveDomainProjection } from "@/lib/calendar/domain-projections";

export type DomainReminderProjectionInput = {
  householdId: string;
  sourceType: "finance_due" | "reimbursement_reminder" | "inventory_reminder" | "supply_reminder";
  sourceId: string;
  title: string;
  /** All-day due date YYYY-MM-DD */
  dueDate: string;
  timeZone?: string;
};

export function buildDomainReminderEventPayload(
  input: DomainReminderProjectionInput,
) {
  const meta = resolveDomainProjection(input.sourceType);
  const tz = input.timeZone ?? "America/Chicago";
  return {
    household_id: input.householdId,
    title: input.title,
    category:
      input.sourceType === "finance_due" ||
      input.sourceType === "reimbursement_reminder"
        ? "bill_deadline"
        : "other",
    visibility: "household" as const,
    all_day: true,
    start_date: input.dueDate,
    end_date_exclusive: nextDay(input.dueDate),
    time_zone: tz,
    source_type: input.sourceType,
    source_id: input.sourceId,
    source_system: "householdos",
    lifecycle_owner: "domain" as const,
    is_editable: false,
    is_deletable: false,
    canonical_deep_link: meta.deepLink(
      input.householdId,
      input.sourceId,
      "pending",
    ),
  };
}

function nextDay(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  dt.setUTCDate(dt.getUTCDate() + 1);
  return dt.toISOString().slice(0, 10);
}

/** Lock-screen safe title — never include amounts. */
export function privacySafeFinanceTitle(
  kind: "bill" | "reimbursement" | "commitment",
  allowDetailed: boolean,
  detailedTitle: string,
): string {
  if (allowDetailed) return detailedTitle;
  switch (kind) {
    case "bill":
      return "Shared bill due";
    case "reimbursement":
      return "Reimbursement reminder";
    case "commitment":
      return "Payment commitment due";
  }
}
