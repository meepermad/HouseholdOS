"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertActiveMembership } from "@/lib/household-context";
import { createClient } from "@/lib/supabase/server";
import { AppError, logServerError, toPublicErrorMessage } from "@/lib/errors";

const pollSchema = z.object({
  householdId: z.string().uuid(),
  question: z.string().trim().min(1).max(500),
  options: z.string().min(1),
  allowMultiple: z.coerce.boolean().optional(),
  anonymous: z.coerce.boolean().optional(),
  deadlineAt: z.string().optional(),
});

export async function createPollAction(
  _prev: unknown,
  formData: FormData,
): Promise<{ ok: true; id?: string } | { ok: false; error: string }> {
  try {
    const parsed = pollSchema.safeParse({
      householdId: formData.get("householdId"),
      question: formData.get("question"),
      options: formData.get("options"),
      allowMultiple: formData.get("allowMultiple") === "on",
      anonymous: formData.get("anonymous") === "on",
      deadlineAt: formData.get("deadlineAt") || undefined,
    });
    if (!parsed.success) {
      return { ok: false, error: "Check the poll question and options." };
    }
    const optionLabels = parsed.data.options
      .split("\n")
      .map((o) => o.trim())
      .filter(Boolean)
      .slice(0, 12);
    if (optionLabels.length < 2) {
      return { ok: false, error: "Add at least two options (one per line)." };
    }
    const ctx = await assertActiveMembership(parsed.data.householdId);
    const supabase = await createClient();
    const { data: poll, error } = await supabase
      .from("household_polls")
      .insert({
        household_id: parsed.data.householdId,
        created_by_membership_id: ctx.membershipId,
        question: parsed.data.question,
        allow_multiple: parsed.data.allowMultiple ?? false,
        anonymous: parsed.data.anonymous ?? false,
        deadline_at: parsed.data.deadlineAt
          ? new Date(parsed.data.deadlineAt).toISOString()
          : null,
      })
      .select("id")
      .maybeSingle();
    if (error || !poll) {
      logServerError("create_poll", error, parsed.data);
      return { ok: false, error: "Unable to create poll." };
    }
    const { error: optError } = await supabase.from("household_poll_options").insert(
      optionLabels.map((label, sort_order) => ({
        poll_id: poll.id,
        household_id: parsed.data.householdId,
        label,
        sort_order,
      })),
    );
    if (optError) {
      logServerError("create_poll_options", optError, { pollId: poll.id });
      return { ok: false, error: "Poll created but options failed." };
    }
    revalidatePath(`/app/${parsed.data.householdId}/polls`);
    return { ok: true, id: poll.id };
  } catch (error) {
    if (error instanceof AppError) return { ok: false, error: error.publicMessage };
    return { ok: false, error: toPublicErrorMessage(error) };
  }
}

export async function votePollAction(
  _prev: unknown,
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const householdId = String(formData.get("householdId") ?? "");
    const pollId = String(formData.get("pollId") ?? "");
    const optionIds = formData.getAll("optionId").map(String).filter(Boolean);
    if (!householdId || !pollId || optionIds.length === 0) {
      return { ok: false, error: "Select at least one option." };
    }
    const ctx = await assertActiveMembership(householdId);
    const supabase = await createClient();
    const { error } = await supabase.from("household_poll_votes").insert(
      optionIds.map((option_id) => ({
        poll_id: pollId,
        option_id,
        household_id: householdId,
        membership_id: ctx.membershipId,
      })),
    );
    if (error) {
      logServerError("vote_poll", error, { pollId });
      return { ok: false, error: "Unable to record vote." };
    }
    revalidatePath(`/app/${householdId}/polls/${pollId}`);
    return { ok: true };
  } catch (error) {
    if (error instanceof AppError) return { ok: false, error: error.publicMessage };
    return { ok: false, error: toPublicErrorMessage(error) };
  }
}

const utilitySchema = z.object({
  householdId: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  category: z.enum([
    "rent",
    "electricity",
    "internet",
    "water",
    "subscription",
    "other",
  ]),
  dueDayOfMonth: z.coerce.number().int().min(1).max(28).optional(),
  estimatedAmountCents: z.coerce.number().int().min(0).optional(),
});

export async function createUtilityAction(
  _prev: unknown,
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const parsed = utilitySchema.safeParse({
      householdId: formData.get("householdId"),
      name: formData.get("name"),
      category: formData.get("category"),
      dueDayOfMonth: formData.get("dueDayOfMonth") || undefined,
      estimatedAmountCents: formData.get("estimatedAmountCents") || undefined,
    });
    if (!parsed.success) {
      return { ok: false, error: "Check utility details." };
    }
    await assertActiveMembership(parsed.data.householdId);
    const supabase = await createClient();
    const { error } = await supabase.from("household_utilities").insert({
      household_id: parsed.data.householdId,
      name: parsed.data.name,
      category: parsed.data.category,
      due_day_of_month: parsed.data.dueDayOfMonth ?? null,
      estimated_amount_cents: parsed.data.estimatedAmountCents ?? null,
    });
    if (error) {
      logServerError("create_utility", error, parsed.data);
      return { ok: false, error: "Unable to add utility." };
    }
    revalidatePath(`/app/${parsed.data.householdId}/utilities`);
    return { ok: true };
  } catch (error) {
    if (error instanceof AppError) return { ok: false, error: error.publicMessage };
    return { ok: false, error: toPublicErrorMessage(error) };
  }
}

export async function upsertEmergencyCardAction(
  _prev: unknown,
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const householdId = String(formData.get("householdId") ?? "");
    const ctx = await assertActiveMembership(householdId);
    if (!ctx.roles.includes("household_coordinator")) {
      return { ok: false, error: "Only coordinators can edit the emergency card." };
    }
    const supabase = await createClient();
    const row = {
      household_id: householdId,
      property_address: String(formData.get("propertyAddress") ?? "") || null,
      landlord_contact: String(formData.get("landlordContact") ?? "") || null,
      emergency_maintenance_number:
        String(formData.get("emergencyMaintenanceNumber") ?? "") || null,
      utility_emergency_contacts:
        String(formData.get("utilityEmergencyContacts") ?? "") || null,
      water_shutoff_location:
        String(formData.get("waterShutoffLocation") ?? "") || null,
      breaker_panel_location:
        String(formData.get("breakerPanelLocation") ?? "") || null,
      fire_extinguisher_locations:
        String(formData.get("fireExtinguisherLocations") ?? "") || null,
      emergency_meeting_point:
        String(formData.get("emergencyMeetingPoint") ?? "") || null,
      wifi_details_protected:
        String(formData.get("wifiDetailsProtected") ?? "") || null,
      pet_instructions: String(formData.get("petInstructions") ?? "") || null,
      other_notes: String(formData.get("otherNotes") ?? "") || null,
      visibility: String(formData.get("visibility") ?? "members"),
      updated_by_membership_id: ctx.membershipId,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase
      .from("household_emergency_cards")
      .upsert(row, { onConflict: "household_id" });
    if (error) {
      logServerError("upsert_emergency_card", error, { householdId });
      return { ok: false, error: "Unable to save emergency card." };
    }
    revalidatePath(`/app/${householdId}/emergency`);
    return { ok: true };
  } catch (error) {
    if (error instanceof AppError) return { ok: false, error: error.publicMessage };
    return { ok: false, error: toPublicErrorMessage(error) };
  }
}
