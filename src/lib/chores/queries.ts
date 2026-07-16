import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { ChoreCategory } from "./categories";
import type { ChoreOccurrenceStatus, RotationStrategy } from "./types";

// Chore migrations intentionally precede generated database types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UntypedDb = any;
const db = (client: unknown): UntypedDb => client as UntypedDb;

export type ChoreMemberOption = { id: string; label: string };
export type ChoreAssignmentView = {
  membershipId: string;
  label: string;
  role: string;
  status: string;
};
export type ChoreOccurrenceView = {
  id: string;
  definitionId: string;
  title: string;
  description: string | null;
  category: ChoreCategory;
  visibility: string;
  dueAt: string;
  dueDate: string | null;
  allDay: boolean;
  status: ChoreOccurrenceStatus;
  blockedReason: string | null;
  blockedNote: string | null;
  requiresVerification: boolean;
  verifierMembershipId: string | null;
  creatorMembershipId: string;
  assignments: ChoreAssignmentView[];
  pendingReassignmentId: string | null;
};

export type ChoreBoardFilters = {
  status?: ChoreOccurrenceStatus | ChoreOccurrenceStatus[];
  assigneeMembershipId?: string;
  from?: string;
  to?: string;
  limit?: number;
};

function profileLabel(profile: unknown, fallback: string): string {
  const p = Array.isArray(profile) ? profile[0] : profile;
  const value = p as { display_name?: string | null; email?: string | null } | null;
  return value?.display_name || value?.email || fallback.slice(0, 8);
}

function mapOccurrence(row: Record<string, unknown>): ChoreOccurrenceView {
  const definition = row.definition as Record<string, unknown>;
  const assignments = (row.assignments ?? []) as Array<Record<string, unknown>>;
  const requests = (row.reassignment_requests ?? []) as Array<Record<string, unknown>>;
  return {
    id: row.id as string,
    definitionId: row.definition_id as string,
    title: definition.title as string,
    description: (definition.description as string | null) ?? null,
    category: definition.category as ChoreCategory,
    visibility: definition.visibility as string,
    dueAt: row.due_at as string,
    dueDate: (row.due_date as string | null) ?? null,
    allDay: Boolean(row.all_day),
    status: row.status as ChoreOccurrenceStatus,
    blockedReason: (row.blocked_reason as string | null) ?? null,
    blockedNote: (row.blocked_note as string | null) ?? null,
    requiresVerification: Boolean(definition.requires_verification),
    verifierMembershipId: (definition.verifier_membership_id as string | null) ?? null,
    creatorMembershipId: definition.created_by_membership_id as string,
    assignments: assignments.map((a) => {
      const membership = a.membership as Record<string, unknown> | null;
      return {
        membershipId: a.membership_id as string,
        label: profileLabel(membership?.profiles, a.membership_id as string),
        role: a.role as string,
        status: a.status as string,
      };
    }),
    pendingReassignmentId:
      (requests.find((r) => r.status === "pending")?.id as string | undefined) ?? null,
  };
}

const OCCURRENCE_SELECT = `
  id, definition_id, due_at, due_date, all_day, status, blocked_reason, blocked_note,
  definition:chore_definitions!inner(
    title, description, category, visibility, requires_verification,
    verifier_membership_id, created_by_membership_id
  ),
  assignments:chore_assignments(
    membership_id, role, status,
    membership:household_memberships(membership_id:id, profiles(display_name,email))
  ),
  reassignment_requests:chore_reassignment_requests(id,status)
`;

export async function listBoardOccurrences(
  householdId: string,
  _membershipId: string,
  filters: ChoreBoardFilters = {},
): Promise<ChoreOccurrenceView[]> {
  let query = db(await createClient())
    .from("chore_occurrences")
    .select(OCCURRENCE_SELECT)
    .eq("household_id", householdId)
    .order("due_at", { ascending: true })
    .limit(filters.limit ?? 200);
  if (filters.status) {
    query = Array.isArray(filters.status)
      ? query.in("status", filters.status)
      : query.eq("status", filters.status);
  }
  if (filters.from) query = query.gte("due_at", filters.from);
  if (filters.to) query = query.lt("due_at", filters.to);
  const { data } = await query;
  const rows = ((data ?? []) as Array<Record<string, unknown>>).map(mapOccurrence);
  return filters.assigneeMembershipId
    ? rows.filter((row) =>
        row.assignments.some(
          (assignment) =>
            assignment.membershipId === filters.assigneeMembershipId &&
            assignment.status !== "released",
        ),
      )
    : rows;
}

export function listMyChores(
  householdId: string,
  membershipId: string,
  filters: Omit<ChoreBoardFilters, "assigneeMembershipId"> = {},
) {
  return listBoardOccurrences(householdId, membershipId, {
    ...filters,
    assigneeMembershipId: membershipId,
  });
}

export async function getChoreOccurrenceDetail(
  householdId: string,
  membershipId: string,
  occurrenceId: string,
): Promise<ChoreOccurrenceView | null> {
  const rows = await listBoardOccurrences(householdId, membershipId, { limit: 500 });
  return rows.find((row) => row.id === occurrenceId) ?? null;
}

export async function getChoreDefinitionDetail(householdId: string, definitionId: string) {
  const { data } = await db(await createClient())
    .from("chore_definitions")
    .select("*")
    .eq("household_id", householdId)
    .eq("id", definitionId)
    .maybeSingle();
  return data as Record<string, unknown> | null;
}

export async function listChoreMembers(householdId: string): Promise<ChoreMemberOption[]> {
  const { data } = await db(await createClient())
    .from("household_memberships")
    .select("id,profiles(display_name,email)")
    .eq("household_id", householdId)
    .eq("status", "active");
  return ((data ?? []) as Array<Record<string, unknown>>).map((m) => ({
    id: m.id as string,
    label: profileLabel(m.profiles, m.id as string),
  }));
}

export type ChoreRotationView = {
  id: string;
  name: string;
  strategy: RotationStrategy;
  startMembershipId: string | null;
  paused: boolean;
  ended: boolean;
  members: ChoreMemberOption[];
};

export async function listRotations(householdId: string): Promise<ChoreRotationView[]> {
  const { data } = await db(await createClient())
    .from("chore_rotations")
    .select(`id,name,strategy,start_membership_id,paused_at,ended_at,
      members:chore_rotation_members(membership_id,sort_order,membership:household_memberships(profiles(display_name,email)))`)
    .eq("household_id", householdId)
    .order("name");
  return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    id: r.id as string,
    name: r.name as string,
    strategy: r.strategy as RotationStrategy,
    startMembershipId: (r.start_membership_id as string | null) ?? null,
    paused: Boolean(r.paused_at),
    ended: Boolean(r.ended_at),
    members: ((r.members ?? []) as Array<Record<string, unknown>>)
      .sort((a, b) => Number(a.sort_order) - Number(b.sort_order))
      .map((m) => ({
        id: m.membership_id as string,
        label: profileLabel((m.membership as Record<string, unknown>)?.profiles, m.membership_id as string),
      })),
  }));
}

export async function getRotation(householdId: string, rotationId: string) {
  return (await listRotations(householdId)).find((r) => r.id === rotationId) ?? null;
}

export type ResponsibilityAreaView = {
  id: string;
  name: string;
  description: string | null;
  category: ChoreCategory;
  status: string;
  handoffExpectations: string | null;
  assignments: Array<ChoreMemberOption & { role: string }>;
  pendingTransfers: Array<{ id: string; fromMembershipId: string; toMembershipId: string }>;
};

export async function listResponsibilityAreas(householdId: string): Promise<ResponsibilityAreaView[]> {
  const { data } = await db(await createClient())
    .from("responsibility_areas")
    .select(`id,name,description,category,status,handoff_expectations,
      assignments:responsibility_assignments(membership_id,role,status,membership:household_memberships(profiles(display_name,email))),
      transfers:responsibility_transfers(id,from_membership_id,to_membership_id,status)`)
    .eq("household_id", householdId)
    .order("name");
  return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    id: r.id as string,
    name: r.name as string,
    description: (r.description as string | null) ?? null,
    category: r.category as ChoreCategory,
    status: r.status as string,
    handoffExpectations: (r.handoff_expectations as string | null) ?? null,
    assignments: ((r.assignments ?? []) as Array<Record<string, unknown>>)
      .filter((a) => a.status === "active")
      .map((a) => ({
        id: a.membership_id as string,
        label: profileLabel((a.membership as Record<string, unknown>)?.profiles, a.membership_id as string),
        role: a.role as string,
      })),
    pendingTransfers: ((r.transfers ?? []) as Array<Record<string, unknown>>)
      .filter((t) => t.status === "pending")
      .map((t) => ({
        id: t.id as string,
        fromMembershipId: t.from_membership_id as string,
        toMembershipId: t.to_membership_id as string,
      })),
  }));
}

export async function getResponsibilityArea(householdId: string, areaId: string) {
  return (await listResponsibilityAreas(householdId)).find((a) => a.id === areaId) ?? null;
}

export async function listChoreActionCenterItems(householdId: string, membershipId: string) {
  const now = new Date();
  const soon = new Date(now.getTime() + 48 * 60 * 60 * 1000);
  const chores = await listBoardOccurrences(householdId, membershipId, { limit: 200 });
  const mine = (c: ChoreOccurrenceView) =>
    c.assignments.some((a) => a.membershipId === membershipId && a.status !== "released");
  const { data: transferRows } = await db(await createClient())
    .from("responsibility_transfers")
    .select("id,area_id")
    .eq("household_id", householdId)
    .eq("to_membership_id", membershipId)
    .eq("status", "pending");
  return {
    dueSoon: chores.filter((c) => mine(c) && ["scheduled", "in_progress", "reopened"].includes(c.status) && new Date(c.dueAt) >= now && new Date(c.dueAt) <= soon),
    overdue: chores.filter((c) => mine(c) && ["scheduled", "in_progress", "reopened"].includes(c.status) && new Date(c.dueAt) < now),
    reassignmentPending: chores.filter((c) => Boolean(c.pendingReassignmentId)),
    awaitingVerification: chores.filter((c) => c.status === "awaiting_verification" && c.verifierMembershipId === membershipId),
    blockedNeedingIntervention: chores.filter((c) => c.status === "blocked"),
    responsibilityTransferPending: (transferRows ?? []) as Array<{ id: string; area_id: string }>,
  };
}
