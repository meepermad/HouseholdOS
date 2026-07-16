export const CALENDAR_VISIBILITIES = [
  "household",
  "participants",
  "private_busy",
] as const;

export type CalendarVisibility = (typeof CALENDAR_VISIBILITIES)[number];

export const CALENDAR_VISIBILITY_LABELS: Record<CalendarVisibility, string> = {
  household: "Visible to household",
  participants: "Participants only",
  private_busy: "Private (others see Busy)",
};

export type EventProjectionMode = "full" | "busy" | "hidden";

/**
 * Decide what a viewer may see for an event.
 * Enforced again in SQL views / RPCs — do not rely on UI alone.
 */
export function resolveEventProjection(params: {
  visibility: CalendarVisibility;
  viewerMembershipId: string;
  organizerMembershipId: string;
  attendeeMembershipIds: readonly string[];
}): EventProjectionMode {
  const { visibility, viewerMembershipId, organizerMembershipId, attendeeMembershipIds } =
    params;
  if (viewerMembershipId === organizerMembershipId) return "full";
  if (attendeeMembershipIds.includes(viewerMembershipId)) return "full";
  if (visibility === "household") return "full";
  if (visibility === "private_busy") return "busy";
  return "hidden";
}

export const BUSY_BLOCK_TITLE = "Busy";

export function projectEventForViewer<T extends Record<string, unknown>>(params: {
  event: T & {
    title: string;
    description: string | null;
    location: string | null;
    guest_label: string | null;
    event_guest_count: number | null;
    visibility: CalendarVisibility;
    organizer_membership_id: string;
  };
  mode: EventProjectionMode;
}): T | null {
  const { event, mode } = params;
  if (mode === "hidden") return null;
  if (mode === "full") return event;
  return {
    ...event,
    title: BUSY_BLOCK_TITLE,
    description: null,
    location: null,
    guest_label: null,
    event_guest_count: null,
    // Strip recurrence / reminder / attendee context that could leak private detail
    rrule: null,
    reminder_offsets: [],
    attendees: [],
    is_busy_projection: true,
  };
}

/**
 * Apply busy projection to an already-merged effective occurrence.
 * Occurrence overrides must never bypass the master's private_busy rule.
 */
export function projectOccurrenceForViewer<T extends Record<string, unknown>>(params: {
  occurrence: T & {
    title: string;
    description: string | null;
    location: string | null;
    guestLabel: string | null;
    eventGuestCount: number | null;
  };
  mode: EventProjectionMode;
}): (T & { isBusyProjection: boolean }) | null {
  const { occurrence, mode } = params;
  if (mode === "hidden") return null;
  if (mode === "full") {
    return { ...occurrence, isBusyProjection: false };
  }
  return {
    ...occurrence,
    title: BUSY_BLOCK_TITLE,
    description: null,
    location: null,
    guestLabel: null,
    eventGuestCount: null,
    reminderOffsets: [],
    attendeeMembershipIds: [],
    isBusyProjection: true,
  };
}
