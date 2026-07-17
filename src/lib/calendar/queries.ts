import "server-only";

import { createClient } from "@/lib/supabase/server";
import { coalesceExceptionScalars } from "@/lib/calendar/effective-occurrence";
import {
  BUSY_BLOCK_TITLE,
  resolveEventProjection,
  type CalendarVisibility,
  type EventProjectionMode,
} from "@/lib/calendar/visibility";
import type { CalendarCategory } from "@/lib/calendar/categories";
import type { RsvpStatus } from "@/lib/calendar/headcount";

/**
 * Calendar tables are not in the generated Database types yet. Access is untyped
 * here; row-level security + RPC authorization remain the source of truth.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UntypedDb = any;

function db(client: Awaited<ReturnType<typeof createClient>>): UntypedDb {
  return client as UntypedDb;
}

export type CalendarMemberOption = {
  id: string;
  userId: string;
  label: string;
};

export type CalendarAttendee = {
  membershipId: string;
  userId: string | null;
  label: string;
  participationRole: string;
  rsvpStatus: RsvpStatus;
  guestCount: number;
  guestNote: string | null;
};

export type CalendarOccurrence = {
  occurrenceId: string;
  eventId: string;
  originalStartsAt: string;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  startDate: string | null;
  endDateExclusive: string | null;
  title: string;
  description: string | null;
  location: string | null;
  category: CalendarCategory;
  visibility: CalendarVisibility;
  status: string;
  timeZone: string;
  organizerMembershipId: string;
  eventGuestCount: number | null;
  guestLabel: string | null;
  isBusyProjection: boolean;
  cancelled: boolean;
  viewerRsvp: RsvpStatus | null;
  sourceType: string | null;
  calendarId: string | null;
};

export type CalendarEventDetail = {
  eventId: string;
  householdId: string;
  title: string;
  description: string | null;
  location: string | null;
  category: CalendarCategory;
  visibility: CalendarVisibility;
  status: string;
  allDay: boolean;
  startsAt: string | null;
  endsAt: string | null;
  startDate: string | null;
  endDateExclusive: string | null;
  timeZone: string;
  rrule: string | null;
  organizerMembershipId: string;
  organizerLabel: string;
  eventGuestCount: number;
  guestLabel: string | null;
  reminderOffsets: number[];
  attendees: CalendarAttendee[];
  isBusyProjection: boolean;
  viewerMembershipId: string;
  viewerRsvp: RsvpStatus | null;
  viewerIsOrganizer: boolean;
  sourceType: string | null;
  lifecycleOwner: string | null;
  isEditable: boolean;
  canonicalDeepLink: string | null;
};

type AttendeeRow = {
  event_id: string;
  membership_id: string;
  rsvp_status: RsvpStatus;
  guest_count: number;
  guest_note: string | null;
  participation_role: string;
};

function memberLabel(profile: {
  display_name: string | null;
  email: string | null;
} | null, fallbackId: string): string {
  return profile?.display_name || profile?.email || fallbackId.slice(0, 8);
}

export async function listActiveMembers(
  householdId: string,
): Promise<CalendarMemberOption[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("household_memberships")
    .select("id, user_id, profiles(display_name, email)")
    .eq("household_id", householdId)
    .eq("status", "active");

  return (data ?? []).map((m) => {
    const profile = m.profiles as
      | { display_name: string | null; email: string | null }
      | null;
    return {
      id: m.id as string,
      userId: m.user_id as string,
      label: memberLabel(profile, m.id as string),
    };
  });
}

/**
 * Occurrences overlapping [rangeStart, rangeEnd), projected for the viewer.
 * Non-participants see a "Busy" block for private events; hidden events drop out.
 */
export async function listOccurrencesInRange(
  householdId: string,
  membershipId: string,
  rangeStart: string,
  rangeEnd: string,
): Promise<CalendarOccurrence[]> {
  const supabase = db(await createClient());

  const { data: occ, error: occError } = await supabase
    .from("calendar_event_occurrences")
    .select(
      `id, event_id, original_starts_at, starts_at, ends_at, all_day,
       start_date, end_date_exclusive, is_cancelled, exception_id,
       event:calendar_events!inner(
         id, title, description, location, category, visibility, status,
         time_zone, organizer_membership_id, event_guest_count, guest_label,
         source_type, calendar_id
       )`,
    )
    .eq("household_id", householdId)
    .eq("is_cancelled", false)
    .lt("starts_at", rangeEnd)
    .gt("ends_at", rangeStart)
    .order("starts_at", { ascending: true });

  if (occError) {
    const { AppError, logServerError } = await import("@/lib/errors");
    logServerError("list_occurrences_in_range", occError, {
      householdId,
      rangeStart,
      rangeEnd,
    });
    throw new AppError(
      "database_failure",
      "Unable to load calendar events. Try again or return Home.",
    );
  }

  const rows = (occ ?? []) as Array<Record<string, unknown>>;
  if (rows.length === 0) return [];

  const eventIds = Array.from(
    new Set(
      rows
        .map((r) => (r.event as { id?: string } | null)?.id)
        .filter((x): x is string => Boolean(x)),
    ),
  );

  const attendeesByEvent = await loadAttendeeIndex(supabase, eventIds);

  // Load exception metadata for occurrences that have overrides (RLS hides
  // private_busy exceptions from non-participants — safe).
  const exceptionIds = rows
    .map((r) => r.exception_id as string | null)
    .filter((id): id is string => Boolean(id));
  const exceptionById = new Map<
    string,
    {
      title: string | null;
      description: string | null;
      location: string | null;
      event_guest_count: number | null;
      guest_label: string | null;
    }
  >();
  if (exceptionIds.length > 0) {
    const { data: exRows } = await supabase
      .from("calendar_event_exceptions")
      .select("id, title, description, location, event_guest_count, guest_label")
      .in("id", exceptionIds)
      .eq("kind", "override");
    for (const ex of (exRows ?? []) as Array<Record<string, unknown>>) {
      exceptionById.set(ex.id as string, {
        title: (ex.title as string | null) ?? null,
        description: (ex.description as string | null) ?? null,
        location: (ex.location as string | null) ?? null,
        event_guest_count: (ex.event_guest_count as number | null) ?? null,
        guest_label: (ex.guest_label as string | null) ?? null,
      });
    }
  }

  const result: CalendarOccurrence[] = [];
  for (const r of rows) {
    const event = r.event as {
      id: string;
      title: string;
      description: string | null;
      location: string | null;
      category: CalendarCategory;
      visibility: CalendarVisibility;
      status: string;
      time_zone: string;
      organizer_membership_id: string;
      event_guest_count: number | null;
      guest_label: string | null;
      source_type: string | null;
      calendar_id: string | null;
    } | null;
    if (!event) continue;

    const index = attendeesByEvent.get(event.id);
    const attendeeIds = index?.membershipIds ?? [];
    const mode = resolveEventProjection({
      visibility: event.visibility,
      viewerMembershipId: membershipId,
      organizerMembershipId: event.organizer_membership_id,
      attendeeMembershipIds: attendeeIds,
    });
    if (mode === "hidden") continue;

    const merged = coalesceExceptionScalars(
      {
        title: event.title,
        description: event.description,
        location: event.location,
        eventGuestCount: event.event_guest_count,
        guestLabel: event.guest_label,
      },
      r.exception_id
        ? (exceptionById.get(r.exception_id as string) ?? null)
        : null,
    );

    const busy = mode === "busy";
    result.push({
      occurrenceId: r.id as string,
      eventId: event.id,
      originalStartsAt: r.original_starts_at as string,
      startsAt: r.starts_at as string,
      endsAt: r.ends_at as string,
      allDay: Boolean(r.all_day),
      startDate: (r.start_date as string | null) ?? null,
      endDateExclusive: (r.end_date_exclusive as string | null) ?? null,
      title: busy ? BUSY_BLOCK_TITLE : merged.title,
      description: busy ? null : merged.description,
      location: busy ? null : merged.location,
      category: event.category,
      visibility: event.visibility,
      status: event.status,
      timeZone: event.time_zone,
      organizerMembershipId: event.organizer_membership_id,
      eventGuestCount: busy ? null : merged.eventGuestCount,
      guestLabel: busy ? null : merged.guestLabel,
      isBusyProjection: busy,
      cancelled: event.status === "cancelled",
      viewerRsvp: index?.viewerRsvp ?? null,
      sourceType: busy ? null : event.source_type,
      calendarId: event.calendar_id,
    });
  }

  return result;
}

type AttendeeIndexEntry = {
  membershipIds: string[];
  viewerRsvp: RsvpStatus | null;
};

async function loadAttendeeIndex(
  supabase: UntypedDb,
  eventIds: string[],
): Promise<Map<string, AttendeeIndexEntry>> {
  const map = new Map<string, AttendeeIndexEntry>();
  if (eventIds.length === 0) return map;
  const { data } = await supabase
    .from("calendar_event_attendees")
    .select("event_id, membership_id, rsvp_status")
    .in("event_id", eventIds);
  for (const row of (data ?? []) as Array<
    Pick<AttendeeRow, "event_id" | "membership_id" | "rsvp_status">
  >) {
    const entry = map.get(row.event_id) ?? {
      membershipIds: [],
      viewerRsvp: null,
    };
    entry.membershipIds.push(row.membership_id);
    map.set(row.event_id, entry);
  }
  return map;
}

/** Full or busy projection of a single event, with attendees + reminders. */
export async function getEventDetail(
  householdId: string,
  eventId: string,
  membershipId: string,
): Promise<CalendarEventDetail | null> {
  const supabase = db(await createClient());

  const { data: event } = await supabase
    .from("calendar_events")
    .select(
      `id, household_id, title, description, location, category, visibility,
       status, all_day, starts_at, ends_at, start_date, end_date_exclusive,
       time_zone, rrule, organizer_membership_id, event_guest_count, guest_label,
       source_type, lifecycle_owner, is_editable, canonical_deep_link`,
    )
    .eq("id", eventId)
    .eq("household_id", householdId)
    .maybeSingle();

  if (!event) return null;

  const { data: attendeeRows } = await supabase
    .from("calendar_event_attendees")
    .select(
      `membership_id, rsvp_status, guest_count, guest_note, participation_role,
       membership:household_memberships(id, user_id, profiles(display_name, email))`,
    )
    .eq("event_id", eventId);

  const attendees: CalendarAttendee[] = ((attendeeRows ?? []) as Array<
    Record<string, unknown>
  >).map((a) => {
    const membership = a.membership as {
      id: string;
      user_id: string | null;
      profiles: { display_name: string | null; email: string | null } | null;
    } | null;
    return {
      membershipId: a.membership_id as string,
      userId: membership?.user_id ?? null,
      label: memberLabel(membership?.profiles ?? null, a.membership_id as string),
      participationRole: a.participation_role as string,
      rsvpStatus: a.rsvp_status as RsvpStatus,
      guestCount: (a.guest_count as number) ?? 0,
      guestNote: (a.guest_note as string | null) ?? null,
    };
  });

  const mode: EventProjectionMode = resolveEventProjection({
    visibility: event.visibility as CalendarVisibility,
    viewerMembershipId: membershipId,
    organizerMembershipId: event.organizer_membership_id as string,
    attendeeMembershipIds: attendees.map((a) => a.membershipId),
  });

  if (mode === "hidden") return null;
  const busy = mode === "busy";

  const { data: reminderRows } = await supabase
    .from("calendar_event_reminders")
    .select("offset_minutes")
    .eq("event_id", eventId)
    .order("offset_minutes", { ascending: true });

  const reminderOffsets = ((reminderRows ?? []) as Array<{
    offset_minutes: number;
  }>).map((r) => r.offset_minutes);

  const organizer = attendees.find(
    (a) => a.membershipId === event.organizer_membership_id,
  );
  const viewer = attendees.find((a) => a.membershipId === membershipId);

  return {
    eventId: event.id as string,
    householdId: event.household_id as string,
    title: busy ? BUSY_BLOCK_TITLE : (event.title as string),
    description: busy ? null : ((event.description as string | null) ?? null),
    location: busy ? null : ((event.location as string | null) ?? null),
    category: event.category as CalendarCategory,
    visibility: event.visibility as CalendarVisibility,
    status: event.status as string,
    allDay: Boolean(event.all_day),
    startsAt: (event.starts_at as string | null) ?? null,
    endsAt: (event.ends_at as string | null) ?? null,
    startDate: (event.start_date as string | null) ?? null,
    endDateExclusive: (event.end_date_exclusive as string | null) ?? null,
    timeZone: event.time_zone as string,
    rrule: busy ? null : ((event.rrule as string | null) ?? null),
    organizerMembershipId: event.organizer_membership_id as string,
    organizerLabel: organizer?.label ?? "Organizer",
    eventGuestCount: busy ? 0 : ((event.event_guest_count as number) ?? 0),
    guestLabel: busy ? null : ((event.guest_label as string | null) ?? null),
    reminderOffsets: busy ? [] : reminderOffsets,
    attendees: busy ? [] : attendees,
    isBusyProjection: busy,
    viewerMembershipId: membershipId,
    viewerRsvp: viewer?.rsvpStatus ?? null,
    viewerIsOrganizer: membershipId === event.organizer_membership_id,
    sourceType: busy
      ? null
      : ((event.source_type as string | null) ?? null),
    lifecycleOwner: (event.lifecycle_owner as string | null) ?? "householdos",
    isEditable: busy
      ? false
      : ((event.is_editable as boolean | null) ?? true),
    canonicalDeepLink: busy
      ? null
      : ((event.canonical_deep_link as string | null) ?? null),
  };
}

export type CalendarFeedTokenSummary = {
  id: string;
  label: string;
  scope: string;
  createdAt: string;
  lastAccessedAt: string | null;
  revokedAt: string | null;
};

/** Feed tokens for the current user + household. token_hash is never selected. */
export async function listFeedTokens(
  userId: string,
  householdId: string,
): Promise<CalendarFeedTokenSummary[]> {
  const supabase = db(await createClient());
  const { data } = await supabase
    .from("calendar_feed_tokens")
    .select("id, label, scope, created_at, last_accessed_at, revoked_at")
    .eq("user_id", userId)
    .eq("household_id", householdId)
    .order("created_at", { ascending: false });

  return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    id: r.id as string,
    label: r.label as string,
    scope: r.scope as string,
    createdAt: r.created_at as string,
    lastAccessedAt: (r.last_accessed_at as string | null) ?? null,
    revokedAt: (r.revoked_at as string | null) ?? null,
  }));
}
