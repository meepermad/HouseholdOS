import type {
  ChoreDefinitionStatus,
  ChoreOccurrenceStatus,
  ResponsibilityAreaStatus,
  ResponsibilityTransferStatus,
} from "./types";

const DEFINITION_TRANSITIONS: Record<
  ChoreDefinitionStatus,
  readonly ChoreDefinitionStatus[]
> = {
  active: ["paused", "ended"],
  paused: ["active", "ended"],
  ended: [],
};

const OCCURRENCE_TRANSITIONS: Record<
  ChoreOccurrenceStatus,
  readonly ChoreOccurrenceStatus[]
> = {
  scheduled: [
    "in_progress",
    "completed",
    "awaiting_verification",
    "blocked",
    "skipped",
    "cancelled",
  ],
  in_progress: [
    "completed",
    "awaiting_verification",
    "blocked",
    "skipped",
    "cancelled",
  ],
  completed: ["reopened"],
  awaiting_verification: ["verified", "reopened"],
  verified: ["reopened"],
  blocked: ["scheduled", "in_progress", "skipped", "cancelled", "reopened"],
  skipped: [],
  cancelled: [],
  reopened: [
    "scheduled",
    "in_progress",
    "completed",
    "awaiting_verification",
    "blocked",
    "skipped",
    "cancelled",
  ],
};

const AREA_TRANSITIONS: Record<
  ResponsibilityAreaStatus,
  readonly ResponsibilityAreaStatus[]
> = {
  active: ["handoff_pending", "paused", "ended"],
  handoff_pending: ["active", "ended"],
  paused: ["active", "ended"],
  ended: [],
};

const TRANSFER_TRANSITIONS: Record<
  ResponsibilityTransferStatus,
  readonly ResponsibilityTransferStatus[]
> = {
  pending: ["accepted", "declined", "withdrawn"],
  accepted: [],
  declined: [],
  withdrawn: [],
};

export function canTransitionChoreDefinition(
  from: ChoreDefinitionStatus,
  to: ChoreDefinitionStatus,
): boolean {
  return from === to || DEFINITION_TRANSITIONS[from].includes(to);
}

/** @deprecated use canTransitionChoreDefinition */
export const canTransitionChore = canTransitionChoreDefinition;

export function canTransitionChoreOccurrence(
  from: ChoreOccurrenceStatus,
  to: ChoreOccurrenceStatus,
): boolean {
  return from === to || OCCURRENCE_TRANSITIONS[from].includes(to);
}

export function canTransitionResponsibilityArea(
  from: ResponsibilityAreaStatus,
  to: ResponsibilityAreaStatus,
): boolean {
  return from === to || AREA_TRANSITIONS[from].includes(to);
}

/** @deprecated use canTransitionResponsibilityArea */
export function canTransitionResponsibility(
  from: ResponsibilityAreaStatus,
  to: ResponsibilityAreaStatus,
): boolean {
  return canTransitionResponsibilityArea(from, to);
}

export function canTransitionResponsibilityTransfer(
  from: ResponsibilityTransferStatus,
  to: ResponsibilityTransferStatus,
): boolean {
  return from === to || TRANSFER_TRANSITIONS[from].includes(to);
}
