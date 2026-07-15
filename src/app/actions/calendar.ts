"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import type { ActionResult } from "@/app/actions/auth";
import { toPublicErrorMessage } from "@/lib/errors";
import { assertActiveMembership } from "@/lib/household-context";
import { can } from "@/lib/permissions";
import { materializeEventOccurrences } from "@/lib/calendar/materialize";
import {
  buildFeedUrl,
  generateFeedToken,
  hashFeedToken,
} from "@/lib/calendar/feed-token";
import {
  cancelCalendarEventSchema,
  cancelOccurrenceSchema,
  createCalendarEventSchema,
  createFeedSchema,
  feedIdSchema,
  respondToCalendarEventSchema,
  updateCalendarEventSchema,
  updateOccurrenceSchema,
} from "@/lib/validations/calendar";

/**
 * Calendar tables/RPCs are not in the generated Database types yet, so calendar
 * writes go through an untyped client. Authorization is still enforced in the
 * SECURITY DEFINER RPCs and re-checked here via capabilities.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UntypedDb = any;

function db(client: unknown): UntypedDb {
  return client as UntypedDb;
}

function calendarPath(householdId: string, suffix = "") {
  return `/app/${householdId}/calendar${suffix}`;
}

function eventPath(householdId: string, eventId: string) {
  return calendarPath(householdId, `/events/${eventId}`);
}

function boolFromForm(value: FormDataEntryValue | null): boolean {
  return value === "on" || value === "true";
}

function str(value: FormDataEntryValue | null): string | null {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed === "" ? null : trimmed;
}

function optionalInt(value: FormDataEntryValue | null): number | null {
  const s = str(value);
  if (s == null) return null;
  const n = Number(s);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

/** Attendee membership ids come as a JSON array hidden field. */
function parseAttendees(formData: FormData): string[] {
  const raw = formData.get("attendeesJson");
  if (!raw || typeof raw !== "string" || raw.trim() === "") return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === "string");
  } catch {
    return [];
  }
}

/**
 * Reminder offsets arrive either as repeated `reminderOffset` checkbox values
 * or as a JSON array hidden field `remindersJson`.
 */
function parseReminderOffsets(formData: FormData): number[] {
  const jsonRaw = formData.get("remindersJson");
  if (typeof jsonRaw === "string" && jsonRaw.trim() !== "") {
    try {
      const parsed = JSON.parse(jsonRaw) as unknown;
      if (Array.isArray(parsed)) {
        return parsed
          .map((x) => Number(x))
          .filter((n) => Number.isFinite(n))
          .map((n) => Math.trunc(n));
      }
    } catch {
      // fall through to checkbox parsing
    }
  }
  return formData
    .getAll("reminderOffset")
    .map((v) => Number(v))
    .filter((n) => Number.isFinite(n))
    .map((n) => Math.trunc(n));
}

type MaterializeEventRow = {
  id: string;
  all_day: boolean;
  starts_at: string | null;
  ends_at: string | null;
  start_date: string | null;
  end_date_exclusive: string | null;
  time_zone: string;
  rrule: string | null;
  status: string;
};

/** Reload the master row and rebuild its bounded occurrence window. */
async function rematerialize(client: UntypedDb, eventId: string): Promise<void> {
  const { data } = await client
    .from("calendar_events")
    .select(
      "id, all_day, starts_at, ends_at, start_date, end_date_exclusive, time_zone, rrule, status",
    )
    .eq("id", eventId)
    .maybeSingle();
  if (!data) return;
  await materializeEventOccurrences({
    supabase: client,
    event: data as MaterializeEventRow,
  });
}

async function resolveOrigin(): Promise<string> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  return `${proto}://${host}`;
}

// ---------------------------------------------------------------------------
// createCalendarEventAction
// ---------------------------------------------------------------------------
export async function createCalendarEventAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  let redirectTarget: string | null = null;
  try {
    const allDay = boolFromForm(formData.get("allDay"));
    const parsed = createCalendarEventSchema.safeParse({
      householdId: formData.get("householdId"),
      title: formData.get("title"),
      description: str(formData.get("description")) ?? "",
      location: str(formData.get("location")) ?? "",
      category: formData.get("category"),
      visibility: formData.get("visibility"),
      allDay,
      startsAt: allDay ? null : str(formData.get("startsAt")),
      endsAt: allDay ? null : str(formData.get("endsAt")),
      startDate: allDay ? str(formData.get("startDate")) : null,
      endDateExclusive: allDay ? str(formData.get("endDateExclusive")) : null,
      timeZone: formData.get("timeZone"),
      rrule: str(formData.get("rrule")),
      recurrenceUntil: str(formData.get("recurrenceUntil")),
      recurrenceCount: optionalInt(formData.get("recurrenceCount")),
      eventGuestCount: optionalInt(formData.get("eventGuestCount")) ?? 0,
      guestLabel: str(formData.get("guestLabel")) ?? "",
      attendeeMembershipIds: parseAttendees(formData),
      reminderOffsetsMinutes: parseReminderOffsets(formData),
      clientIdempotencyKey:
        str(formData.get("clientIdempotencyKey")) ?? crypto.randomUUID(),
    });
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Invalid event details.",
      };
    }

    const ctx = await assertActiveMembership(parsed.data.householdId);
    if (!can(ctx.roles, "calendar.create")) {
      return { ok: false, error: "Not allowed to create calendar events." };
    }

    const { createClient } = await import("@/lib/supabase/server");
    const supabase = db(await createClient());

    const { data: eventId, error } = await supabase.rpc("create_calendar_event", {
      p_household_id: parsed.data.householdId,
      p_title: parsed.data.title,
      p_description: parsed.data.description || null,
      p_location: parsed.data.location || null,
      p_category: parsed.data.category,
      p_visibility: parsed.data.visibility,
      p_all_day: parsed.data.allDay,
      p_starts_at: parsed.data.startsAt ?? null,
      p_ends_at: parsed.data.endsAt ?? null,
      p_start_date: parsed.data.startDate ?? null,
      p_end_date_exclusive: parsed.data.endDateExclusive ?? null,
      p_time_zone: parsed.data.timeZone,
      p_rrule: parsed.data.rrule ?? null,
      p_recurrence_until: parsed.data.recurrenceUntil ?? null,
      p_recurrence_count: parsed.data.recurrenceCount ?? null,
      p_event_guest_count: parsed.data.eventGuestCount,
      p_guest_label: parsed.data.guestLabel || null,
      p_attendee_membership_ids: parsed.data.attendeeMembershipIds,
      p_reminder_offsets_minutes: parsed.data.reminderOffsetsMinutes,
      p_client_idempotency_key: parsed.data.clientIdempotencyKey,
    });

    if (error || !eventId) {
      return { ok: false, error: "Unable to create calendar event." };
    }

    const newEventId = String(eventId);
    await rematerialize(supabase, newEventId);

    revalidatePath(calendarPath(parsed.data.householdId));
    redirectTarget = eventPath(parsed.data.householdId, newEventId);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    return { ok: false, error: toPublicErrorMessage(error) };
  }
  redirect(redirectTarget);
}

// ---------------------------------------------------------------------------
// updateCalendarEventAction
// ---------------------------------------------------------------------------
export async function updateCalendarEventAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const allDay = boolFromForm(formData.get("allDay"));
    const parsed = updateCalendarEventSchema.safeParse({
      householdId: formData.get("householdId"),
      eventId: formData.get("eventId"),
      title: formData.get("title"),
      description: str(formData.get("description")) ?? "",
      location: str(formData.get("location")) ?? "",
      category: formData.get("category"),
      visibility: formData.get("visibility"),
      allDay,
      startsAt: allDay ? null : str(formData.get("startsAt")),
      endsAt: allDay ? null : str(formData.get("endsAt")),
      startDate: allDay ? str(formData.get("startDate")) : null,
      endDateExclusive: allDay ? str(formData.get("endDateExclusive")) : null,
      timeZone: formData.get("timeZone"),
      rrule: str(formData.get("rrule")),
      recurrenceUntil: str(formData.get("recurrenceUntil")),
      recurrenceCount: optionalInt(formData.get("recurrenceCount")),
      eventGuestCount: optionalInt(formData.get("eventGuestCount")) ?? 0,
      guestLabel: str(formData.get("guestLabel")) ?? "",
      attendeeMembershipIds: parseAttendees(formData),
      reminderOffsetsMinutes: parseReminderOffsets(formData),
      coordinatorOverride: boolFromForm(formData.get("coordinatorOverride")),
    });
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Invalid event details.",
      };
    }

    const ctx = await assertActiveMembership(parsed.data.householdId);
    if (!can(ctx.roles, "calendar.manage_own")) {
      return { ok: false, error: "Not allowed to edit calendar events." };
    }
    if (
      parsed.data.coordinatorOverride &&
      !can(ctx.roles, "calendar.coordinator_override")
    ) {
      return { ok: false, error: "Coordinator override is not permitted." };
    }

    const { createClient } = await import("@/lib/supabase/server");
    const supabase = db(await createClient());

    const { error } = await supabase.rpc("update_calendar_event", {
      p_event_id: parsed.data.eventId,
      p_title: parsed.data.title,
      p_description: parsed.data.description || null,
      p_location: parsed.data.location || null,
      p_category: parsed.data.category,
      p_visibility: parsed.data.visibility,
      p_all_day: parsed.data.allDay,
      p_starts_at: parsed.data.startsAt ?? null,
      p_ends_at: parsed.data.endsAt ?? null,
      p_start_date: parsed.data.startDate ?? null,
      p_end_date_exclusive: parsed.data.endDateExclusive ?? null,
      p_time_zone: parsed.data.timeZone,
      p_rrule: parsed.data.rrule ?? null,
      p_recurrence_until: parsed.data.recurrenceUntil ?? null,
      p_recurrence_count: parsed.data.recurrenceCount ?? null,
      p_event_guest_count: parsed.data.eventGuestCount,
      p_guest_label: parsed.data.guestLabel || null,
      p_attendee_membership_ids: parsed.data.attendeeMembershipIds,
      p_reminder_offsets_minutes: parsed.data.reminderOffsetsMinutes,
      p_coordinator_override: parsed.data.coordinatorOverride,
    });

    if (error) {
      const msg = error.message?.toLowerCase() ?? "";
      if (msg.includes("only the organizer")) {
        return { ok: false, error: "Only the organizer may edit this event." };
      }
      return { ok: false, error: "Unable to update calendar event." };
    }

    await rematerialize(supabase, parsed.data.eventId);

    revalidatePath(calendarPath(parsed.data.householdId));
    revalidatePath(eventPath(parsed.data.householdId, parsed.data.eventId));
    return { ok: true, message: "Event updated." };
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    return { ok: false, error: toPublicErrorMessage(error) };
  }
}

// ---------------------------------------------------------------------------
// cancelCalendarEventAction
// ---------------------------------------------------------------------------
export async function cancelCalendarEventAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const parsed = cancelCalendarEventSchema.safeParse({
      householdId: formData.get("householdId"),
      eventId: formData.get("eventId"),
      reason: str(formData.get("reason")) ?? "",
      coordinatorOverride: boolFromForm(formData.get("coordinatorOverride")),
    });
    if (!parsed.success) {
      return { ok: false, error: "Invalid cancellation request." };
    }

    const ctx = await assertActiveMembership(parsed.data.householdId);
    if (!can(ctx.roles, "calendar.manage_own")) {
      return { ok: false, error: "Not allowed to cancel calendar events." };
    }
    if (
      parsed.data.coordinatorOverride &&
      !can(ctx.roles, "calendar.coordinator_override")
    ) {
      return { ok: false, error: "Coordinator override is not permitted." };
    }

    const { createClient } = await import("@/lib/supabase/server");
    const supabase = db(await createClient());

    const { error } = await supabase.rpc("cancel_calendar_event", {
      p_event_id: parsed.data.eventId,
      p_reason: parsed.data.reason || null,
      p_coordinator_override: parsed.data.coordinatorOverride,
    });

    if (error) {
      const msg = error.message?.toLowerCase() ?? "";
      if (msg.includes("only the organizer")) {
        return { ok: false, error: "Only the organizer may cancel this event." };
      }
      return { ok: false, error: "Unable to cancel calendar event." };
    }

    revalidatePath(calendarPath(parsed.data.householdId));
    revalidatePath(eventPath(parsed.data.householdId, parsed.data.eventId));
    return { ok: true, message: "Event cancelled." };
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    return { ok: false, error: toPublicErrorMessage(error) };
  }
}

// ---------------------------------------------------------------------------
// respondToCalendarEventAction (RSVP)
// ---------------------------------------------------------------------------
export async function respondToCalendarEventAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const parsed = respondToCalendarEventSchema.safeParse({
      householdId: formData.get("householdId"),
      eventId: formData.get("eventId"),
      rsvpStatus: formData.get("rsvpStatus"),
      guestCount: optionalInt(formData.get("guestCount")) ?? 0,
      guestNote: str(formData.get("guestNote")) ?? "",
    });
    if (!parsed.success) {
      return { ok: false, error: "Invalid RSVP." };
    }

    const ctx = await assertActiveMembership(parsed.data.householdId);
    if (!can(ctx.roles, "calendar.respond")) {
      return { ok: false, error: "Not allowed to RSVP." };
    }

    const { createClient } = await import("@/lib/supabase/server");
    const supabase = db(await createClient());

    const { error } = await supabase.rpc("respond_to_calendar_event", {
      p_event_id: parsed.data.eventId,
      p_rsvp_status: parsed.data.rsvpStatus,
      p_guest_count: parsed.data.guestCount,
      p_guest_note: parsed.data.guestNote || null,
    });

    if (error) {
      const msg = error.message?.toLowerCase() ?? "";
      if (msg.includes("not an attendee")) {
        return { ok: false, error: "You are not an attendee of this event." };
      }
      if (msg.includes("cancelled")) {
        return { ok: false, error: "This event was cancelled." };
      }
      return { ok: false, error: "Unable to save your RSVP." };
    }

    revalidatePath(eventPath(parsed.data.householdId, parsed.data.eventId));
    return { ok: true, message: "RSVP saved." };
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    return { ok: false, error: toPublicErrorMessage(error) };
  }
}

// ---------------------------------------------------------------------------
// updateOccurrenceAction (single-instance override)
// ---------------------------------------------------------------------------
export async function updateOccurrenceAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const allDayRaw = formData.get("allDay");
    const parsed = updateOccurrenceSchema.safeParse({
      householdId: formData.get("householdId"),
      eventId: formData.get("eventId"),
      originalStartsAt: formData.get("originalStartsAt"),
      allDay: allDayRaw == null ? undefined : boolFromForm(allDayRaw),
      startsAt: str(formData.get("startsAt")),
      endsAt: str(formData.get("endsAt")),
      startDate: str(formData.get("startDate")),
      endDateExclusive: str(formData.get("endDateExclusive")),
      title: str(formData.get("title")) ?? undefined,
      description: str(formData.get("description")),
      location: str(formData.get("location")),
      eventGuestCount: optionalInt(formData.get("eventGuestCount")) ?? undefined,
      guestLabel: str(formData.get("guestLabel")),
    });
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Invalid occurrence update.",
      };
    }

    const ctx = await assertActiveMembership(parsed.data.householdId);
    if (!can(ctx.roles, "calendar.manage_own")) {
      return { ok: false, error: "Not allowed to edit occurrences." };
    }

    const { createClient } = await import("@/lib/supabase/server");
    const supabase = db(await createClient());

    const { error } = await supabase.rpc("update_calendar_occurrence", {
      p_event_id: parsed.data.eventId,
      p_original_starts_at: parsed.data.originalStartsAt,
      p_all_day: parsed.data.allDay ?? null,
      p_starts_at: parsed.data.startsAt ?? null,
      p_ends_at: parsed.data.endsAt ?? null,
      p_start_date: parsed.data.startDate ?? null,
      p_end_date_exclusive: parsed.data.endDateExclusive ?? null,
      p_title: parsed.data.title ?? null,
      p_description: parsed.data.description ?? null,
      p_location: parsed.data.location ?? null,
      p_event_guest_count: parsed.data.eventGuestCount ?? null,
      p_guest_label: parsed.data.guestLabel ?? null,
    });

    if (error) {
      const msg = error.message?.toLowerCase() ?? "";
      if (msg.includes("only the organizer")) {
        return { ok: false, error: "Only the organizer may edit an occurrence." };
      }
      return { ok: false, error: "Unable to update this occurrence." };
    }

    await rematerialize(supabase, parsed.data.eventId);

    revalidatePath(calendarPath(parsed.data.householdId));
    revalidatePath(eventPath(parsed.data.householdId, parsed.data.eventId));
    return { ok: true, message: "Occurrence updated." };
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    return { ok: false, error: toPublicErrorMessage(error) };
  }
}

// ---------------------------------------------------------------------------
// cancelOccurrenceAction (single-instance cancel)
// ---------------------------------------------------------------------------
export async function cancelOccurrenceAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const parsed = cancelOccurrenceSchema.safeParse({
      householdId: formData.get("householdId"),
      eventId: formData.get("eventId"),
      originalStartsAt: formData.get("originalStartsAt"),
      reason: str(formData.get("reason")) ?? "",
    });
    if (!parsed.success) {
      return { ok: false, error: "Invalid occurrence cancellation." };
    }

    const ctx = await assertActiveMembership(parsed.data.householdId);
    if (!can(ctx.roles, "calendar.manage_own")) {
      return { ok: false, error: "Not allowed to cancel occurrences." };
    }

    const { createClient } = await import("@/lib/supabase/server");
    const supabase = db(await createClient());

    const { error } = await supabase.rpc("cancel_calendar_occurrence", {
      p_event_id: parsed.data.eventId,
      p_original_starts_at: parsed.data.originalStartsAt,
      p_reason: parsed.data.reason || null,
    });

    if (error) {
      const msg = error.message?.toLowerCase() ?? "";
      if (msg.includes("only the organizer")) {
        return { ok: false, error: "Only the organizer may cancel an occurrence." };
      }
      return { ok: false, error: "Unable to cancel this occurrence." };
    }

    await rematerialize(supabase, parsed.data.eventId);

    revalidatePath(calendarPath(parsed.data.householdId));
    revalidatePath(eventPath(parsed.data.householdId, parsed.data.eventId));
    return { ok: true, message: "Occurrence cancelled." };
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    return { ok: false, error: toPublicErrorMessage(error) };
  }
}

// ---------------------------------------------------------------------------
// createCalendarFeedAction (returns raw feed URL exactly once)
// ---------------------------------------------------------------------------
export async function createCalendarFeedAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const parsed = createFeedSchema.safeParse({
      householdId: formData.get("householdId"),
      label: str(formData.get("label")) ?? undefined,
      scope: str(formData.get("scope")) ?? undefined,
    });
    if (!parsed.success) {
      return { ok: false, error: "Invalid feed request." };
    }

    await assertActiveMembership(parsed.data.householdId);

    const rawToken = generateFeedToken();
    const tokenHash = hashFeedToken(rawToken);

    const { createClient } = await import("@/lib/supabase/server");
    const supabase = db(await createClient());

    const { error } = await supabase.rpc("create_calendar_feed", {
      p_household_id: parsed.data.householdId,
      p_token_hash: tokenHash,
      p_label: parsed.data.label,
      p_scope: parsed.data.scope,
    });

    if (error) {
      return { ok: false, error: "Unable to create calendar feed." };
    }

    const feedUrl = buildFeedUrl({ origin: await resolveOrigin(), rawToken });

    revalidatePath(`/app/${parsed.data.householdId}/settings/calendar`);
    // The raw token is surfaced to the UI once and never logged or persisted.
    return {
      ok: true,
      message: "Feed created. Copy the URL now — it is shown only once.",
      data: { feedUrl, rawToken },
    };
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    return { ok: false, error: toPublicErrorMessage(error) };
  }
}

// ---------------------------------------------------------------------------
// revokeCalendarFeedAction
// ---------------------------------------------------------------------------
export async function revokeCalendarFeedAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const parsed = feedIdSchema.safeParse({
      householdId: formData.get("householdId"),
      feedId: formData.get("feedId"),
    });
    if (!parsed.success) {
      return { ok: false, error: "Invalid feed." };
    }

    await assertActiveMembership(parsed.data.householdId);

    const { createClient } = await import("@/lib/supabase/server");
    const supabase = db(await createClient());

    const { error } = await supabase.rpc("revoke_calendar_feed", {
      p_feed_id: parsed.data.feedId,
    });

    if (error) {
      return { ok: false, error: "Unable to revoke calendar feed." };
    }

    revalidatePath(`/app/${parsed.data.householdId}/settings/calendar`);
    return { ok: true, message: "Feed revoked." };
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    return { ok: false, error: toPublicErrorMessage(error) };
  }
}

// ---------------------------------------------------------------------------
// regenerateCalendarFeedAction (rotates the token; returns new URL once)
// ---------------------------------------------------------------------------
export async function regenerateCalendarFeedAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const parsed = feedIdSchema.safeParse({
      householdId: formData.get("householdId"),
      feedId: formData.get("feedId"),
    });
    if (!parsed.success) {
      return { ok: false, error: "Invalid feed." };
    }

    await assertActiveMembership(parsed.data.householdId);

    const rawToken = generateFeedToken();
    const tokenHash = hashFeedToken(rawToken);

    const { createClient } = await import("@/lib/supabase/server");
    const supabase = db(await createClient());

    const { error } = await supabase.rpc("regenerate_calendar_feed", {
      p_feed_id: parsed.data.feedId,
      p_new_token_hash: tokenHash,
    });

    if (error) {
      return { ok: false, error: "Unable to regenerate calendar feed." };
    }

    const feedUrl = buildFeedUrl({ origin: await resolveOrigin(), rawToken });

    revalidatePath(`/app/${parsed.data.householdId}/settings/calendar`);
    return {
      ok: true,
      message: "New feed URL generated. Copy it now — it is shown only once.",
      data: { feedUrl, rawToken },
    };
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    return { ok: false, error: toPublicErrorMessage(error) };
  }
}
