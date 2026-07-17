import { z } from "zod";
import {
  APPROVAL_DECISIONS,
  APPROVAL_MODES,
  GOVERNANCE_DOCUMENT_CLASSES,
  GOVERNANCE_SECTION_TYPES,
  GOVERNANCE_VISIBILITIES,
  TRANSITION_TYPES,
} from "@/lib/governance/types";

const uuid = z.string().uuid();

export const governanceSectionSchema = z.object({
  section_type: z.enum(GOVERNANCE_SECTION_TYPES),
  heading: z.string().max(200).nullable().optional(),
  body: z.string().max(8000).nullable().optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
});

export const createGovernanceDocumentSchema = z.object({
  householdId: uuid,
  documentClass: z.enum(GOVERNANCE_DOCUMENT_CLASSES),
  title: z.string().trim().min(1).max(200),
  summary: z.string().max(2000).nullable().optional(),
  visibility: z.enum(GOVERNANCE_VISIBILITIES).default("private_draft"),
  isFinancial: z.boolean().optional(),
  sections: z.array(governanceSectionSchema).default([]),
  templateId: uuid.nullable().optional(),
});

export const saveGovernanceDraftSchema = z.object({
  documentId: uuid,
  householdId: uuid,
  title: z.string().trim().min(1).max(200).optional(),
  summary: z.string().max(2000).nullable().optional(),
  visibility: z.enum(GOVERNANCE_VISIBILITIES).optional(),
  sections: z.array(governanceSectionSchema).optional(),
  changeSummary: z.string().max(2000).nullable().optional(),
  createNewVersion: z.boolean().optional(),
});

export const proposeGovernanceSchema = z.object({
  documentId: uuid,
  householdId: uuid,
  versionId: uuid.nullable().optional(),
  participantMembershipIds: z.array(uuid).optional(),
});

export const respondApprovalSchema = z.object({
  requestId: uuid,
  householdId: uuid,
  decision: z.enum(APPROVAL_DECISIONS),
  comment: z.string().max(4000).nullable().optional(),
});

export const activateGovernanceSchema = z.object({
  documentId: uuid,
  householdId: uuid,
  versionId: uuid.nullable().optional(),
  effectiveAt: z.string().datetime().nullable().optional(),
});

export const acknowledgeGovernanceSchema = z.object({
  versionId: uuid,
  householdId: uuid,
  comment: z.string().max(2000).nullable().optional(),
});

export const createTransitionSchema = z.object({
  householdId: uuid,
  workflowType: z.enum(TRANSITION_TYPES),
  subjectMembershipId: uuid,
  plannedDate: z.string().nullable().optional(),
  noticeDate: z.string().nullable().optional(),
  roomAssignment: z.string().max(200).nullable().optional(),
});

export const completeTransitionTaskSchema = z.object({
  taskId: uuid,
  householdId: uuid,
  note: z.string().max(2000).nullable().optional(),
});

export const approvalRulesSchema = z.object({
  mode: z.enum(APPROVAL_MODES),
  quorum: z.number().int().min(1),
  percentage_threshold: z.number().int().min(1).max(100).nullable().optional(),
});
