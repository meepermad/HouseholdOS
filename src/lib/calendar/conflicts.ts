/**
 * Conflict detection for calendar overlaps, travel buffers, and resources.
 */

export type ConflictClass = "hard" | "possible" | "informational";
export type ConflictKind =
  | "participant_overlap"
  | "travel_buffer"
  | "resource_exclusive"
  | "resource_capacity"
  | "duplicate_import"
  | "recurrence_collision"
  | "external_mapping";

export type TimedBlock = {
  id: string;
  startsAt: Date;
  endsAt: Date;
  membershipIds: string[];
  travelBufferMinutes?: number;
  titleVisible: boolean;
  title?: string;
};

export type ResourceReservation = {
  resourceId: string;
  eventId: string;
  quantity: number;
  capacityMode: "exclusive" | "capacity";
  capacity: number;
  startsAt: Date;
  endsAt: Date;
};

export type DetectedConflict = {
  eventId: string;
  conflictingEventId: string | null;
  resourceId: string | null;
  conflictClass: ConflictClass;
  conflictKind: ConflictKind;
  summary: string;
};

function overlaps(a: TimedBlock, b: TimedBlock, bufferA = 0, bufferB = 0): boolean {
  const aStart = a.startsAt.getTime() - bufferA * 60_000;
  const aEnd = a.endsAt.getTime() + bufferA * 60_000;
  const bStart = b.startsAt.getTime() - bufferB * 60_000;
  const bEnd = b.endsAt.getTime() + bufferB * 60_000;
  return aStart < bEnd && bStart < aEnd;
}

function sharedParticipants(a: TimedBlock, b: TimedBlock): string[] {
  const set = new Set(a.membershipIds);
  return b.membershipIds.filter((id) => set.has(id));
}

export function detectParticipantConflicts(
  candidate: TimedBlock,
  others: TimedBlock[],
): DetectedConflict[] {
  const out: DetectedConflict[] = [];
  for (const other of others) {
    if (other.id === candidate.id) continue;
    const shared = sharedParticipants(candidate, other);
    if (shared.length === 0) continue;
    const direct = overlaps(candidate, other);
    const buffered = overlaps(
      candidate,
      other,
      candidate.travelBufferMinutes ?? 0,
      other.travelBufferMinutes ?? 0,
    );
    if (!direct && !buffered) continue;

    const otherLabel = other.titleVisible
      ? (other.title ?? "another event")
      : "a busy block";
    out.push({
      eventId: candidate.id,
      conflictingEventId: other.id,
      resourceId: null,
      conflictClass: direct ? "possible" : "informational",
      conflictKind: direct ? "participant_overlap" : "travel_buffer",
      summary: direct
        ? `Overlaps ${otherLabel}`
        : `Travel buffer overlaps ${otherLabel}`,
    });
  }
  return out;
}

export function detectResourceConflicts(
  eventId: string,
  proposed: ResourceReservation[],
  existing: ResourceReservation[],
): DetectedConflict[] {
  const out: DetectedConflict[] = [];
  for (const p of proposed) {
    const overlapping = existing.filter(
      (e) =>
        e.resourceId === p.resourceId &&
        e.eventId !== eventId &&
        p.startsAt < e.endsAt &&
        e.startsAt < p.endsAt,
    );
    if (p.capacityMode === "exclusive" && overlapping.length > 0) {
      out.push({
        eventId,
        conflictingEventId: overlapping[0]!.eventId,
        resourceId: p.resourceId,
        conflictClass: "hard",
        conflictKind: "resource_exclusive",
        summary: "Exclusive household resource is already reserved",
      });
      continue;
    }
    const used = overlapping.reduce((sum, e) => sum + e.quantity, 0);
    if (used + p.quantity > p.capacity) {
      out.push({
        eventId,
        conflictingEventId: overlapping[0]?.eventId ?? null,
        resourceId: p.resourceId,
        conflictClass: "hard",
        conflictKind: "resource_capacity",
        summary: "Household resource capacity would be exceeded",
      });
    }
  }
  return out;
}

/** Soft conflicts may proceed after warning; hard conflicts should be blocked unless overridden by exclusive policy. */
export function canProceedWithConflicts(
  conflicts: DetectedConflict[],
  allowSoft = true,
): boolean {
  const hard = conflicts.some((c) => c.conflictClass === "hard");
  if (hard) return false;
  if (!allowSoft && conflicts.length > 0) return false;
  return true;
}
