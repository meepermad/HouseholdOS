"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionResult } from "@/app/actions/auth";
import { assertActiveMembership } from "@/lib/household-context";
import { can, type Capability } from "@/lib/permissions";
import { toPublicErrorMessage } from "@/lib/errors";
import {
  assignMaintenanceSchema,
  commentMaintenanceSchema,
  createMaintenanceRequestSchema,
  createVendorSchema,
  maintenanceRequestIdSchema,
  resolveMaintenanceSchema,
  scheduleAppointmentSchema,
  waitingStatusSchema,
} from "@/lib/validations/maintenance";
import { SAFETY_HAZARD_FLAGS, type SafetyHazardFlag } from "@/lib/maintenance";
import {
  validateMaintenanceEvidence,
} from "@/lib/maintenance/evidence";
import { MAINTENANCE_EVIDENCE_BUCKET } from "@/lib/storage/signed-urls";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UntypedDb = any;
const str = (value: FormDataEntryValue | null) => String(value ?? "").trim();
const optional = (value: FormDataEntryValue | null) => str(value) || null;
const bool = (value: FormDataEntryValue | null) =>
  value === "true" || value === "on";

async function context(householdId: string, capability: Capability) {
  const ctx = await assertActiveMembership(householdId);
  if (!can(ctx.roles, capability)) {
    throw new Error("You are not allowed to perform this maintenance action.");
  }
  const { createClient } = await import("@/lib/supabase/server");
  return { ctx, supabase: (await createClient()) as UntypedDb };
}

function invalidate(householdId: string, requestId?: string) {
  revalidatePath(`/app/${householdId}/maintenance`);
  revalidatePath(`/app/${householdId}`);
  if (requestId) {
    revalidatePath(`/app/${householdId}/maintenance/${requestId}`);
    revalidatePath(`/app/${householdId}/maintenance/${requestId}/evidence`);
  }
}

function parseHazards(formData: FormData): SafetyHazardFlag[] {
  const raw = formData.getAll("hazardFlags").map(String);
  return raw.filter((h): h is SafetyHazardFlag =>
    (SAFETY_HAZARD_FLAGS as readonly string[]).includes(h),
  );
}

export async function createMaintenanceRequestAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const parsed = createMaintenanceRequestSchema.safeParse({
      householdId: str(formData.get("householdId")),
      title: str(formData.get("title")),
      description: optional(formData.get("description")),
      category: str(formData.get("category")) || "other",
      severity: str(formData.get("severity")) || "normal",
      visibility: str(formData.get("visibility")) || "household",
      locationId: optional(formData.get("locationId")),
      inventoryItemId: optional(formData.get("inventoryItemId")),
      firstNoticedAt: optional(formData.get("firstNoticedAt")),
      currentlyActive: bool(formData.get("currentlyActive") ?? "true"),
      stopUse: bool(formData.get("stopUse")),
      immediateMitigation: optional(formData.get("immediateMitigation")),
      hazardFlags: parseHazards(formData),
      suggestedCoordinatorMembershipId: optional(
        formData.get("suggestedCoordinatorMembershipId"),
      ),
      landlordInvolvement: bool(formData.get("landlordInvolvement")),
    });
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" };
    }
    const d = parsed.data;
    const { supabase } = await context(d.householdId, "maintenance.create");
    const { data, error } = await supabase.rpc("create_maintenance_request", {
      p_household_id: d.householdId,
      p_title: d.title,
      p_description: d.description,
      p_category: d.category,
      p_severity: d.severity,
      p_visibility: d.visibility,
      p_location_id: d.locationId,
      p_inventory_item_id: d.inventoryItemId,
      p_first_noticed_at: d.firstNoticedAt,
      p_currently_active: d.currentlyActive,
      p_stop_use: d.stopUse,
      p_immediate_mitigation: d.immediateMitigation,
      p_hazard_flags: d.hazardFlags,
      p_suggested_coordinator_membership_id: d.suggestedCoordinatorMembershipId,
      p_landlord_involvement: d.landlordInvolvement,
    });
    if (error) return { ok: false, error: error.message };
    invalidate(d.householdId, data);
    redirect(`/app/${d.householdId}/maintenance/${data}`);
  } catch (error) {
    if ((error as { digest?: string })?.digest?.startsWith("NEXT_REDIRECT")) {
      throw error;
    }
    return { ok: false, error: toPublicErrorMessage(error) };
  }
}

export async function assignMaintenanceAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const parsed = assignMaintenanceSchema.safeParse({
      householdId: str(formData.get("householdId")),
      requestId: str(formData.get("requestId")),
      membershipId: str(formData.get("membershipId")),
      isPrimary: bool(formData.get("isPrimary") ?? "true"),
    });
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" };
    }
    const d = parsed.data;
    const { supabase } = await context(d.householdId, "maintenance.manage_own");
    const { error } = await supabase.rpc("assign_maintenance_request", {
      p_request_id: d.requestId,
      p_membership_id: d.membershipId,
      p_is_primary: d.isPrimary,
    });
    if (error) return { ok: false, error: error.message };
    invalidate(d.householdId, d.requestId);
    return { ok: true, message: "Assigned." };
  } catch (error) {
    return { ok: false, error: toPublicErrorMessage(error) };
  }
}

export async function claimMaintenanceAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const parsed = maintenanceRequestIdSchema.safeParse({
      householdId: str(formData.get("householdId")),
      requestId: str(formData.get("requestId")),
    });
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" };
    }
    const d = parsed.data;
    const { supabase } = await context(d.householdId, "maintenance.manage_own");
    const { error } = await supabase.rpc("claim_maintenance_request", {
      p_request_id: d.requestId,
    });
    if (error) return { ok: false, error: error.message };
    invalidate(d.householdId, d.requestId);
    return { ok: true, message: "Claimed." };
  } catch (error) {
    return { ok: false, error: toPublicErrorMessage(error) };
  }
}

export async function addMaintenanceCommentAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const parsed = commentMaintenanceSchema.safeParse({
      householdId: str(formData.get("householdId")),
      requestId: str(formData.get("requestId")),
      body: str(formData.get("body")),
    });
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" };
    }
    const d = parsed.data;
    const { supabase } = await context(d.householdId, "maintenance.manage_own");
    const { error } = await supabase.rpc("add_maintenance_comment", {
      p_request_id: d.requestId,
      p_body: d.body,
    });
    if (error) return { ok: false, error: error.message };
    invalidate(d.householdId, d.requestId);
    return { ok: true, message: "Comment added." };
  } catch (error) {
    return { ok: false, error: toPublicErrorMessage(error) };
  }
}

export async function resolveMaintenanceAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const parsed = resolveMaintenanceSchema.safeParse({
      householdId: str(formData.get("householdId")),
      requestId: str(formData.get("requestId")),
      resolutionNotes: optional(formData.get("resolutionNotes")),
      decisionOutcome: optional(formData.get("decisionOutcome")),
    });
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" };
    }
    const d = parsed.data;
    const { supabase } = await context(d.householdId, "maintenance.manage_own");
    const { error } = await supabase.rpc("resolve_maintenance_request", {
      p_request_id: d.requestId,
      p_resolution_notes: d.resolutionNotes,
      p_decision_outcome: d.decisionOutcome,
    });
    if (error) return { ok: false, error: error.message };
    invalidate(d.householdId, d.requestId);
    return { ok: true, message: "Resolved." };
  } catch (error) {
    return { ok: false, error: toPublicErrorMessage(error) };
  }
}

export async function reopenMaintenanceAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const parsed = maintenanceRequestIdSchema.safeParse({
      householdId: str(formData.get("householdId")),
      requestId: str(formData.get("requestId")),
    });
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" };
    }
    const d = parsed.data;
    const { supabase } = await context(d.householdId, "maintenance.manage_own");
    const { error } = await supabase.rpc("reopen_maintenance_request", {
      p_request_id: d.requestId,
      p_note: optional(formData.get("note")),
    });
    if (error) return { ok: false, error: error.message };
    invalidate(d.householdId, d.requestId);
    return { ok: true, message: "Reopened." };
  } catch (error) {
    return { ok: false, error: toPublicErrorMessage(error) };
  }
}

export async function changeMaintenanceWaitingAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const parsed = waitingStatusSchema.safeParse({
      householdId: str(formData.get("householdId")),
      requestId: str(formData.get("requestId")),
      status: str(formData.get("status")),
    });
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" };
    }
    const d = parsed.data;
    const { supabase } = await context(d.householdId, "maintenance.manage_own");
    const { error } = await supabase.rpc("change_maintenance_waiting_status", {
      p_request_id: d.requestId,
      p_status: d.status,
    });
    if (error) return { ok: false, error: error.message };
    invalidate(d.householdId, d.requestId);
    return { ok: true, message: "Status updated." };
  } catch (error) {
    return { ok: false, error: toPublicErrorMessage(error) };
  }
}

export async function scheduleMaintenanceAppointmentAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const parsed = scheduleAppointmentSchema.safeParse({
      householdId: str(formData.get("householdId")),
      requestId: str(formData.get("requestId")),
      title: str(formData.get("title")),
      startsAt: str(formData.get("startsAt")),
      endsAt: str(formData.get("endsAt")),
      appointmentKind: str(formData.get("appointmentKind")) || "vendor_visit",
      location: optional(formData.get("location")),
    });
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" };
    }
    const d = parsed.data;
    const { supabase } = await context(d.householdId, "maintenance.manage_own");
    const { error } = await supabase.rpc("schedule_maintenance_appointment", {
      p_request_id: d.requestId,
      p_title: d.title,
      p_starts_at: d.startsAt,
      p_ends_at: d.endsAt,
      p_appointment_kind: d.appointmentKind,
      p_location: d.location,
    });
    if (error) return { ok: false, error: error.message };
    invalidate(d.householdId, d.requestId);
    return { ok: true, message: "Appointment scheduled." };
  } catch (error) {
    return { ok: false, error: toPublicErrorMessage(error) };
  }
}

export async function createMaintenanceVendorAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const parsed = createVendorSchema.safeParse({
      householdId: str(formData.get("householdId")),
      displayName: str(formData.get("displayName")),
      contactType: str(formData.get("contactType")) || "other",
      organization: optional(formData.get("organization")),
      phone: optional(formData.get("phone")),
      email: optional(formData.get("email")),
      notes: optional(formData.get("notes")),
    });
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" };
    }
    const d = parsed.data;
    const { supabase } = await context(d.householdId, "maintenance.create");
    const { data, error } = await supabase.rpc("create_maintenance_contact", {
      p_household_id: d.householdId,
      p_display_name: d.displayName,
      p_contact_type: d.contactType,
      p_organization: d.organization,
      p_phone: d.phone,
      p_email: d.email || null,
      p_notes: d.notes,
    });
    if (error) return { ok: false, error: error.message };
    revalidatePath(`/app/${d.householdId}/maintenance/vendors`);
    redirect(`/app/${d.householdId}/maintenance/vendors/${data}`);
  } catch (error) {
    if ((error as { digest?: string })?.digest?.startsWith("NEXT_REDIRECT")) {
      throw error;
    }
    return { ok: false, error: toPublicErrorMessage(error) };
  }
}

export async function uploadMaintenanceEvidenceAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const householdId = str(formData.get("householdId"));
    const requestId = str(formData.get("requestId"));
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return { ok: false, error: "Choose a file to upload" };
    }
    const { supabase } = await context(householdId, "maintenance.create");

    const { count } = await supabase
      .from("maintenance_attachments")
      .select("id", { count: "exact", head: true })
      .eq("request_id", requestId)
      .is("deleted_at", null);

    const validated = validateMaintenanceEvidence({
      mimeType: file.type,
      fileName: file.name,
      sizeBytes: file.size,
      existingCount: count ?? 0,
    });
    if (!validated.ok) return { ok: false, error: validated.error };

    const storagePath = `${householdId}/${requestId}/${crypto.randomUUID()}.${validated.extension}`;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const { error: uploadError } = await supabase.storage
      .from(MAINTENANCE_EVIDENCE_BUCKET)
      .upload(storagePath, bytes, {
        contentType: validated.mimeType,
        upsert: false,
      });
    if (uploadError) return { ok: false, error: uploadError.message };

    const { error } = await supabase.rpc("add_maintenance_attachment", {
      p_request_id: requestId,
      p_storage_path: storagePath,
      p_mime_type: validated.mimeType,
      p_file_name: file.name,
      p_size_bytes: file.size,
    });
    if (error) return { ok: false, error: error.message };
    invalidate(householdId, requestId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: toPublicErrorMessage(error) };
  }
}

export async function removeMaintenanceEvidenceAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const householdId = str(formData.get("householdId"));
    const requestId = str(formData.get("requestId"));
    const attachmentId = str(formData.get("attachmentId"));
    const { supabase } = await context(householdId, "maintenance.manage_own");
    const { error } = await supabase.rpc("remove_maintenance_attachment", {
      p_attachment_id: attachmentId,
    });
    if (error) return { ok: false, error: error.message };
    invalidate(householdId, requestId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: toPublicErrorMessage(error) };
  }
}
