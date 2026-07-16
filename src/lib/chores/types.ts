export type ChoreDefinitionStatus = "active" | "paused" | "ended";

export type ChoreOccurrenceStatus =
  | "scheduled"
  | "in_progress"
  | "completed"
  | "blocked"
  | "skipped"
  | "cancelled"
  | "awaiting_verification"
  | "verified"
  | "reopened";

export type ChoreVisibility = "household" | "assignees";

export type ChoreAssignmentRole = "primary" | "collaborator" | "verifier";

export type ChoreAssignmentStatus =
  | "assigned"
  | "accepted"
  | "claimed"
  | "declined"
  | "released";

export type RotationStrategy =
  | "fixed"
  | "round_robin"
  | "balanced"
  | "manual_sequence";

export type ResponsibilityAreaStatus =
  | "active"
  | "handoff_pending"
  | "paused"
  | "ended";

export type ResponsibilityTransferStatus =
  | "pending"
  | "accepted"
  | "declined"
  | "withdrawn";

export type ChoreReassignmentStatus =
  | "pending"
  | "approved"
  | "declined"
  | "withdrawn";

export type ChoreBlockedReason =
  | "missing_supplies"
  | "equipment_unavailable"
  | "access_blocked"
  | "dependency"
  | "safety_concern"
  | "not_enough_time"
  | "other";

export type ChoreEscalationLevel =
  | "assignee_reminder"
  | "assignee_overdue"
  | "creator_owner"
  | "coordinator";

export type ChoreExclusion = {
  membershipId: string;
  until?: Date | string | null;
};

export type RotationOccurrence = {
  occurrenceIndex: number;
  dueDate?: Date | string;
};

export type RotationAssignment = {
  occurrenceIndex: number;
  dueDate?: Date;
  membershipId: string | null;
};

export type AssignmentMap =
  | ReadonlyMap<number, string | null>
  | Readonly<Record<number, string | null | undefined>>;

export type AssignmentCounts =
  | ReadonlyMap<string, number>
  | Readonly<Record<string, number | undefined>>;

export type RotationInput = {
  strategy: RotationStrategy;
  orderedEligibleMemberIds: readonly string[];
  occurrenceIndex: number;
  dueDate?: Date | string;
  exclusions?: readonly ChoreExclusion[];
  removedMemberIds?: readonly string[] | ReadonlySet<string>;
  paused?: boolean;
  startMembershipId?: string;
  recentAssignmentCounts?: AssignmentCounts;
  overrides?: AssignmentMap;
  completedAssignments?: AssignmentMap;
};

export type RotationPreviewInput = Omit<
  RotationInput,
  "occurrenceIndex" | "dueDate"
> & {
  occurrences: readonly RotationOccurrence[];
};
