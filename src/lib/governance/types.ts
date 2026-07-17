/** Phase 8 governance domain types. */

export const GOVERNANCE_DOCUMENT_CLASSES = [
  "household_agreement",
  "house_rules",
  "financial_policy",
  "guest_policy",
  "cleaning_expectations",
  "shared_item_policy",
  "meal_grocery_expectations",
  "safety_emergency",
  "move_in_agreement",
  "move_out_agreement",
  "custom",
] as const;
export type GovernanceDocumentClass =
  (typeof GOVERNANCE_DOCUMENT_CLASSES)[number];

export const GOVERNANCE_STATUSES = [
  "draft",
  "proposed",
  "under_review",
  "approved",
  "active",
  "superseded",
  "archived",
  "rejected",
  "withdrawn",
] as const;
export type GovernanceStatus = (typeof GOVERNANCE_STATUSES)[number];

export const GOVERNANCE_VISIBILITIES = [
  "household",
  "participants",
  "coordinators",
  "private_draft",
] as const;
export type GovernanceVisibility = (typeof GOVERNANCE_VISIBILITIES)[number];

export const GOVERNANCE_SECTION_TYPES = [
  "heading",
  "explanatory_text",
  "rule",
  "financial_threshold",
  "checklist",
  "responsibility",
  "date_requirement",
  "acknowledgment_clause",
  "freeform",
] as const;
export type GovernanceSectionType = (typeof GOVERNANCE_SECTION_TYPES)[number];

export const APPROVAL_MODES = [
  "unanimous",
  "simple_majority",
  "percentage",
  "required_approvers",
  "coordinator",
  "financial_coordinator",
  "acknowledgment_only",
  "mixed",
] as const;
export type ApprovalMode = (typeof APPROVAL_MODES)[number];

export const APPROVAL_DECISIONS = [
  "approve",
  "reject",
  "abstain",
  "request_changes",
] as const;
export type ApprovalDecision = (typeof APPROVAL_DECISIONS)[number];

export const ACTIVATION_MODES = [
  "immediate",
  "scheduled",
  "after_acknowledgments",
  "after_approval_condition",
  "manual",
] as const;
export type ActivationMode = (typeof ACTIVATION_MODES)[number];

export const TRANSITION_TYPES = ["move_in", "move_out"] as const;
export type TransitionType = (typeof TRANSITION_TYPES)[number];

export const TRANSITION_STATUSES = [
  "draft",
  "in_progress",
  "blocked",
  "ready_to_complete",
  "completed",
  "cancelled",
] as const;
export type TransitionStatus = (typeof TRANSITION_STATUSES)[number];

export const TRANSITION_TASK_STATUSES = [
  "open",
  "in_progress",
  "blocked",
  "done",
  "cancelled",
  "skipped",
] as const;
export type TransitionTaskStatus = (typeof TRANSITION_TASK_STATUSES)[number];

export const ATTACHMENT_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "text/plain",
] as const;
export type GovernanceAttachmentMime = (typeof ATTACHMENT_MIME_TYPES)[number];

export const MAX_GOVERNANCE_ATTACHMENT_BYTES = 8 * 1024 * 1024;

export type GovernanceSectionInput = {
  section_type: GovernanceSectionType;
  heading?: string | null;
  body?: string | null;
  payload?: Record<string, unknown>;
};

export type ApprovalRules = {
  mode: ApprovalMode;
  quorum: number;
  percentage_threshold?: number | null;
};

export type AcknowledgmentRules = {
  required: boolean;
  scope?: "all_active" | "selected";
  deadline_hours?: number | null;
  reminder_cadence_hours?: number | null;
};

export type QuorumStatus = {
  satisfied: boolean;
  can_advance: boolean;
  reason: string;
  approve_count: number;
  reject_count: number;
  abstain_count: number;
  changes_count: number;
  pending_count: number;
  quorum: number;
};

export const DOCUMENT_CLASS_LABELS: Record<GovernanceDocumentClass, string> = {
  household_agreement: "Household agreement",
  house_rules: "House rules",
  financial_policy: "Financial policy",
  guest_policy: "Guest policy",
  cleaning_expectations: "Cleaning expectations",
  shared_item_policy: "Shared-item policy",
  meal_grocery_expectations: "Meal & grocery expectations",
  safety_emergency: "Safety & emergency",
  move_in_agreement: "Move-in agreement",
  move_out_agreement: "Move-out agreement",
  custom: "Custom document",
};

export const STATUS_LABELS: Record<GovernanceStatus, string> = {
  draft: "Draft",
  proposed: "Proposed",
  under_review: "Under review",
  approved: "Approved",
  active: "Active",
  superseded: "Superseded",
  archived: "Archived",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

export const LEGAL_COORDINATION_NOTICE =
  "HouseholdOS facilitates household coordination and recordkeeping. It does not provide legal advice, replace a lease, or guarantee that an acknowledgment is a legally binding signature.";
