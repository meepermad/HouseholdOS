/**
 * Material-change detection and RSVP reconfirmation helpers.
 */

export type MaterialChangeFields = {
  allDay: boolean;
  startsAt: string | null;
  endsAt: string | null;
  startDate: string | null;
  endDateExclusive: string | null;
  location: string | null;
};

export function isMaterialEventChange(
  before: MaterialChangeFields,
  after: MaterialChangeFields,
): boolean {
  if (before.allDay !== after.allDay) return true;
  if (after.allDay) {
    if (before.startDate !== after.startDate) return true;
    if (before.endDateExclusive !== after.endDateExclusive) return true;
  } else {
    if (before.startsAt !== after.startsAt) return true;
    if (before.endsAt !== after.endsAt) return true;
  }
  const beforeLoc = (before.location ?? "").trim();
  const afterLoc = (after.location ?? "").trim();
  if (beforeLoc !== afterLoc) return true;
  return false;
}

export type RsvpStatus = "needs_action" | "going" | "maybe" | "not_going";

/**
 * After a material change, prior acceptances must not remain represented as
 * confirmed for the new event version.
 */
export function invalidateRsvpAfterMaterialChange(params: {
  participationRole: string;
  currentStatus: RsvpStatus;
}): { status: RsvpStatus; needsReconfirmation: boolean } {
  if (params.participationRole === "organizer") {
    return { status: params.currentStatus, needsReconfirmation: false };
  }
  if (params.currentStatus === "going" || params.currentStatus === "maybe") {
    return { status: "needs_action", needsReconfirmation: true };
  }
  if (params.currentStatus === "needs_action") {
    return { status: "needs_action", needsReconfirmation: true };
  }
  return { status: params.currentStatus, needsReconfirmation: false };
}
