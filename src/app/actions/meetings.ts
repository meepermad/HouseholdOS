"use server";

import { revalidatePath } from "next/cache";
import { assertActiveMembership } from "@/lib/household-context";
import { materializeEventOccurrences } from "@/lib/calendar/materialize";
import {
  buildPersonalMeetingAddendum,
  buildSharedMeetingPacket,
  serializeSharedPacketForLock,
} from "@/lib/meetings/packet";
import { meetingRpc, meetingTable } from "@/lib/meetings/client";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/app/actions/auth";

function fail(error: string): ActionResult {
  return { ok: false, error };
}

export async function ensureMonthlyMeetingAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const householdId = String(formData.get("householdId") ?? "");
  const periodStart = String(formData.get("periodStart") ?? "");
  const periodEnd = String(formData.get("periodEnd") ?? "");
  const meetingAt = String(formData.get("meetingAt") ?? "") || null;
  const idempotencyKey = String(formData.get("idempotencyKey") ?? "") || null;
  if (!householdId || !periodStart || !periodEnd) {
    return fail("Household and review period are required.");
  }
  await assertActiveMembership(householdId);
  const { data, error } = await meetingRpc("ensure_monthly_meeting", {
    p_household_id: householdId,
    p_period_start: periodStart,
    p_period_end: periodEnd,
    p_meeting_at: meetingAt,
    p_timezone: "America/Chicago",
    p_idempotency_key: idempotencyKey,
  });
  if (error) return fail(error.message);
  revalidatePath(`/app/${householdId}/meetings`);
  return { ok: true, data: { meetingId: String(data) } };
}

export async function gatherMeetingPreviewAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const householdId = String(formData.get("householdId") ?? "");
  const meetingId = String(formData.get("meetingId") ?? "");
  if (!householdId || !meetingId) return fail("Missing meeting.");
  const ctx = await assertActiveMembership(householdId);
  const meetings = await meetingTable("household_meetings");
  const { data: meeting, error } = await meetings
    .select("id, period_start, period_end, status")
    .eq("id", meetingId)
    .eq("household_id", householdId)
    .maybeSingle();
  if (error || !meeting) return fail(error?.message ?? "Meeting not found.");

  const packet = await buildSharedMeetingPacket({
    householdId,
    membershipId: ctx.membershipId,
    period: {
      start: String(meeting.period_start),
      end: String(meeting.period_end),
      label: `${meeting.period_start} – ${meeting.period_end}`,
    },
  });

  for (const item of packet.suggestedAgenda) {
    await meetingRpc("add_meeting_agenda_item", {
      p_meeting_id: meetingId,
      p_section_key: item.sectionKey,
      p_title: item.title,
      p_why_included: item.whyIncluded,
      p_source: "suggested",
      p_source_entity_type: item.sourceEntityType,
      p_source_entity_id: item.sourceEntityId,
    });
  }

  await meetingRpc("set_meeting_status_preparing", { p_meeting_id: meetingId });
  revalidatePath(`/app/${householdId}/meetings/${meetingId}`);
  return {
    ok: true,
    data: {
      warnings: String(packet.warnings.length),
      fetchedAt: packet.fetchedAt,
    },
  };
}

export async function lockMeetingPacketAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const householdId = String(formData.get("householdId") ?? "");
  const meetingId = String(formData.get("meetingId") ?? "");
  if (!householdId || !meetingId) return fail("Missing meeting.");
  const ctx = await assertActiveMembership(householdId);
  const meetings = await meetingTable("household_meetings");
  const { data: meeting } = await meetings
    .select("period_start, period_end")
    .eq("id", meetingId)
    .eq("household_id", householdId)
    .maybeSingle();
  if (!meeting) return fail("Meeting not found.");

  const shared = await buildSharedMeetingPacket({
    householdId,
    membershipId: ctx.membershipId,
    period: {
      start: String(meeting.period_start),
      end: String(meeting.period_end),
      label: `${meeting.period_start} – ${meeting.period_end}`,
    },
  });
  const personal = await buildPersonalMeetingAddendum({
    householdId,
    membershipId: ctx.membershipId,
  });

  const { data: versionId, error } = await meetingRpc("lock_meeting_packet", {
    p_meeting_id: meetingId,
    p_shared_payload: serializeSharedPacketForLock(shared),
    p_source_freshness: { fetchedAt: shared.fetchedAt, warnings: shared.warnings },
    p_idempotency_key: null,
  });
  if (error) return fail(error.message);
  if (!versionId) return fail("Lock did not return a packet version.");

  await meetingRpc("save_personal_meeting_addendum", {
    p_meeting_id: meetingId,
    p_packet_version_id: versionId,
    p_payload: personal,
    p_source_freshness: { fetchedAt: personal.fetchedAt },
  });

  revalidatePath(`/app/${householdId}/meetings/${meetingId}`);
  return { ok: true, data: { versionId: String(versionId) } };
}

export async function startMeetingAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const householdId = String(formData.get("householdId") ?? "");
  const meetingId = String(formData.get("meetingId") ?? "");
  await assertActiveMembership(householdId);
  const { error } = await meetingRpc("start_meeting", { p_meeting_id: meetingId });
  if (error) return fail(error.message);
  revalidatePath(`/app/${householdId}/meetings/${meetingId}/run`);
  return { ok: true };
}

export async function completeMeetingAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const householdId = String(formData.get("householdId") ?? "");
  const meetingId = String(formData.get("meetingId") ?? "");
  await assertActiveMembership(householdId);
  const { error } = await meetingRpc("complete_meeting", {
    p_meeting_id: meetingId,
  });
  if (error) return fail(error.message);
  revalidatePath(`/app/${householdId}/meetings/${meetingId}`);
  return { ok: true };
}

export async function publishMeetingRecapAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const householdId = String(formData.get("householdId") ?? "");
  const meetingId = String(formData.get("meetingId") ?? "");
  await assertActiveMembership(householdId);
  const decisionsT = await meetingTable("household_meeting_decisions");
  const actionsT = await meetingTable("household_meeting_action_items");
  const meetingsT = await meetingTable("household_meetings");
  const [{ data: decisions }, { data: actions }, { data: meeting }] =
    await Promise.all([
      decisionsT
        .select("id, decision_text, owner_membership_id, created_at")
        .eq("meeting_id", meetingId)
        .limit(100),
      actionsT
        .select("id, title, owner_membership_id, due_date, status")
        .eq("meeting_id", meetingId)
        .limit(100),
      meetingsT
        .select("meeting_at, period_start, period_end")
        .eq("id", meetingId)
        .maybeSingle(),
    ]);

  const recap = {
    meetingAt: meeting?.meeting_at,
    period: { start: meeting?.period_start, end: meeting?.period_end },
    decisions: decisions ?? [],
    actionItems: actions ?? [],
    publishedAt: new Date().toISOString(),
  };

  const { error } = await meetingRpc("publish_meeting_recap", {
    p_meeting_id: meetingId,
    p_recap_payload: recap,
    p_idempotency_key: null,
  });
  if (error) return fail(error.message);
  revalidatePath(`/app/${householdId}/meetings/${meetingId}`);
  revalidatePath(`/app/${householdId}`);
  return { ok: true };
}

export async function recordMeetingDecisionAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const householdId = String(formData.get("householdId") ?? "");
  const meetingId = String(formData.get("meetingId") ?? "");
  const decisionText = String(formData.get("decisionText") ?? "").trim();
  const idempotencyKey = String(formData.get("idempotencyKey") ?? "") || null;
  if (!decisionText) return fail("Decision text is required.");
  await assertActiveMembership(householdId);
  const { data, error } = await meetingRpc("record_meeting_decision", {
    p_meeting_id: meetingId,
    p_decision_text: decisionText,
    p_agenda_item_id: null,
    p_owner_membership_id: null,
    p_idempotency_key: idempotencyKey,
  });
  if (error) return fail(error.message);
  revalidatePath(`/app/${householdId}/meetings/${meetingId}/run`);
  return { ok: true, data: { decisionId: String(data) } };
}

export async function createMeetingActionItemAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const householdId = String(formData.get("householdId") ?? "");
  const meetingId = String(formData.get("meetingId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const dueDate = String(formData.get("dueDate") ?? "") || null;
  const ownerMembershipId = String(formData.get("ownerMembershipId") ?? "") || null;
  const idempotencyKey = String(formData.get("idempotencyKey") ?? "") || null;
  if (!title) return fail("Action title is required.");
  await assertActiveMembership(householdId);
  const { data, error } = await meetingRpc("create_meeting_action_item", {
    p_meeting_id: meetingId,
    p_title: title,
    p_owner_membership_id: ownerMembershipId,
    p_due_date: dueDate,
    p_decision_id: null,
    p_idempotency_key: idempotencyKey,
  });
  if (error) return fail(error.message);
  revalidatePath(`/app/${householdId}/meetings/${meetingId}/run`);
  return { ok: true, data: { actionItemId: String(data) } };
}

export async function recordMeetingNoteAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const householdId = String(formData.get("householdId") ?? "");
  const meetingId = String(formData.get("meetingId") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  const sectionKey = String(formData.get("sectionKey") ?? "") || null;
  const parkingLot = formData.get("parkingLot") === "on";
  if (!body) return fail("Note is required.");
  await assertActiveMembership(householdId);
  const { error } = await meetingRpc("record_meeting_note", {
    p_meeting_id: meetingId,
    p_body: body,
    p_section_key: sectionKey,
    p_agenda_item_id: null,
    p_parking_lot: parkingLot,
  });
  if (error) return fail(error.message);
  revalidatePath(`/app/${householdId}/meetings/${meetingId}/run`);
  return { ok: true };
}

export async function markSectionDiscussedAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const householdId = String(formData.get("householdId") ?? "");
  const meetingId = String(formData.get("meetingId") ?? "");
  const sectionKey = String(formData.get("sectionKey") ?? "");
  const skipped = formData.get("skipped") === "true";
  await assertActiveMembership(householdId);
  const { error } = await meetingRpc("mark_meeting_section_discussed", {
    p_meeting_id: meetingId,
    p_section_key: sectionKey,
    p_skipped: skipped,
  });
  if (error) return fail(error.message);
  revalidatePath(`/app/${householdId}/meetings/${meetingId}/run`);
  return { ok: true };
}

export async function acceptAgendaItemAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const householdId = String(formData.get("householdId") ?? "");
  const itemId = String(formData.get("itemId") ?? "");
  await assertActiveMembership(householdId);
  const { error } = await meetingRpc("accept_suggested_agenda_item", {
    p_item_id: itemId,
  });
  if (error) return fail(error.message);
  revalidatePath(`/app/${householdId}/meetings`);
  return { ok: true };
}

export async function dismissAgendaItemAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const householdId = String(formData.get("householdId") ?? "");
  const itemId = String(formData.get("itemId") ?? "");
  await assertActiveMembership(householdId);
  const { error } = await meetingRpc("dismiss_suggested_agenda_item", {
    p_item_id: itemId,
  });
  if (error) return fail(error.message);
  revalidatePath(`/app/${householdId}/meetings`);
  return { ok: true };
}

export async function confirmMeetingCalendarAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const householdId = String(formData.get("householdId") ?? "");
  const meetingId = String(formData.get("meetingId") ?? "");
  const title = String(formData.get("title") ?? "Household meeting").trim();
  const meetingAtLocal = String(formData.get("meetingAtLocal") ?? "").trim();
  if (!householdId || !meetingId) return fail("Missing meeting.");

  const ctx = await assertActiveMembership(householdId);
  if (!can(ctx.roles, "calendar.create")) {
    return fail("Not allowed to create calendar events.");
  }

  const meetings = await meetingTable("household_meetings");
  const { data: meeting } = await meetings
    .select("id, calendar_event_id, meeting_at, timezone, title")
    .eq("id", meetingId)
    .eq("household_id", householdId)
    .maybeSingle();
  if (!meeting) return fail("Meeting not found.");
  if (meeting.calendar_event_id) {
    return { ok: true, data: { eventId: meeting.calendar_event_id } };
  }

  const startsAt = meetingAtLocal
    ? new Date(meetingAtLocal).toISOString()
    : meeting.meeting_at
      ? String(meeting.meeting_at)
      : new Date(Date.now() + 7 * 86400000).toISOString();
  const endsAt = new Date(Date.parse(startsAt) + 60 * 60 * 1000).toISOString();

  const supabase = await createClient();
  const { data: eventId, error: createError } = await supabase.rpc(
    "create_calendar_event",
    {
      p_household_id: householdId,
      p_title: title || String(meeting.title),
      p_description: "Monthly household review",
      p_category: "household_meeting",
      p_visibility: "household",
      p_all_day: false,
      p_starts_at: startsAt,
      p_ends_at: endsAt,
      p_time_zone: meeting.timezone || "America/Chicago",
      p_client_idempotency_key: `meeting-cal-${meetingId}`,
    },
  );
  if (createError || !eventId) {
    return fail(createError?.message ?? "Unable to create calendar event.");
  }

  const { data: eventRow } = await supabase
    .from("calendar_events")
    .select(
      "id, all_day, starts_at, ends_at, start_date, end_date_exclusive, time_zone, rrule, status",
    )
    .eq("id", String(eventId))
    .maybeSingle();
  if (eventRow) {
    await materializeEventOccurrences({
      // Narrow materialize helper accepts a structural client; typed client is fine at runtime.
      supabase: supabase as never,
      event: eventRow,
    });
  }

  const { error: linkError } = await meetingRpc("link_meeting_calendar_event", {
    p_meeting_id: meetingId,
    p_calendar_event_id: String(eventId),
  });
  if (linkError) return fail(linkError.message);

  revalidatePath(`/app/${householdId}/meetings/${meetingId}`);
  revalidatePath(`/app/${householdId}/calendar`);
  return { ok: true, data: { eventId: String(eventId) } };
}
