"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/app/actions/auth";
import { assertActiveMembership } from "@/lib/household-context";
import { toPublicErrorMessage } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const uuid = z.string().uuid();

function opsPath(householdId: string) {
  return `/app/${householdId}/ops`;
}

export async function createSharedPurchaseAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const parsed = z
      .object({
        householdId: uuid,
        title: z.string().trim().min(1).max(200),
        description: z.string().max(2000).optional().nullable(),
        estimatedAmountCents: z.coerce.number().int().nonnegative().optional().nullable(),
      })
      .safeParse({
        householdId: formData.get("householdId"),
        title: formData.get("title"),
        description: formData.get("description") || null,
        estimatedAmountCents: formData.get("estimatedAmountCents") || null,
      });
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid proposal." };
    }
    const ctx = await assertActiveMembership(parsed.data.householdId);
    const supabase = await createClient();
    const { error } = await supabase.from("shared_purchase_proposals").insert({
      household_id: parsed.data.householdId,
      title: parsed.data.title,
      description: parsed.data.description,
      estimated_amount_cents: parsed.data.estimatedAmountCents,
      created_by_membership_id: ctx.membershipId,
    });
    if (error) return { ok: false, error: error.message };
    revalidatePath(opsPath(parsed.data.householdId));
    return { ok: true, message: "Shared purchase proposed." };
  } catch (e) {
    return { ok: false, error: toPublicErrorMessage(e) };
  }
}

export async function createMeetingNoteAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const parsed = z
      .object({
        householdId: uuid,
        title: z.string().trim().min(1).max(200),
        meetingAt: z.string().min(8),
        agenda: z.string().max(4000).optional().nullable(),
        outcomes: z.string().max(4000).optional().nullable(),
      })
      .safeParse({
        householdId: formData.get("householdId"),
        title: formData.get("title"),
        meetingAt: formData.get("meetingAt"),
        agenda: formData.get("agenda") || null,
        outcomes: formData.get("outcomes") || null,
      });
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid meeting." };
    }
    const ctx = await assertActiveMembership(parsed.data.householdId);
    const supabase = await createClient();
    const { error } = await supabase.from("household_meeting_notes").insert({
      household_id: parsed.data.householdId,
      title: parsed.data.title,
      meeting_at: parsed.data.meetingAt,
      agenda: parsed.data.agenda,
      outcomes: parsed.data.outcomes,
      created_by_membership_id: ctx.membershipId,
    });
    if (error) return { ok: false, error: error.message };
    revalidatePath(opsPath(parsed.data.householdId));
    return { ok: true, message: "Meeting note saved." };
  } catch (e) {
    return { ok: false, error: toPublicErrorMessage(e) };
  }
}

export async function createPackageAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const parsed = z
      .object({
        householdId: uuid,
        recipientMembershipId: uuid.optional().nullable(),
        carrier: z.string().max(80).optional().nullable(),
        locationNote: z.string().max(400).optional().nullable(),
      })
      .safeParse({
        householdId: formData.get("householdId"),
        recipientMembershipId: formData.get("recipientMembershipId") || null,
        carrier: formData.get("carrier") || null,
        locationNote: formData.get("locationNote") || null,
      });
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid package." };
    }
    const ctx = await assertActiveMembership(parsed.data.householdId);
    const supabase = await createClient();
    const { error } = await supabase.from("household_packages").insert({
      household_id: parsed.data.householdId,
      recipient_membership_id: parsed.data.recipientMembershipId,
      carrier: parsed.data.carrier,
      location_note: parsed.data.locationNote,
      created_by_membership_id: ctx.membershipId,
    });
    if (error) return { ok: false, error: error.message };
    revalidatePath(opsPath(parsed.data.householdId));
    return { ok: true, message: "Package logged." };
  } catch (e) {
    return { ok: false, error: toPublicErrorMessage(e) };
  }
}

export async function createDirectoryContactAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const parsed = z
      .object({
        householdId: uuid,
        name: z.string().trim().min(1).max(120),
        roleLabel: z.string().max(80).optional().nullable(),
        phone: z.string().max(40).optional().nullable(),
        email: z.string().email().optional().nullable().or(z.literal("")),
      })
      .safeParse({
        householdId: formData.get("householdId"),
        name: formData.get("name"),
        roleLabel: formData.get("roleLabel") || null,
        phone: formData.get("phone") || null,
        email: formData.get("email") || null,
      });
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid contact." };
    }
    const ctx = await assertActiveMembership(parsed.data.householdId);
    const supabase = await createClient();
    const { error } = await supabase.from("household_directory_contacts").insert({
      household_id: parsed.data.householdId,
      name: parsed.data.name,
      role_label: parsed.data.roleLabel,
      phone: parsed.data.phone,
      email: parsed.data.email || null,
      created_by_membership_id: ctx.membershipId,
    });
    if (error) return { ok: false, error: error.message };
    revalidatePath(opsPath(parsed.data.householdId));
    return { ok: true, message: "Contact added." };
  } catch (e) {
    return { ok: false, error: toPublicErrorMessage(e) };
  }
}
