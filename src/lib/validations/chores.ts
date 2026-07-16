import { z } from "zod";
import { CHORE_CATEGORIES } from "@/lib/chores/categories";
import { isValidIanaTimeZone } from "@/lib/calendar/time-mode";

const uuid = z.string().uuid();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const optionalText = (max: number) =>
  z.string().trim().max(max).optional().or(z.literal(""));

export const choreCategorySchema = z.enum(CHORE_CATEGORIES);
export const choreVisibilitySchema = z.enum(["household", "assignees"]);
export const choreStatusSchema = z.enum([
  "scheduled", "in_progress", "completed", "blocked", "skipped",
  "cancelled", "awaiting_verification", "verified", "reopened",
]);
export const blockedReasonSchema = z.enum([
  "missing_supplies", "equipment_unavailable", "access_blocked", "dependency",
  "safety_concern", "not_enough_time", "other",
]);
export const rotationStrategySchema = z.enum([
  "fixed", "round_robin", "balanced", "manual_sequence",
]);

const common = {
  householdId: uuid,
  title: z.string().trim().min(1).max(200),
  description: optionalText(4000),
  category: choreCategorySchema,
  visibility: choreVisibilitySchema.default("household"),
  allDay: z.boolean().default(false),
  gracePeriodMinutes: z.number().int().min(0).max(10080).default(120),
  requiresVerification: z.boolean().default(false),
  verifierMembershipId: uuid.optional().nullable(),
  showOnCalendar: z.boolean().default(true),
  responsibilityAreaId: uuid.optional().nullable(),
  reminderOffsets: z.array(z.number().int().min(0).max(525600)).max(5).default([1440, 120]),
};

export const createOneTimeChoreSchema = z.object({
  ...common,
  dueAt: z.string().datetime({ offset: true }),
  dueDate: date.optional().nullable(),
  assigneeMembershipIds: z.array(uuid).max(30).default([]),
});

export const createRecurringChoreSchema = z.object({
  ...common,
  startDate: date,
  endDate: date.optional().nullable(),
  rrule: z.string().trim().min(1).max(1000),
  timeZone: z.string().trim().min(1).refine(isValidIanaTimeZone, "Invalid timezone."),
  dueTimeMinutes: z.number().int().min(0).max(1439).optional().nullable(),
  recurrenceCount: z.number().int().min(1).max(520).optional().nullable(),
  rotationId: uuid.optional().nullable(),
  escalationCoordinator: z.boolean().default(false),
}).superRefine((value, ctx) => {
  if (!value.allDay && value.dueTimeMinutes == null) {
    ctx.addIssue({ code: "custom", path: ["dueTimeMinutes"], message: "Timed chores need a due time." });
  }
  if (value.allDay && value.dueTimeMinutes != null) {
    ctx.addIssue({ code: "custom", path: ["dueTimeMinutes"], message: "All-day chores cannot have a due time." });
  }
});

export const occurrenceActionSchema = z.object({ householdId: uuid, occurrenceId: uuid });
export const definitionActionSchema = z.object({ householdId: uuid, definitionId: uuid });
export const completeChoreSchema = occurrenceActionSchema.extend({ note: optionalText(2000) });
export const blockChoreSchema = occurrenceActionSchema.extend({
  reason: blockedReasonSchema,
  note: optionalText(2000),
});
export const skipChoreSchema = occurrenceActionSchema.extend({
  reason: z.string().trim().min(1).max(2000),
});
export const cancelChoreSchema = occurrenceActionSchema.extend({ reason: optionalText(2000) });
export const reopenChoreSchema = occurrenceActionSchema.extend({
  reason: z.string().trim().min(1).max(2000),
});
export const assignChoreSchema = occurrenceActionSchema.extend({
  membershipId: uuid,
  role: z.enum(["primary", "collaborator", "verifier"]).default("primary"),
});
export const requestReassignmentSchema = occurrenceActionSchema.extend({
  reason: z.string().trim().min(1).max(2000),
  suggestedMembershipId: uuid.optional().nullable(),
  requestedEffectiveAt: z.string().datetime({ offset: true }).optional().nullable(),
});
export const resolveReassignmentSchema = z.object({
  householdId: uuid,
  requestId: uuid,
  resolutionNote: optionalText(2000),
});

export const rotationSchema = z.object({
  householdId: uuid,
  rotationId: uuid.optional(),
  name: z.string().trim().min(1).max(200),
  strategy: rotationStrategySchema,
  startMembershipId: uuid.optional().nullable(),
  membershipIds: z.array(uuid).max(30).default([]),
});
export const rotationStatusSchema = z.object({
  householdId: uuid,
  rotationId: uuid,
  paused: z.boolean().optional(),
  ended: z.boolean().optional(),
});

export const responsibilityAreaSchema = z.object({
  householdId: uuid,
  name: z.string().trim().min(1).max(200),
  description: optionalText(4000),
  category: choreCategorySchema,
  startDate: date,
  handoffExpectations: optionalText(4000),
  ownerMembershipId: uuid.optional().nullable(),
});
export const assignResponsibilitySchema = z.object({
  householdId: uuid,
  areaId: uuid,
  membershipId: uuid,
  role: z.enum(["owner", "co_owner"]).default("owner"),
});
export const requestResponsibilityTransferSchema = z.object({
  householdId: uuid,
  areaId: uuid,
  toMembershipId: uuid,
  note: optionalText(2000),
});
export const resolveResponsibilityTransferSchema = z.object({
  householdId: uuid,
  transferId: uuid,
});
