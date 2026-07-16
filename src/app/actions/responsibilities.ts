"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/app/actions/auth";
import { assertActiveMembership } from "@/lib/household-context";
import { can } from "@/lib/permissions";
import type { Capability } from "@/lib/permissions";
import { toPublicErrorMessage } from "@/lib/errors";
import {
  assignResponsibilitySchema,
  requestResponsibilityTransferSchema,
  resolveResponsibilityTransferSchema,
  responsibilityAreaSchema,
} from "@/lib/validations/chores";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UntypedDb = any;
const str = (value: FormDataEntryValue | null) => String(value ?? "").trim();

async function run(
  householdId: string,
  rpc: string,
  params: Record<string, unknown>,
  message: string,
  capability: Capability = "responsibility.manage",
): Promise<ActionResult> {
  try {
    const ctx = await assertActiveMembership(householdId);
    if (!can(ctx.roles, capability)) {
      return { ok: false, error: "You are not allowed to manage this responsibility." };
    }
    const { createClient } = await import("@/lib/supabase/server");
    const { error } = await ((await createClient()) as UntypedDb).rpc(rpc, params);
    if (error) return { ok: false, error: error.message };
    revalidatePath(`/app/${householdId}/responsibilities`);
    revalidatePath(`/app/${householdId}`);
    return { ok: true, message };
  } catch (error) {
    return { ok: false, error: toPublicErrorMessage(error) };
  }
}

export async function createResponsibilityAreaAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = responsibilityAreaSchema.safeParse({
    householdId: formData.get("householdId"),
    name: formData.get("name"),
    description: str(formData.get("description")),
    category: formData.get("category"),
    startDate: formData.get("startDate"),
    handoffExpectations: str(formData.get("handoffExpectations")),
    ownerMembershipId: str(formData.get("ownerMembershipId")) || null,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid responsibility." };
  const result = await run(parsed.data.householdId, "create_responsibility_area", {
    p_household_id: parsed.data.householdId,
    p_name: parsed.data.name,
    p_category: parsed.data.category,
    p_start_date: parsed.data.startDate,
    p_description: parsed.data.description || null,
    p_handoff_expectations: parsed.data.handoffExpectations || null,
  }, "Responsibility created.");
  return result;
}

export async function assignResponsibilityAreaAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = assignResponsibilitySchema.safeParse({
    householdId: formData.get("householdId"),
    areaId: formData.get("areaId"),
    membershipId: formData.get("membershipId"),
    role: formData.get("role"),
  });
  if (!parsed.success) return { ok: false, error: "Invalid responsibility assignment." };
  return run(parsed.data.householdId, "assign_responsibility_area", {
    p_area_id: parsed.data.areaId,
    p_membership_id: parsed.data.membershipId,
    p_role: parsed.data.role,
  }, "Responsibility assigned.");
}

export async function requestResponsibilityTransferAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = requestResponsibilityTransferSchema.safeParse({
    householdId: formData.get("householdId"),
    areaId: formData.get("areaId"),
    toMembershipId: formData.get("toMembershipId"),
    note: str(formData.get("note")),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid transfer." };
  return run(parsed.data.householdId, "request_responsibility_transfer", {
    p_area_id: parsed.data.areaId,
    p_to_membership_id: parsed.data.toMembershipId,
    p_note: parsed.data.note || null,
  }, "Transfer requested.", "chore.manage_own");
}

async function resolve(formData: FormData, rpc: string, message: string) {
  const parsed = resolveResponsibilityTransferSchema.safeParse({
    householdId: formData.get("householdId"),
    transferId: formData.get("transferId"),
  });
  if (!parsed.success) return { ok: false, error: "Invalid transfer." } satisfies ActionResult;
  return run(parsed.data.householdId, rpc, { p_transfer_id: parsed.data.transferId }, message, "chore.manage_own");
}

export const acceptResponsibilityTransferAction = async (_p: ActionResult | null, f: FormData) =>
  resolve(f, "accept_responsibility_transfer", "Responsibility accepted.");
export const declineResponsibilityTransferAction = async (_p: ActionResult | null, f: FormData) =>
  resolve(f, "decline_responsibility_transfer", "Transfer declined.");
