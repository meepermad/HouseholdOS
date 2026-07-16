import type {
  AssignmentCounts,
  AssignmentMap,
  ChoreExclusion,
  RotationAssignment,
  RotationInput,
  RotationPreviewInput,
} from "./types";

function toDate(value: Date | string | undefined): Date | undefined {
  if (value === undefined) return undefined;
  const date = typeof value === "string" ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new RangeError("Invalid rotation due date.");
  }
  return date;
}

function isReadonlyMap<K, V>(
  value: ReadonlyMap<K, V> | unknown,
): value is ReadonlyMap<K, V> {
  return (
    typeof value === "object" &&
    value !== null &&
    "get" in value &&
    typeof value.get === "function" &&
    "has" in value &&
    typeof value.has === "function"
  );
}

function mapValue<T>(
  values: ReadonlyMap<number, T> | Readonly<Record<number, T | undefined>> | undefined,
  key: number,
): { found: boolean; value: T | undefined } {
  if (!values) return { found: false, value: undefined };
  if (isReadonlyMap<number, T>(values)) {
    return { found: values.has(key), value: values.get(key) };
  }
  return {
    found: Object.prototype.hasOwnProperty.call(values, key),
    value: values[key],
  };
}

function countFor(counts: AssignmentCounts | undefined, membershipId: string): number {
  const value =
    counts && isReadonlyMap<string, number>(counts)
      ? counts.get(membershipId)
      : counts?.[membershipId];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function removedSet(
  removedMemberIds: readonly string[] | ReadonlySet<string> | undefined,
): ReadonlySet<string> {
  return removedMemberIds instanceof Set
    ? removedMemberIds
    : new Set(removedMemberIds ?? []);
}

export function filterEligibleMembers(
  orderedMemberIds: readonly string[],
  options: {
    exclusions?: readonly ChoreExclusion[];
    removedMemberIds?: readonly string[] | ReadonlySet<string>;
    at?: Date | string;
  } = {},
): string[] {
  const at = toDate(options.at);
  const removed = removedSet(options.removedMemberIds);
  const seen = new Set<string>();

  return orderedMemberIds.filter((membershipId) => {
    if (seen.has(membershipId) || removed.has(membershipId)) return false;
    seen.add(membershipId);

    return !(options.exclusions ?? []).some((exclusion) => {
      if (exclusion.membershipId !== membershipId) return false;
      if (exclusion.until == null) return true;
      const until = toDate(exclusion.until);
      return at === undefined || (until !== undefined && at.getTime() <= until.getTime());
    });
  });
}

function cyclicAssignment(
  eligible: readonly string[],
  occurrenceIndex: number,
  startMembershipId?: string,
): string | null {
  if (eligible.length === 0) return null;
  const requestedStart = startMembershipId
    ? eligible.indexOf(startMembershipId)
    : 0;
  const start = requestedStart >= 0 ? requestedStart : 0;
  return eligible[(start + occurrenceIndex) % eligible.length] ?? null;
}

function balancedAssignment(
  eligible: readonly string[],
  counts: AssignmentCounts | undefined,
): string | null {
  let selected: string | null = null;
  let selectedCount = Number.POSITIVE_INFINITY;
  for (const membershipId of eligible) {
    const count = countFor(counts, membershipId);
    if (count < selectedCount) {
      selected = membershipId;
      selectedCount = count;
    }
  }
  return selected;
}

function validateOccurrenceIndex(occurrenceIndex: number): void {
  if (!Number.isInteger(occurrenceIndex) || occurrenceIndex < 0) {
    throw new RangeError("Occurrence index must be a non-negative integer.");
  }
}

export function assignForOccurrence(input: RotationInput): RotationAssignment {
  validateOccurrenceIndex(input.occurrenceIndex);
  const dueDate = toDate(input.dueDate);
  const completed = mapValue(input.completedAssignments, input.occurrenceIndex);
  if (completed.found) {
    return {
      occurrenceIndex: input.occurrenceIndex,
      dueDate,
      membershipId: completed.value ?? null,
    };
  }

  if (input.paused) {
    return { occurrenceIndex: input.occurrenceIndex, dueDate, membershipId: null };
  }

  const override = mapValue(input.overrides, input.occurrenceIndex);
  if (override.found) {
    return {
      occurrenceIndex: input.occurrenceIndex,
      dueDate,
      membershipId: override.value ?? null,
    };
  }

  const eligible = filterEligibleMembers(input.orderedEligibleMemberIds, {
    exclusions: input.exclusions,
    removedMemberIds: input.removedMemberIds,
    at: dueDate,
  });

  let membershipId: string | null;
  switch (input.strategy) {
    case "fixed":
      membershipId =
        input.startMembershipId && eligible.includes(input.startMembershipId)
          ? input.startMembershipId
          : (eligible[0] ?? null);
      break;
    case "balanced":
      membershipId = balancedAssignment(eligible, input.recentAssignmentCounts);
      break;
    case "round_robin":
    case "manual_sequence":
      membershipId = cyclicAssignment(
        eligible,
        input.occurrenceIndex,
        input.startMembershipId,
      );
      break;
  }

  return { occurrenceIndex: input.occurrenceIndex, dueDate, membershipId };
}

export function previewRotationAssignments(
  input: RotationPreviewInput,
): RotationAssignment[] {
  const counts = new Map<string, number>();
  for (const membershipId of input.orderedEligibleMemberIds) {
    counts.set(
      membershipId,
      countFor(input.recentAssignmentCounts, membershipId),
    );
  }

  return input.occurrences.map((occurrence) => {
    const assignment = assignForOccurrence({
      ...input,
      ...occurrence,
      recentAssignmentCounts: counts,
    });
    const completed = mapValue(
      input.completedAssignments as AssignmentMap | undefined,
      occurrence.occurrenceIndex,
    );
    if (
      input.strategy === "balanced" &&
      !completed.found &&
      assignment.membershipId !== null
    ) {
      counts.set(
        assignment.membershipId,
        (counts.get(assignment.membershipId) ?? 0) + 1,
      );
    }
    return assignment;
  });
}
