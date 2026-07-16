/**
 * Deterministic merge of master event fields with an occurrence exception.
 * Unchanged fields inherit from the master. Used by UI, reminders, and feeds.
 */

export type MasterOccurrenceFields = {
  title: string;
  description: string | null;
  location: string | null;
  eventGuestCount: number | null;
  guestLabel: string | null;
};

export type ExceptionMetadata = {
  kind: "cancelled" | "override";
  title?: string | null;
  description?: string | null;
  location?: string | null;
  eventGuestCount?: number | null;
  guestLabel?: string | null;
  overridesAttendees?: boolean;
  overridesReminders?: boolean;
  /** Present only when overridesReminders; empty array = explicitly no reminders */
  reminderOffsets?: number[] | null;
  /** Present only when overridesAttendees */
  attendeeMembershipIds?: string[] | null;
};

export type EffectiveOccurrenceFields = MasterOccurrenceFields & {
  overridesAttendees: boolean;
  overridesReminders: boolean;
  reminderOffsets: number[] | null;
  attendeeMembershipIds: string[] | null;
  cancelled: boolean;
};

export function mergeOccurrenceMetadata(
  master: MasterOccurrenceFields,
  exception: ExceptionMetadata | null | undefined,
  masterReminderOffsets: number[] = [],
  masterAttendeeIds: string[] = [],
): EffectiveOccurrenceFields {
  if (!exception) {
    return {
      ...master,
      overridesAttendees: false,
      overridesReminders: false,
      reminderOffsets: masterReminderOffsets,
      attendeeMembershipIds: masterAttendeeIds,
      cancelled: false,
    };
  }
  if (exception.kind === "cancelled") {
    return {
      ...master,
      overridesAttendees: false,
      overridesReminders: false,
      reminderOffsets: [],
      attendeeMembershipIds: masterAttendeeIds,
      cancelled: true,
    };
  }

  const overridesAttendees = Boolean(exception.overridesAttendees);
  const overridesReminders = Boolean(exception.overridesReminders);

  return {
    title: exception.title ?? master.title,
    description: exception.description ?? master.description,
    location: exception.location ?? master.location,
    eventGuestCount:
      exception.eventGuestCount !== undefined && exception.eventGuestCount !== null
        ? exception.eventGuestCount
        : master.eventGuestCount,
    guestLabel: exception.guestLabel ?? master.guestLabel,
    overridesAttendees,
    overridesReminders,
    reminderOffsets: overridesReminders
      ? (exception.reminderOffsets ?? [])
      : masterReminderOffsets,
    attendeeMembershipIds: overridesAttendees
      ? (exception.attendeeMembershipIds ?? [])
      : masterAttendeeIds,
    cancelled: false,
  };
}

/** Simpler coalesce used by list views when only scalar metadata is loaded. */
export function coalesceExceptionScalars(
  master: MasterOccurrenceFields,
  exception: {
    title?: string | null;
    description?: string | null;
    location?: string | null;
    event_guest_count?: number | null;
    guest_label?: string | null;
  } | null,
): MasterOccurrenceFields {
  if (!exception) return master;
  return {
    title: exception.title ?? master.title,
    description: exception.description ?? master.description,
    location: exception.location ?? master.location,
    eventGuestCount:
      exception.event_guest_count !== undefined && exception.event_guest_count !== null
        ? exception.event_guest_count
        : master.eventGuestCount,
    guestLabel: exception.guest_label ?? master.guestLabel,
  };
}
