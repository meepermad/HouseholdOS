import {
  CHORE_CATEGORY_LABELS,
  type ChoreCategory,
} from "./categories";
import type {
  ChoreBlockedReason,
  ChoreDefinitionStatus,
  ChoreOccurrenceStatus,
  ResponsibilityAreaStatus,
} from "./types";

export const CHORE_DEFINITION_STATUS_LABELS: Record<
  ChoreDefinitionStatus,
  string
> = {
  active: "Active",
  paused: "Paused",
  ended: "Ended",
};

/** @deprecated */
export const CHORE_STATUS_LABELS = CHORE_DEFINITION_STATUS_LABELS;

export const CHORE_OCCURRENCE_STATUS_LABELS: Record<
  ChoreOccurrenceStatus,
  string
> = {
  scheduled: "Scheduled",
  in_progress: "In progress",
  completed: "Completed",
  blocked: "Blocked",
  skipped: "Skipped",
  cancelled: "Cancelled",
  awaiting_verification: "Awaiting verification",
  verified: "Verified",
  reopened: "Reopened",
};

export const RESPONSIBILITY_AREA_STATUS_LABELS: Record<
  ResponsibilityAreaStatus,
  string
> = {
  active: "Active",
  handoff_pending: "Handoff pending",
  paused: "Paused",
  ended: "Ended",
};

/** @deprecated */
export const RESPONSIBILITY_STATUS_LABELS = RESPONSIBILITY_AREA_STATUS_LABELS;

export const CHORE_BLOCKED_REASON_LABELS: Record<ChoreBlockedReason, string> = {
  missing_supplies: "Missing supplies",
  equipment_unavailable: "Equipment unavailable",
  access_blocked: "Access blocked",
  dependency: "Another task must happen first",
  safety_concern: "Safety concern",
  not_enough_time: "Not enough time",
  other: "Other",
};

export type ChoreBoardSection =
  | "needs_attention"
  | "due_today"
  | "upcoming"
  | "overdue"
  | "blocked"
  | "awaiting_verification"
  | "completed_recently";

export const CHORE_BOARD_SECTION_LABELS: Record<ChoreBoardSection, string> = {
  needs_attention: "Needs attention",
  due_today: "Due today",
  upcoming: "Upcoming",
  overdue: "Overdue",
  blocked: "Blocked",
  awaiting_verification: "Awaiting verification",
  completed_recently: "Completed recently",
};

export function choreCategoryLabel(category: ChoreCategory): string {
  return CHORE_CATEGORY_LABELS[category] ?? category;
}

export function choreOccurrenceStatusLabel(
  status: ChoreOccurrenceStatus,
): string {
  return CHORE_OCCURRENCE_STATUS_LABELS[status];
}

export function choreStatusLabel(status: ChoreDefinitionStatus): string {
  return CHORE_DEFINITION_STATUS_LABELS[status];
}

export function choreBoardSection(params: {
  status: ChoreOccurrenceStatus;
  dueAt: Date | string;
  now?: Date;
}): ChoreBoardSection {
  return boardSectionForOccurrence(params);
}

export function choreBoardSectionLabel(section: ChoreBoardSection): string {
  return CHORE_BOARD_SECTION_LABELS[section];
}

export function isOpenOccurrenceStatus(status: ChoreOccurrenceStatus): boolean {
  return (
    status === "scheduled" ||
    status === "in_progress" ||
    status === "blocked" ||
    status === "awaiting_verification" ||
    status === "reopened"
  );
}

export function isTerminalOccurrenceStatus(
  status: ChoreOccurrenceStatus,
): boolean {
  return (
    status === "completed" ||
    status === "verified" ||
    status === "skipped" ||
    status === "cancelled"
  );
}

export function boardSectionForOccurrence(params: {
  status: ChoreOccurrenceStatus;
  dueAt: Date | string;
  now?: Date;
}): ChoreBoardSection {
  const now = params.now ?? new Date();
  const due =
    typeof params.dueAt === "string" ? new Date(params.dueAt) : params.dueAt;

  if (params.status === "blocked") return "blocked";
  if (params.status === "awaiting_verification") return "awaiting_verification";
  if (params.status === "completed" || params.status === "verified") {
    return "completed_recently";
  }
  if (
    params.status === "scheduled" ||
    params.status === "in_progress" ||
    params.status === "reopened"
  ) {
    if (due.getTime() < now.getTime()) return "overdue";
    const startOfTomorrow = new Date(now);
    startOfTomorrow.setHours(24, 0, 0, 0);
    if (due.getTime() < startOfTomorrow.getTime()) return "due_today";
    return "upcoming";
  }
  return "needs_attention";
}
