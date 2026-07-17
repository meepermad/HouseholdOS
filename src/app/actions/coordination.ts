"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertActiveMembership } from "@/lib/household-context";
import { createClient } from "@/lib/supabase/server";
import { AppError, logServerError, toPublicErrorMessage } from "@/lib/errors";

const awaySchema = z.object({
  householdId: z.string().uuid(),
  startsAt: z.string().min(1),
  endsAt: z.string().min(1),
  note: z.string().max(500).optional(),
  unavailableForChores: z.coerce.boolean().optional(),
  excludeFromMealHeadcounts: z.coerce.boolean().optional(),
  stillParticipatesInExpenses: z.coerce.boolean().optional(),
  reduceNonurgentNotifications: z.coerce.boolean().optional(),
});

export async function setAwayStatusAction(
  _prev: unknown,
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const parsed = awaySchema.safeParse({
      householdId: formData.get("householdId"),
      startsAt: formData.get("startsAt"),
      endsAt: formData.get("endsAt"),
      note: formData.get("note") || undefined,
      unavailableForChores: formData.get("unavailableForChores") === "on",
      excludeFromMealHeadcounts:
        formData.get("excludeFromMealHeadcounts") === "on",
      stillParticipatesInExpenses:
        formData.get("stillParticipatesInExpenses") !== "off",
      reduceNonurgentNotifications:
        formData.get("reduceNonurgentNotifications") === "on",
    });
    if (!parsed.success) {
      return { ok: false, error: "Check the away dates and try again." };
    }
    const ctx = await assertActiveMembership(parsed.data.householdId);
    const supabase = await createClient();
    const { error } = await supabase.from("membership_away_status").insert({
      household_id: parsed.data.householdId,
      membership_id: ctx.membershipId,
      starts_at: new Date(parsed.data.startsAt).toISOString(),
      ends_at: new Date(parsed.data.endsAt).toISOString(),
      note: parsed.data.note ?? null,
      unavailable_for_chores: parsed.data.unavailableForChores ?? true,
      exclude_from_meal_headcounts:
        parsed.data.excludeFromMealHeadcounts ?? true,
      still_participates_in_expenses:
        parsed.data.stillParticipatesInExpenses ?? true,
      reduce_nonurgent_notifications:
        parsed.data.reduceNonurgentNotifications ?? true,
    });
    if (error) {
      logServerError("set_away_status", error, parsed.data);
      return { ok: false, error: "Unable to save away status." };
    }
    revalidatePath(`/app/${parsed.data.householdId}`);
    revalidatePath(`/app/${parsed.data.householdId}/chores`);
    return { ok: true };
  } catch (error) {
    if (error instanceof AppError) return { ok: false, error: error.publicMessage };
    return { ok: false, error: toPublicErrorMessage(error) };
  }
}

const guestSchema = z.object({
  householdId: z.string().uuid(),
  visitDate: z.string().min(1),
  startsAt: z.string().min(1),
  endsAt: z.string().min(1),
  overnight: z.coerce.boolean().optional(),
  guestCount: z.coerce.number().int().min(1).max(50),
  sharedSpaces: z.string().max(1000).optional(),
  parkingNeeded: z.coerce.boolean().optional(),
  mealParticipation: z.coerce.boolean().optional(),
  quietHoursException: z.coerce.boolean().optional(),
  note: z.string().max(2000).optional(),
  acknowledgmentRequested: z.coerce.boolean().optional(),
});

export async function createGuestNoticeAction(
  _prev: unknown,
  formData: FormData,
): Promise<{ ok: true; id?: string } | { ok: false; error: string }> {
  try {
    const parsed = guestSchema.safeParse({
      householdId: formData.get("householdId"),
      visitDate: formData.get("visitDate"),
      startsAt: formData.get("startsAt"),
      endsAt: formData.get("endsAt"),
      overnight: formData.get("overnight") === "on",
      guestCount: formData.get("guestCount"),
      sharedSpaces: formData.get("sharedSpaces") || undefined,
      parkingNeeded: formData.get("parkingNeeded") === "on",
      mealParticipation: formData.get("mealParticipation") === "on",
      quietHoursException: formData.get("quietHoursException") === "on",
      note: formData.get("note") || undefined,
      acknowledgmentRequested:
        formData.get("acknowledgmentRequested") === "on",
    });
    if (!parsed.success) {
      return { ok: false, error: "Check guest notice details and try again." };
    }
    const ctx = await assertActiveMembership(parsed.data.householdId);
    const supabase = await createClient();

    const starts = new Date(
      `${parsed.data.visitDate}T${parsed.data.startsAt}`,
    );
    const ends = new Date(`${parsed.data.visitDate}T${parsed.data.endsAt}`);
    if (parsed.data.overnight && ends <= starts) {
      ends.setDate(ends.getDate() + 1);
    }

    let calendarEventId: string | null = null;
    try {
      const { data: eventId } = await supabase.rpc("create_calendar_event", {
        p_household_id: parsed.data.householdId,
        p_title: `Guests (${parsed.data.guestCount})`,
        p_description: parsed.data.note ?? undefined,
        p_category: "guest_visit",
        p_visibility: "household",
        p_starts_at: starts.toISOString(),
        p_ends_at: ends.toISOString(),
        p_all_day: false,
        p_event_guest_count: parsed.data.guestCount,
        p_guest_label: "Guests",
      });
      if (typeof eventId === "string") calendarEventId = eventId;
    } catch (error) {
      logServerError("guest_notice_calendar", error, parsed.data);
    }

    const { data, error } = await supabase
      .from("guest_notices")
      .insert({
        household_id: parsed.data.householdId,
        host_membership_id: ctx.membershipId,
        calendar_event_id: calendarEventId,
        visit_date: parsed.data.visitDate,
        starts_at: starts.toISOString(),
        ends_at: ends.toISOString(),
        overnight: parsed.data.overnight ?? false,
        guest_count: parsed.data.guestCount,
        shared_spaces: parsed.data.sharedSpaces ?? null,
        parking_needed: parsed.data.parkingNeeded ?? false,
        meal_participation: parsed.data.mealParticipation ?? false,
        quiet_hours_exception: parsed.data.quietHoursException ?? false,
        note: parsed.data.note ?? null,
        acknowledgment_requested:
          parsed.data.acknowledgmentRequested ?? false,
      })
      .select("id")
      .maybeSingle();

    if (error) {
      logServerError("create_guest_notice", error, parsed.data);
      return { ok: false, error: "Unable to create guest notice." };
    }

    revalidatePath(`/app/${parsed.data.householdId}`);
    revalidatePath(`/app/${parsed.data.householdId}/calendar`);
    revalidatePath(`/app/${parsed.data.householdId}/guests`);
    return { ok: true, id: data?.id };
  } catch (error) {
    if (error instanceof AppError) return { ok: false, error: error.publicMessage };
    return { ok: false, error: toPublicErrorMessage(error) };
  }
}

const coverageSchema = z.object({
  householdId: z.string().uuid(),
  occurrenceId: z.string().uuid(),
  kind: z.enum([
    "swap_request",
    "offer",
    "cover",
    "temporary_unavailability",
  ]),
  offeredToMembershipId: z.string().uuid().optional(),
  note: z.string().max(2000).optional(),
});

export async function createCoverageOfferAction(
  _prev: unknown,
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const parsed = coverageSchema.safeParse({
      householdId: formData.get("householdId"),
      occurrenceId: formData.get("occurrenceId"),
      kind: formData.get("kind"),
      offeredToMembershipId:
        formData.get("offeredToMembershipId") || undefined,
      note: formData.get("note") || undefined,
    });
    if (!parsed.success) {
      return { ok: false, error: "Check coverage details and try again." };
    }
    const ctx = await assertActiveMembership(parsed.data.householdId);
    const supabase = await createClient();
    const { error } = await supabase.from("chore_coverage_offers").insert({
      household_id: parsed.data.householdId,
      occurrence_id: parsed.data.occurrenceId,
      offered_by_membership_id: ctx.membershipId,
      offered_to_membership_id: parsed.data.offeredToMembershipId ?? null,
      kind: parsed.data.kind,
      note: parsed.data.note ?? null,
    });
    if (error) {
      logServerError("create_coverage_offer", error, parsed.data);
      return { ok: false, error: "Unable to request coverage." };
    }
    revalidatePath(`/app/${parsed.data.householdId}/chores`);
    return { ok: true };
  } catch (error) {
    if (error instanceof AppError) return { ok: false, error: error.publicMessage };
    return { ok: false, error: toPublicErrorMessage(error) };
  }
}

export async function resolveCoverageOfferAction(
  _prev: unknown,
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const householdId = String(formData.get("householdId") ?? "");
    const offerId = String(formData.get("offerId") ?? "");
    const status = String(formData.get("status") ?? "");
    if (!householdId || !offerId || !["accepted", "declined"].includes(status)) {
      return { ok: false, error: "Invalid coverage response." };
    }
    const ctx = await assertActiveMembership(householdId);
    const supabase = await createClient();
    const { error } = await supabase
      .from("chore_coverage_offers")
      .update({
        status,
        resolved_by_membership_id: ctx.membershipId,
        resolved_at: new Date().toISOString(),
      })
      .eq("id", offerId)
      .eq("household_id", householdId)
      .eq("status", "pending");
    if (error) {
      logServerError("resolve_coverage_offer", error, { offerId });
      return { ok: false, error: "Unable to update coverage offer." };
    }
    revalidatePath(`/app/${householdId}/chores`);
    return { ok: true };
  } catch (error) {
    if (error instanceof AppError) return { ok: false, error: error.publicMessage };
    return { ok: false, error: toPublicErrorMessage(error) };
  }
}
