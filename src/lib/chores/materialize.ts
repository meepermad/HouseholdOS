import { defaultHorizon, expandOccurrences } from "@/lib/calendar/recurrence";
import { calculateDueTimestamp } from "./due";
import { previewRotationAssignments } from "./rotation";
import type { RotationStrategy } from "./types";

export type MaterializableChoreDefinition = {
  id: string;
  status: string;
  rrule: string | null;
  start_date: string;
  end_date: string | null;
  recurrence_count: number | null;
  time_zone: string;
  all_day: boolean;
  due_time_minutes: number | null;
  rotation_id: string | null;
};

// The helper accepts both authenticated and privileged untyped Supabase clients.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ChoreDb = any;

function timeFromMinutes(minutes: number | null): string {
  const value = minutes ?? 23 * 60 + 59;
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}

export async function materializeChoreOccurrences(params: {
  supabase: ChoreDb;
  definition: MaterializableChoreDefinition;
  rangeStart?: Date;
  rangeEnd?: Date;
}): Promise<{ count: number; error: string | null }> {
  const { definition, supabase } = params;
  if (definition.status !== "active" || !definition.rrule) {
    return { count: 0, error: null };
  }
  const horizon = defaultHorizon();
  const seed = calculateDueTimestamp({
    dueDate: definition.start_date,
    dueTime: timeFromMinutes(definition.due_time_minutes),
    timeZone: definition.time_zone,
  });
  const expanded = expandOccurrences({
    allDay: false,
    startsAt: seed.toISOString(),
    endsAt: new Date(seed.getTime() + 60_000).toISOString(),
    startDate: null,
    endDateExclusive: null,
    timeZone: definition.time_zone,
    rrule: definition.rrule,
    rangeStart: params.rangeStart ?? horizon.rangeStart,
    rangeEnd: params.rangeEnd ?? horizon.rangeEnd,
    exceptions: [],
  }).filter((occ) => {
    if (definition.end_date && occ.startsAt.slice(0, 10) > definition.end_date) return false;
    return true;
  }).slice(0, definition.recurrence_count ?? 520);

  let rotation: {
    strategy: RotationStrategy;
    start_membership_id: string | null;
    paused_at: string | null;
    members: Array<{ membership_id: string; sort_order: number; excluded_until: string | null }>;
  } | null = null;
  if (definition.rotation_id) {
    const { data } = await supabase
      .from("chore_rotations")
      .select("strategy,start_membership_id,paused_at,members:chore_rotation_members(membership_id,sort_order,excluded_until)")
      .eq("id", definition.rotation_id)
      .maybeSingle();
    rotation = data;
  }

  const orderedMembers = (rotation?.members ?? [])
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((m) => m.membership_id);
  const assignments = rotation
    ? previewRotationAssignments({
        strategy: rotation.strategy,
        orderedEligibleMemberIds: orderedMembers,
        startMembershipId: rotation.start_membership_id ?? undefined,
        paused: Boolean(rotation.paused_at),
        exclusions: rotation.members.map((m) => ({
          membershipId: m.membership_id,
          until: m.excluded_until,
        })),
        occurrences: expanded.map((occ, occurrenceIndex) => ({
          occurrenceIndex,
          dueDate: occ.startsAt,
        })),
      })
    : [];

  const payload = expanded.map((occ, occurrenceIndex) => ({
    occurrence_index: occurrenceIndex,
    original_due_at: occ.originalStartsAt,
    due_at: occ.startsAt,
    all_day: definition.all_day,
    due_date: definition.all_day ? occ.startsAt.slice(0, 10) : null,
    membership_ids: assignments[occurrenceIndex]?.membershipId
      ? [assignments[occurrenceIndex]!.membershipId]
      : [],
  }));
  const { data, error } = await supabase.rpc("materialize_chore_occurrences", {
    p_definition_id: definition.id,
    p_occurrences: payload,
  });
  if (error) return { count: 0, error: error.message };
  return { count: typeof data === "number" ? data : payload.length, error: null };
}
