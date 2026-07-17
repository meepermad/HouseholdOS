"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionResult } from "@/app/actions/auth";
import { assertActiveMembership } from "@/lib/household-context";
import { can, type Capability } from "@/lib/permissions";
import { toPublicErrorMessage } from "@/lib/errors";
import {
  acknowledgeGovernanceSchema,
  activateGovernanceSchema,
  completeTransitionTaskSchema,
  createGovernanceDocumentSchema,
  createTransitionSchema,
  proposeGovernanceSchema,
  respondApprovalSchema,
  saveGovernanceDraftSchema,
} from "@/lib/validations/governance";
import type { GovernanceSectionInput } from "@/lib/governance/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UntypedDb = any;
const str = (value: FormDataEntryValue | null) => String(value ?? "").trim();
const optional = (value: FormDataEntryValue | null) => str(value) || null;
const bool = (value: FormDataEntryValue | null) =>
  value === "true" || value === "on";

async function context(householdId: string, capability: Capability) {
  const ctx = await assertActiveMembership(householdId);
  if (!can(ctx.roles, capability)) {
    throw new Error("You are not allowed to perform this governance action.");
  }
  const { createClient } = await import("@/lib/supabase/server");
  return { ctx, supabase: (await createClient()) as UntypedDb };
}

function invalidate(householdId: string, documentId?: string, workflowId?: string) {
  revalidatePath(`/app/${householdId}/governance`);
  revalidatePath(`/app/${householdId}`);
  if (documentId) {
    revalidatePath(`/app/${householdId}/governance/documents/${documentId}`);
  }
  if (workflowId) {
    revalidatePath(`/app/${householdId}/governance/transitions/${workflowId}`);
  }
}

function parseSections(raw: string | null): GovernanceSectionInput[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as GovernanceSectionInput[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function createGovernanceDocumentAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const parsed = createGovernanceDocumentSchema.safeParse({
      householdId: str(formData.get("householdId")),
      documentClass: str(formData.get("documentClass")) || "custom",
      title: str(formData.get("title")),
      summary: optional(formData.get("summary")),
      visibility: str(formData.get("visibility")) || "private_draft",
      isFinancial: bool(formData.get("isFinancial")),
      sections: parseSections(str(formData.get("sectionsJson")) || null),
      templateId: optional(formData.get("templateId")),
    });
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" };
    }
    const d = parsed.data;
    const { supabase } = await context(d.householdId, "governance.create");
    const { data, error } = await supabase.rpc("create_governance_document", {
      p_household_id: d.householdId,
      p_document_class: d.documentClass,
      p_title: d.title,
      p_summary: d.summary ?? null,
      p_visibility: d.visibility,
      p_is_financial: d.isFinancial ?? false,
      p_sections: d.sections,
      p_template_id: d.templateId ?? null,
    });
    if (error) throw error;
    invalidate(d.householdId, data as string);
    redirect(`/app/${d.householdId}/governance/documents/${data}/edit`);
  } catch (e) {
    if (typeof e === "object" && e && "digest" in e) throw e;
    return { ok: false, error: toPublicErrorMessage(e) };
  }
}

export async function instantiateTemplateAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const householdId = str(formData.get("householdId"));
    const templateId = str(formData.get("templateId"));
    const title = optional(formData.get("title"));
    const { supabase } = await context(householdId, "governance.create");
    const { data, error } = await supabase.rpc("instantiate_governance_template", {
      p_household_id: householdId,
      p_template_id: templateId,
      p_title: title,
      p_visibility: "private_draft",
    });
    if (error) throw error;
    invalidate(householdId, data as string);
    redirect(`/app/${householdId}/governance/documents/${data}/edit`);
  } catch (e) {
    if (typeof e === "object" && e && "digest" in e) throw e;
    return { ok: false, error: toPublicErrorMessage(e) };
  }
}

export async function saveGovernanceDraftAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const parsed = saveGovernanceDraftSchema.safeParse({
      documentId: str(formData.get("documentId")),
      householdId: str(formData.get("householdId")),
      title: optional(formData.get("title")) ?? undefined,
      summary: optional(formData.get("summary")),
      visibility: optional(formData.get("visibility")) ?? undefined,
      sections: parseSections(str(formData.get("sectionsJson")) || null),
      changeSummary: optional(formData.get("changeSummary")),
      createNewVersion: bool(formData.get("createNewVersion")),
    });
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" };
    }
    const d = parsed.data;
    const { supabase } = await context(d.householdId, "governance.edit_own_draft");
    const { error } = await supabase.rpc("save_governance_draft", {
      p_document_id: d.documentId,
      p_title: d.title ?? null,
      p_summary: d.summary ?? null,
      p_visibility: d.visibility ?? null,
      p_sections: d.sections ?? null,
      p_change_summary: d.changeSummary ?? null,
      p_create_new_version: d.createNewVersion ?? false,
    });
    if (error) throw error;
    invalidate(d.householdId, d.documentId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: toPublicErrorMessage(e) };
  }
}

export async function proposeGovernanceAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const parsed = proposeGovernanceSchema.safeParse({
      documentId: str(formData.get("documentId")),
      householdId: str(formData.get("householdId")),
      versionId: optional(formData.get("versionId")),
    });
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" };
    }
    const d = parsed.data;
    const { supabase } = await context(d.householdId, "governance.propose");
    const { error } = await supabase.rpc("propose_governance_version", {
      p_document_id: d.documentId,
      p_version_id: d.versionId ?? null,
    });
    if (error) throw error;
    invalidate(d.householdId, d.documentId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: toPublicErrorMessage(e) };
  }
}

export async function respondApprovalAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const parsed = respondApprovalSchema.safeParse({
      requestId: str(formData.get("requestId")),
      householdId: str(formData.get("householdId")),
      decision: str(formData.get("decision")),
      comment: optional(formData.get("comment")),
    });
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" };
    }
    const d = parsed.data;
    const { supabase } = await context(d.householdId, "governance.approve");
    const { error } = await supabase.rpc("respond_to_governance_approval", {
      p_request_id: d.requestId,
      p_decision: d.decision,
      p_comment: d.comment ?? null,
    });
    if (error) throw error;
    invalidate(d.householdId);
    revalidatePath(`/app/${d.householdId}/governance/approvals`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: toPublicErrorMessage(e) };
  }
}

export async function activateGovernanceAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const parsed = activateGovernanceSchema.safeParse({
      documentId: str(formData.get("documentId")),
      householdId: str(formData.get("householdId")),
      versionId: optional(formData.get("versionId")),
      effectiveAt: optional(formData.get("effectiveAt")),
    });
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" };
    }
    const d = parsed.data;
    const { supabase } = await context(d.householdId, "governance.activate");
    const { error } = await supabase.rpc("activate_governance_version", {
      p_document_id: d.documentId,
      p_version_id: d.versionId ?? null,
      p_effective_at: d.effectiveAt ?? null,
    });
    if (error) throw error;
    invalidate(d.householdId, d.documentId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: toPublicErrorMessage(e) };
  }
}

export async function acknowledgeGovernanceAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const parsed = acknowledgeGovernanceSchema.safeParse({
      versionId: str(formData.get("versionId")),
      householdId: str(formData.get("householdId")),
      comment: optional(formData.get("comment")),
    });
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" };
    }
    const d = parsed.data;
    const { supabase } = await context(d.householdId, "governance.view");
    const { error } = await supabase.rpc("acknowledge_governance_version", {
      p_version_id: d.versionId,
      p_comment: d.comment ?? null,
    });
    if (error) throw error;
    invalidate(d.householdId);
    revalidatePath(`/app/${d.householdId}/governance/acknowledgments`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: toPublicErrorMessage(e) };
  }
}

export async function createTransitionAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const parsed = createTransitionSchema.safeParse({
      householdId: str(formData.get("householdId")),
      workflowType: str(formData.get("workflowType")),
      subjectMembershipId: str(formData.get("subjectMembershipId")),
      plannedDate: optional(formData.get("plannedDate")),
      noticeDate: optional(formData.get("noticeDate")),
      roomAssignment: optional(formData.get("roomAssignment")),
    });
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" };
    }
    const d = parsed.data;
    const { supabase } = await context(
      d.householdId,
      "governance.manage_transitions",
    );
    const { data, error } = await supabase.rpc("create_household_transition", {
      p_household_id: d.householdId,
      p_workflow_type: d.workflowType,
      p_subject_membership_id: d.subjectMembershipId,
      p_planned_date: d.plannedDate ?? null,
      p_notice_date: d.noticeDate ?? null,
      p_room_assignment: d.roomAssignment ?? null,
    });
    if (error) throw error;
    invalidate(d.householdId, undefined, data as string);
    redirect(`/app/${d.householdId}/governance/transitions/${data}`);
  } catch (e) {
    if (typeof e === "object" && e && "digest" in e) throw e;
    return { ok: false, error: toPublicErrorMessage(e) };
  }
}

export async function completeTransitionTaskAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const parsed = completeTransitionTaskSchema.safeParse({
      taskId: str(formData.get("taskId")),
      householdId: str(formData.get("householdId")),
      note: optional(formData.get("note")),
    });
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" };
    }
    const d = parsed.data;
    const { supabase } = await context(d.householdId, "governance.view");
    const { error } = await supabase.rpc("complete_household_transition_task", {
      p_task_id: d.taskId,
      p_note: d.note ?? null,
    });
    if (error) throw error;
    invalidate(d.householdId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: toPublicErrorMessage(e) };
  }
}

export async function advanceTransitionAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const householdId = str(formData.get("householdId"));
    const workflowId = str(formData.get("workflowId"));
    const nextStatus = str(formData.get("nextStatus"));
    const notes = optional(formData.get("notes"));
    const { supabase } = await context(
      householdId,
      "governance.manage_transitions",
    );
    const { error } = await supabase.rpc("advance_household_transition", {
      p_workflow_id: workflowId,
      p_next_status: nextStatus,
      p_notes: notes,
    });
    if (error) throw error;
    invalidate(householdId, undefined, workflowId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: toPublicErrorMessage(e) };
  }
}

export async function completeTransitionAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const householdId = str(formData.get("householdId"));
    const workflowId = str(formData.get("workflowId"));
    const notes = optional(formData.get("notes"));
    const scheduleRemoval = bool(formData.get("scheduleMembershipRemoval"));
    const { supabase } = await context(
      householdId,
      "governance.manage_transitions",
    );
    const { error } = await supabase.rpc("complete_household_transition", {
      p_workflow_id: workflowId,
      p_notes: notes,
      p_schedule_membership_removal: scheduleRemoval,
      p_removal_at: null,
    });
    if (error) throw error;
    invalidate(householdId, undefined, workflowId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: toPublicErrorMessage(e) };
  }
}

export async function overrideGovernanceApprovalAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const householdId = str(formData.get("householdId"));
    const requestId = str(formData.get("requestId"));
    const reason = str(formData.get("reason"));
    const activate = bool(formData.get("activate"));
    const { supabase } = await context(
      householdId,
      "governance.coordinator_override",
    );
    const { error } = await supabase.rpc("override_governance_approval", {
      p_request_id: requestId,
      p_reason: reason,
      p_activate: activate,
    });
    if (error) throw error;
    invalidate(householdId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: toPublicErrorMessage(e) };
  }
}
