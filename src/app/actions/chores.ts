"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionResult } from "@/app/actions/auth";
import { assertActiveMembership } from "@/lib/household-context";
import { can, type Capability } from "@/lib/permissions";
import { toPublicErrorMessage } from "@/lib/errors";
import { materializeChoreOccurrences } from "@/lib/chores/materialize";
import {
  assignChoreSchema, blockChoreSchema, cancelChoreSchema, completeChoreSchema,
  createOneTimeChoreSchema, createRecurringChoreSchema, definitionActionSchema,
  occurrenceActionSchema, reopenChoreSchema, requestReassignmentSchema,
  resolveReassignmentSchema, rotationSchema, rotationStatusSchema, skipChoreSchema,
} from "@/lib/validations/chores";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UntypedDb = any;
const str = (value: FormDataEntryValue | null) => String(value ?? "").trim();
const optional = (value: FormDataEntryValue | null) => str(value) || null;
const bool = (value: FormDataEntryValue | null) => value === "true" || value === "on";
const num = (value: FormDataEntryValue | null) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};
function jsonArray(formData: FormData, name: string): string[] {
  try {
    const parsed = JSON.parse(str(formData.get(name)));
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return formData.getAll(name).map(String);
  }
}
function intArray(formData: FormData, name: string, fallback: number[] = []): number[] {
  const raw = jsonArray(formData, name).map(Number).filter(Number.isFinite);
  return raw.length ? raw : fallback;
}
const path = (householdId: string, suffix = "") => `/app/${householdId}/chores${suffix}`;

async function context(householdId: string, capability: Capability) {
  const ctx = await assertActiveMembership(householdId);
  if (!can(ctx.roles, capability)) throw new Error("You are not allowed to perform this chore action.");
  const { createClient } = await import("@/lib/supabase/server");
  return { ctx, supabase: (await createClient()) as UntypedDb };
}
function invalidate(householdId: string, occurrenceId?: string) {
  revalidatePath(path(householdId));
  revalidatePath(path(householdId, "/mine"));
  revalidatePath(`/app/${householdId}`);
  if (occurrenceId) revalidatePath(path(householdId, `/${occurrenceId}`));
}
async function rpcAction(args: {
  formData: FormData;
  schema: { safeParse: (value: unknown) => { success: boolean; data?: Record<string, unknown>; error?: { issues: Array<{ message: string }> } } };
  values: (formData: FormData) => Record<string, unknown>;
  capability: Capability;
  rpc: string;
  params: (data: Record<string, unknown>) => Record<string, unknown>;
  message: string;
}): Promise<ActionResult> {
  try {
    const parsed = args.schema.safeParse(args.values(args.formData));
    if (!parsed.success || !parsed.data) return { ok: false, error: parsed.error?.issues[0]?.message ?? "Invalid request." };
    const householdId = parsed.data.householdId as string;
    const { supabase } = await context(householdId, args.capability);
    const { error } = await supabase.rpc(args.rpc, args.params(parsed.data));
    if (error) return { ok: false, error: error.message || "Unable to update chore." };
    invalidate(householdId, parsed.data.occurrenceId as string | undefined);
    revalidatePath(path(householdId, "/rotations"));
    return { ok: true, message: args.message };
  } catch (error) {
    return { ok: false, error: toPublicErrorMessage(error) };
  }
}

export async function createOneTimeChoreAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  let target: string | null = null;
  try {
    const parsed = createOneTimeChoreSchema.safeParse({
      householdId: formData.get("householdId"), title: formData.get("title"),
      description: str(formData.get("description")), category: formData.get("category"),
      visibility: formData.get("visibility"), dueAt: formData.get("dueAt"),
      dueDate: optional(formData.get("dueDate")), allDay: bool(formData.get("allDay")),
      assigneeMembershipIds: jsonArray(formData, "assigneeMembershipIdsJson"),
      gracePeriodMinutes: num(formData.get("gracePeriodMinutes")) ?? 120,
      requiresVerification: bool(formData.get("requiresVerification")),
      verifierMembershipId: optional(formData.get("verifierMembershipId")),
      showOnCalendar: bool(formData.get("showOnCalendar")),
      responsibilityAreaId: optional(formData.get("responsibilityAreaId")),
      reminderOffsets: intArray(formData, "reminderOffsetsJson", [1440, 120]),
    });
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid chore." };
    const { supabase } = await context(parsed.data.householdId, "chore.create");
    const { data: definitionId, error } = await supabase.rpc("create_one_time_chore", {
      p_household_id: parsed.data.householdId, p_title: parsed.data.title,
      p_category: parsed.data.category, p_due_at: parsed.data.dueAt,
      p_assignee_membership_ids: parsed.data.assigneeMembershipIds,
      p_description: parsed.data.description || null, p_visibility: parsed.data.visibility,
      p_all_day: parsed.data.allDay, p_due_date: parsed.data.dueDate,
      p_grace_period_minutes: parsed.data.gracePeriodMinutes,
      p_requires_verification: parsed.data.requiresVerification,
      p_verifier_membership_id: parsed.data.verifierMembershipId,
      p_show_on_calendar: parsed.data.showOnCalendar,
      p_responsibility_area_id: parsed.data.responsibilityAreaId,
      p_reminder_offsets: parsed.data.reminderOffsets,
    });
    if (error) return { ok: false, error: error.message };
    invalidate(parsed.data.householdId);
    const { data: occurrence } = await supabase.from("chore_occurrences").select("id").eq("definition_id", definitionId).limit(1).maybeSingle();
    target = occurrence?.id ? path(parsed.data.householdId, `/${occurrence.id}`) : path(parsed.data.householdId);
  } catch (error) {
    return { ok: false, error: toPublicErrorMessage(error) };
  }
  redirect(target!);
}

export async function createRecurringChoreAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  let target: string | null = null;
  try {
    const parsed = createRecurringChoreSchema.safeParse({
      householdId: formData.get("householdId"), title: formData.get("title"),
      description: str(formData.get("description")), category: formData.get("category"),
      visibility: formData.get("visibility"), startDate: formData.get("startDate"),
      endDate: optional(formData.get("endDate")), rrule: formData.get("rrule"),
      timeZone: formData.get("timeZone"), allDay: bool(formData.get("allDay")),
      dueTimeMinutes: num(formData.get("dueTimeMinutes")),
      recurrenceCount: num(formData.get("recurrenceCount")),
      gracePeriodMinutes: num(formData.get("gracePeriodMinutes")) ?? 120,
      requiresVerification: bool(formData.get("requiresVerification")),
      verifierMembershipId: optional(formData.get("verifierMembershipId")),
      showOnCalendar: bool(formData.get("showOnCalendar")),
      rotationId: optional(formData.get("rotationId")),
      responsibilityAreaId: optional(formData.get("responsibilityAreaId")),
      reminderOffsets: intArray(formData, "reminderOffsetsJson", [1440, 120]),
      escalationCoordinator: bool(formData.get("escalationCoordinator")),
    });
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid recurring chore." };
    const { supabase } = await context(parsed.data.householdId, "chore.create");
    const { data: definitionId, error } = await supabase.rpc("create_chore_definition", {
      p_household_id: parsed.data.householdId, p_title: parsed.data.title,
      p_category: parsed.data.category, p_start_date: parsed.data.startDate,
      p_rrule: parsed.data.rrule, p_all_day: parsed.data.allDay,
      p_due_time_minutes: parsed.data.dueTimeMinutes, p_description: parsed.data.description || null,
      p_visibility: parsed.data.visibility, p_time_zone: parsed.data.timeZone,
      p_end_date: parsed.data.endDate, p_recurrence_count: parsed.data.recurrenceCount,
      p_grace_period_minutes: parsed.data.gracePeriodMinutes,
      p_requires_verification: parsed.data.requiresVerification,
      p_verifier_membership_id: parsed.data.verifierMembershipId,
      p_show_on_calendar: parsed.data.showOnCalendar, p_rotation_id: parsed.data.rotationId,
      p_responsibility_area_id: parsed.data.responsibilityAreaId,
      p_reminder_offsets: parsed.data.reminderOffsets,
      p_escalation_coordinator: parsed.data.escalationCoordinator,
    });
    if (error || !definitionId) return { ok: false, error: error?.message ?? "Unable to create chore." };
    const { data: definition } = await supabase.from("chore_definitions").select("*").eq("id", definitionId).single();
    if (definition) await materializeChoreOccurrences({ supabase, definition });
    invalidate(parsed.data.householdId);
    target = path(parsed.data.householdId, `/definitions/${definitionId}`);
  } catch (error) {
    return { ok: false, error: toPublicErrorMessage(error) };
  }
  redirect(target!);
}

const occurrenceValues = (f: FormData) => ({ householdId: f.get("householdId"), occurrenceId: f.get("occurrenceId") });
export const claimChoreAction = async (_p: ActionResult | null, f: FormData) => rpcAction({ formData: f, schema: occurrenceActionSchema, values: occurrenceValues, capability: "chore.manage_own", rpc: "claim_chore_occurrence", params: d => ({ p_occurrence_id: d.occurrenceId }), message: "Chore claimed." });
export const startChoreAction = async (_p: ActionResult | null, f: FormData) => rpcAction({ formData: f, schema: occurrenceActionSchema, values: occurrenceValues, capability: "chore.manage_own", rpc: "start_chore_occurrence", params: d => ({ p_occurrence_id: d.occurrenceId }), message: "Chore started." });
export const verifyChoreAction = async (_p: ActionResult | null, f: FormData) => rpcAction({ formData: f, schema: occurrenceActionSchema, values: occurrenceValues, capability: "chore.complete", rpc: "verify_chore_completion", params: d => ({ p_occurrence_id: d.occurrenceId }), message: "Completion verified." });
export const assignChoreAction = async (_p: ActionResult | null, f: FormData) => rpcAction({ formData: f, schema: assignChoreSchema, values: x => ({ ...occurrenceValues(x), membershipId: x.get("membershipId"), role: x.get("role") }), capability: "chore.manage_own", rpc: "assign_chore_occurrence", params: d => ({ p_occurrence_id: d.occurrenceId, p_membership_id: d.membershipId, p_role: d.role }), message: "Assignment saved." });
export const completeChoreAction = async (_p: ActionResult | null, f: FormData) => rpcAction({ formData: f, schema: completeChoreSchema, values: x => ({ ...occurrenceValues(x), note: str(x.get("note")) }), capability: "chore.complete", rpc: "complete_chore_occurrence", params: d => ({ p_occurrence_id: d.occurrenceId, p_completion_note: d.note || null }), message: "Chore completed." });
export const blockChoreAction = async (_p: ActionResult | null, f: FormData) => rpcAction({ formData: f, schema: blockChoreSchema, values: x => ({ ...occurrenceValues(x), reason: x.get("reason"), note: str(x.get("note")) }), capability: "chore.manage_own", rpc: "mark_chore_blocked", params: d => ({ p_occurrence_id: d.occurrenceId, p_reason: d.reason, p_note: d.note || null }), message: "Chore marked blocked." });
export const skipChoreAction = async (_p: ActionResult | null, f: FormData) => rpcAction({ formData: f, schema: skipChoreSchema, values: x => ({ ...occurrenceValues(x), reason: x.get("reason") }), capability: "chore.manage_own", rpc: "skip_chore_occurrence", params: d => ({ p_occurrence_id: d.occurrenceId, p_reason: d.reason }), message: "Chore skipped." });
export const cancelChoreAction = async (_p: ActionResult | null, f: FormData) => rpcAction({ formData: f, schema: cancelChoreSchema, values: x => ({ ...occurrenceValues(x), reason: str(x.get("reason")) }), capability: "chore.manage_own", rpc: "cancel_chore_occurrence", params: d => ({ p_occurrence_id: d.occurrenceId, p_reason: d.reason || null }), message: "Chore cancelled." });
export const reopenChoreAction = async (_p: ActionResult | null, f: FormData) => rpcAction({ formData: f, schema: reopenChoreSchema, values: x => ({ ...occurrenceValues(x), reason: x.get("reason") }), capability: "chore.coordinator_override", rpc: "reopen_chore_occurrence", params: d => ({ p_occurrence_id: d.occurrenceId, p_reason: d.reason }), message: "Chore reopened." });
export const requestChoreReassignmentAction = async (_p: ActionResult | null, f: FormData) => rpcAction({ formData: f, schema: requestReassignmentSchema, values: x => ({ ...occurrenceValues(x), reason: x.get("reason"), suggestedMembershipId: optional(x.get("suggestedMembershipId")), requestedEffectiveAt: optional(x.get("requestedEffectiveAt")) }), capability: "chore.manage_own", rpc: "request_chore_reassignment", params: d => ({ p_occurrence_id: d.occurrenceId, p_reason: d.reason, p_suggested_membership_id: d.suggestedMembershipId, p_requested_effective_at: d.requestedEffectiveAt }), message: "Reassignment requested." });
const resolveValues = (f: FormData) => ({ householdId: f.get("householdId"), requestId: f.get("requestId"), resolutionNote: str(f.get("resolutionNote")) });
export const approveChoreReassignmentAction = async (_p: ActionResult | null, f: FormData) => rpcAction({ formData: f, schema: resolveReassignmentSchema, values: resolveValues, capability: "chore.coordinator_override", rpc: "approve_chore_reassignment", params: d => ({ p_request_id: d.requestId, p_resolution_note: d.resolutionNote || null }), message: "Reassignment approved." });
export const declineChoreReassignmentAction = async (_p: ActionResult | null, f: FormData) => rpcAction({ formData: f, schema: resolveReassignmentSchema, values: resolveValues, capability: "chore.coordinator_override", rpc: "decline_chore_reassignment", params: d => ({ p_request_id: d.requestId, p_resolution_note: d.resolutionNote || null }), message: "Reassignment declined." });

const definitionValues = (f: FormData) => ({ householdId: f.get("householdId"), definitionId: f.get("definitionId") });
export const pauseChoreDefinitionAction = async (_p: ActionResult | null, f: FormData) => rpcAction({ formData: f, schema: definitionActionSchema, values: definitionValues, capability: "chore.manage_own", rpc: "pause_chore_definition", params: d => ({ p_definition_id: d.definitionId }), message: "Chore paused." });
export const resumeChoreDefinitionAction = async (_p: ActionResult | null, f: FormData) => rpcAction({ formData: f, schema: definitionActionSchema, values: definitionValues, capability: "chore.manage_own", rpc: "resume_chore_definition", params: d => ({ p_definition_id: d.definitionId }), message: "Chore resumed." });
export const endChoreDefinitionAction = async (_p: ActionResult | null, f: FormData) => rpcAction({ formData: f, schema: definitionActionSchema, values: definitionValues, capability: "chore.manage_own", rpc: "end_chore_definition", params: d => ({ p_definition_id: d.definitionId }), message: "Chore ended." });

const rotationValues = (f: FormData) => ({ householdId: f.get("householdId"), rotationId: optional(f.get("rotationId")) ?? undefined, name: f.get("name"), strategy: f.get("strategy"), startMembershipId: optional(f.get("startMembershipId")), membershipIds: jsonArray(f, "membershipIdsJson") });
export const createRotationAction = async (_p: ActionResult | null, f: FormData) => rpcAction({ formData: f, schema: rotationSchema, values: rotationValues, capability: "chore.manage_rotation", rpc: "create_chore_rotation", params: d => ({ p_household_id: d.householdId, p_name: d.name, p_strategy: d.strategy, p_start_membership_id: d.startMembershipId, p_membership_ids: d.membershipIds }), message: "Rotation created." });
export const updateRotationAction = async (_p: ActionResult | null, f: FormData): Promise<ActionResult> => {
  const first = await rpcAction({ formData: f, schema: rotationSchema, values: rotationValues, capability: "chore.manage_rotation", rpc: "update_chore_rotation", params: d => ({ p_rotation_id: d.rotationId, p_name: d.name, p_strategy: d.strategy, p_start_membership_id: d.startMembershipId }), message: "Rotation updated." });
  if (!first.ok) return first;
  return rpcAction({ formData: f, schema: rotationSchema, values: rotationValues, capability: "chore.manage_rotation", rpc: "update_chore_rotation_members", params: d => ({ p_rotation_id: d.rotationId, p_membership_ids: d.membershipIds }), message: "Rotation updated." });
};
const rotationStatusValues = (f: FormData) => ({ householdId: f.get("householdId"), rotationId: f.get("rotationId"), paused: f.has("paused") ? bool(f.get("paused")) : undefined, ended: f.has("ended") ? bool(f.get("ended")) : undefined });
export const updateRotationStatusAction = async (_p: ActionResult | null, f: FormData) => rpcAction({ formData: f, schema: rotationStatusSchema, values: rotationStatusValues, capability: "chore.manage_rotation", rpc: "update_chore_rotation", params: d => ({ p_rotation_id: d.rotationId, p_paused: d.paused, p_ended: d.ended }), message: "Rotation status updated." });
