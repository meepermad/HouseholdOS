/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { generateInviteToken, hashInviteToken } from "@/lib/tokens";
import type { Database } from "@/types/database";
import { getAuthedClient } from "../helpers/authed-client";
import {
  cleanupTestHouseholdsByRunId,
  deleteTestAuthUsers,
} from "../helpers/cleanup-test-households";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey =
  process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
const publishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const hasSupabase = Boolean(url && secretKey && publishableKey);
const TEST_DOMAIN = "hos-itest.local";
const runId = `chore-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const password = "Test-Password-123!";

type Admin = SupabaseClient<Database>;
type Session = {
  email: string;
  userId: string;
  client: SupabaseClient<Database>;
};

type RpcResult<T = unknown> = { data: T; error: { message: string } | null };

function crpc<T = unknown>(
  client: SupabaseClient<Database>,
  fn: string,
  args: Record<string, unknown>,
): Promise<RpcResult<T>> {
  return (client as any).rpc(fn, args) as Promise<RpcResult<T>>;
}

function ctable(client: SupabaseClient<Database>, name: string): any {
  return (client as any).from(name);
}

async function authed(email: string): Promise<Session> {
  const session = await getAuthedClient(email, password);
  return { email, client: session.client, userId: session.userId };
}

describe.skipIf(!hasSupabase)("Phase 5 chores RLS + RPCs", () => {
  let admin: Admin;
  const createdUserIds: string[] = [];

  let householdA: string;
  let memA: string;
  let memB: string;
  let memC: string;
  let userA: Session;
  let userB: Session;
  let userC: Session;

  let householdD: string;
  let memD: string;
  let userO: Session;

  const emailA = `ha-${runId}@${TEST_DOMAIN}`;
  const emailB = `hb-${runId}@${TEST_DOMAIN}`;
  const emailC = `hc-${runId}@${TEST_DOMAIN}`;
  const emailO = `ho-${runId}@${TEST_DOMAIN}`;

  const dueAt = new Date(Date.now() + 14 * 24 * 3600 * 1000);
  const dueISO = dueAt.toISOString();
  const startDate = dueAt.toISOString().slice(0, 10);

  async function membershipId(
    householdId: string,
    userId: string,
  ): Promise<string> {
    const { data } = await admin
      .from("household_memberships")
      .select("id")
      .eq("household_id", householdId)
      .eq("user_id", userId)
      .single();
    return data!.id as string;
  }

  async function inviteAccept(
    inviter: Session,
    inviteeEmail: string,
    householdId: string,
  ): Promise<Session> {
    const token = generateInviteToken();
    const invite = await inviter.client.rpc("create_household_invitation", {
      p_household_id: householdId,
      p_email: inviteeEmail,
      p_token_hash: hashInviteToken(token),
      p_expires_at: new Date(Date.now() + 3_600_000).toISOString(),
      p_intended_roles: ["member"],
    });
    expect(invite.error).toBeNull();
    const invitee = await authed(inviteeEmail);
    const accept = await invitee.client.rpc("accept_household_invitation", {
      p_token_hash: hashInviteToken(token),
    });
    expect(accept.error).toBeNull();
    return invitee;
  }

  async function createOneTimeChore(
    client: SupabaseClient<Database>,
    opts: {
      key: string;
      householdId?: string;
      assignees?: string[];
      requiresVerification?: boolean;
      verifierId?: string;
      due?: string;
    },
  ): Promise<RpcResult<string>> {
    const args: Record<string, unknown> = {
      p_household_id: opts.householdId ?? householdA,
      p_title: `Chore-${opts.key}-${runId}`,
      p_category: "kitchen",
      p_due_at: opts.due ?? dueISO,
      p_assignee_membership_ids: opts.assignees ?? [],
    };
    if (opts.requiresVerification) args.p_requires_verification = true;
    if (opts.verifierId) args.p_verifier_membership_id = opts.verifierId;
    return crpc<string>(client, "create_one_time_chore", args);
  }

  async function occurrenceForDefinition(definitionId: string): Promise<string> {
    const { data } = await admin
      .from("chore_occurrences" as never)
      .select("id")
      .eq("definition_id", definitionId)
      .order("occurrence_index", { ascending: true })
      .limit(1)
      .single();
    return (data as any).id as string;
  }

  beforeAll(async () => {
    admin = createClient<Database>(url!, secretKey!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    await admin.from("auth_registration_policy").upsert({
      id: 1,
      mode: "invite_only",
      allow_test_emails: true,
      test_email_domain: TEST_DOMAIN,
    });

    for (const email of [emailA, emailB, emailC, emailO]) {
      const created = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      expect(created.error).toBeNull();
      createdUserIds.push(created.data.user!.id);
    }

    userA = await authed(emailA);
    const createdA = await userA.client.rpc("create_household_for_current_user", {
      p_name: `ChoreA-${runId}`,
      p_acknowledge_reimbursement_policy: true,
      p_idempotency_key: `${runId}-hhA`,
    });
    expect(createdA.error).toBeNull();
    const rowA = Array.isArray(createdA.data) ? createdA.data[0] : createdA.data;
    householdA = rowA!.household_id;
    memA = rowA!.membership_id;

    userB = await inviteAccept(userA, emailB, householdA);
    userC = await inviteAccept(userA, emailC, householdA);
    memB = await membershipId(householdA, userB.userId);
    memC = await membershipId(householdA, userC.userId);

    userO = await authed(emailO);
    const createdD = await userO.client.rpc("create_household_for_current_user", {
      p_name: `ChoreD-${runId}`,
      p_acknowledge_reimbursement_policy: true,
      p_idempotency_key: `${runId}-hhD`,
    });
    expect(createdD.error).toBeNull();
    const rowD = Array.isArray(createdD.data) ? createdD.data[0] : createdD.data;
    householdD = rowD!.household_id;
    memD = await membershipId(householdD, userO.userId);
  }, 90_000);

  afterAll(async () => {
    if (!admin) return;
    await cleanupTestHouseholdsByRunId(admin, runId);
    await deleteTestAuthUsers(admin, createdUserIds);
  }, 90_000);

  it("[1] active member creates a one-time chore", async () => {
    const created = await createOneTimeChore(userA.client, {
      key: "one-time",
      assignees: [memB],
    });
    expect(created.error).toBeNull();
    const definitionId = created.data;
    expect(definitionId).toBeTruthy();

    const { data: def } = await admin
      .from("chore_definitions" as never)
      .select("household_id, created_by_membership_id, status")
      .eq("id", definitionId as string)
      .single();
    expect((def as any)?.household_id).toBe(householdA);
    expect((def as any)?.created_by_membership_id).toBe(memA);
    expect((def as any)?.status).toBe("active");

    const { count } = await admin
      .from("chore_occurrences" as never)
      .select("id", { count: "exact", head: true })
      .eq("definition_id", definitionId as string);
    expect(count).toBe(1);
  });

  it("[2] user cannot create chore in another household", async () => {
    const denied = await createOneTimeChore(userA.client, {
      key: "cross-hh",
      householdId: householdD,
    });
    expect(denied.error).toBeTruthy();
    expect(denied.error?.message.toLowerCase()).toMatch(/active membership|not authorized/);
  });

  it("[3] cross-household assignee rejected", async () => {
    const denied = await createOneTimeChore(userA.client, {
      key: "cross-assignee",
      assignees: [memD],
    });
    expect(denied.error).toBeTruthy();
    expect(denied.error?.message.toLowerCase()).toMatch(
      /active member|not active|cross-household|rejected|invalid/,
    );
  });

  it("[4] assignee can start and complete their chore", async () => {
    const created = await createOneTimeChore(userB.client, {
      key: "assignee-flow",
      assignees: [memB],
    });
    expect(created.error).toBeNull();
    const occId = await occurrenceForDefinition(created.data as string);

    const started = await crpc(userB.client, "start_chore_occurrence", {
      p_occurrence_id: occId,
    });
    expect(started.error).toBeNull();

    const { data: inProgress } = await admin
      .from("chore_occurrences" as never)
      .select("status")
      .eq("id", occId)
      .single();
    expect((inProgress as any)?.status).toBe("in_progress");

    const completed = await crpc(userB.client, "complete_chore_occurrence", {
      p_occurrence_id: occId,
      p_completion_note: "done",
    });
    expect(completed.error).toBeNull();

    const { data: done } = await admin
      .from("chore_occurrences" as never)
      .select("status")
      .eq("id", occId)
      .single();
    expect((done as any)?.status).toBe("completed");
  });

  it("[5] user cannot complete on behalf of another", async () => {
    const created = await createOneTimeChore(userA.client, {
      key: "non-assignee",
      assignees: [memB],
    });
    expect(created.error).toBeNull();
    const occId = await occurrenceForDefinition(created.data as string);

    const denied = await crpc(userC.client, "complete_chore_occurrence", {
      p_occurrence_id: occId,
    });
    expect(denied.error).toBeTruthy();
    expect(denied.error?.message.toLowerCase()).toContain("assignee");
  });

  it("[6] completion actor derived from auth", async () => {
    const created = await createOneTimeChore(userA.client, {
      key: "actor",
      assignees: [memB],
    });
    expect(created.error).toBeNull();
    const occId = await occurrenceForDefinition(created.data as string);

    const completed = await crpc(userB.client, "complete_chore_occurrence", {
      p_occurrence_id: occId,
    });
    expect(completed.error).toBeNull();

    const { data: record } = await admin
      .from("chore_completion_records" as never)
      .select("completed_by_membership_id")
      .eq("occurrence_id", occId)
      .order("version", { ascending: false })
      .limit(1)
      .single();
    expect((record as any)?.completed_by_membership_id).toBe(memB);
  });

  it("[7] verifier can verify when requires_verification", async () => {
    const created = await createOneTimeChore(userA.client, {
      key: "verify-ok",
      assignees: [memB],
      requiresVerification: true,
      verifierId: memA,
    });
    expect(created.error).toBeNull();
    const occId = await occurrenceForDefinition(created.data as string);

    await crpc(userB.client, "complete_chore_occurrence", { p_occurrence_id: occId });

    const verified = await crpc(userA.client, "verify_chore_completion", {
      p_occurrence_id: occId,
    });
    expect(verified.error).toBeNull();

    const { data: row } = await admin
      .from("chore_occurrences" as never)
      .select("status")
      .eq("id", occId)
      .single();
    expect((row as any)?.status).toBe("verified");
  });

  it("[8] nonverifier cannot verify", async () => {
    const created = await createOneTimeChore(userA.client, {
      key: "verify-deny",
      assignees: [memB],
      requiresVerification: true,
      verifierId: memA,
    });
    expect(created.error).toBeNull();
    const occId = await occurrenceForDefinition(created.data as string);

    await crpc(userB.client, "complete_chore_occurrence", { p_occurrence_id: occId });

    const denied = await crpc(userC.client, "verify_chore_completion", {
      p_occurrence_id: occId,
    });
    expect(denied.error).toBeTruthy();
    expect(denied.error?.message.toLowerCase()).toMatch(/verifier|coordinator/);
  });

  it("[9] direct lifecycle status update on chore_occurrences fails", async () => {
    const created = await createOneTimeChore(userA.client, {
      key: "direct-status",
      assignees: [memB],
    });
    expect(created.error).toBeNull();
    const occId = await occurrenceForDefinition(created.data as string);

    const { data: forged } = await ctable(userA.client, "chore_occurrences")
      .update({ status: "completed" })
      .eq("id", occId)
      .select();
    expect((forged ?? []).length).toBe(0);

    const { data: stillScheduled } = await admin
      .from("chore_occurrences" as never)
      .select("status")
      .eq("id", occId)
      .single();
    expect((stillScheduled as any)?.status).toBe("scheduled");
  });

  it("[10] round-robin materialize is idempotent", async () => {
    const rotation = await crpc<string>(userA.client, "create_chore_rotation", {
      p_household_id: householdA,
      p_name: `RR-${runId}`,
      p_strategy: "round_robin",
      p_start_membership_id: memA,
      p_membership_ids: [memA, memB, memC],
    });
    expect(rotation.error).toBeNull();

    const def = await crpc<string>(userA.client, "create_chore_definition", {
      p_household_id: householdA,
      p_title: `Recurring-${runId}`,
      p_category: "kitchen",
      p_start_date: startDate,
      p_rrule: "FREQ=WEEKLY;INTERVAL=1",
      p_all_day: false,
      p_due_time_minutes: 600,
      p_rotation_id: rotation.data,
    });
    expect(def.error).toBeNull();

    const due1 = dueISO;
    const due2 = new Date(dueAt.getTime() + 7 * 24 * 3600 * 1000).toISOString();
    const occurrences = [
      {
        occurrence_index: 0,
        original_due_at: due1,
        due_at: due1,
        all_day: false,
        membership_ids: [memA],
      },
      {
        occurrence_index: 1,
        original_due_at: due2,
        due_at: due2,
        all_day: false,
        membership_ids: [memB],
      },
    ];

    const first = await crpc<number>(userA.client, "materialize_chore_occurrences", {
      p_definition_id: def.data,
      p_occurrences: occurrences,
    });
    expect(first.error).toBeNull();
    expect(first.data).toBe(2);

    const second = await crpc<number>(userA.client, "materialize_chore_occurrences", {
      p_definition_id: def.data,
      p_occurrences: occurrences,
    });
    expect(second.error).toBeNull();
    expect(second.data).toBe(2);

    const { count } = await admin
      .from("chore_occurrences" as never)
      .select("id", { count: "exact", head: true })
      .eq("definition_id", def.data as string);
    expect(count).toBe(2);
  });

  it("[12] skip does not cancel series", async () => {
    const due1 = new Date(dueAt.getTime() + 21 * 24 * 3600 * 1000).toISOString();
    const due2 = new Date(dueAt.getTime() + 28 * 24 * 3600 * 1000).toISOString();

    const def = await crpc<string>(userA.client, "create_chore_definition", {
      p_household_id: householdA,
      p_title: `Series-${runId}`,
      p_category: "kitchen",
      p_start_date: due1.slice(0, 10),
      p_rrule: "FREQ=WEEKLY;INTERVAL=1",
      p_all_day: false,
      p_due_time_minutes: 720,
    });
    expect(def.error).toBeNull();

    await crpc(userA.client, "materialize_chore_occurrences", {
      p_definition_id: def.data,
      p_occurrences: [
        {
          occurrence_index: 0,
          original_due_at: due1,
          due_at: due1,
          all_day: false,
          membership_ids: [memB],
        },
        {
          occurrence_index: 1,
          original_due_at: due2,
          due_at: due2,
          all_day: false,
          membership_ids: [memB],
        },
      ],
    });

    const { data: firstOcc } = await admin
      .from("chore_occurrences" as never)
      .select("id")
      .eq("definition_id", def.data as string)
      .eq("occurrence_index", 0)
      .single();
    const occId = (firstOcc as any).id as string;

    const skipped = await crpc(userB.client, "skip_chore_occurrence", {
      p_occurrence_id: occId,
      p_reason: "away this week",
    });
    expect(skipped.error).toBeNull();

    const { data: occRow } = await admin
      .from("chore_occurrences" as never)
      .select("status")
      .eq("id", occId)
      .single();
    expect((occRow as any)?.status).toBe("skipped");

    const { data: defRow } = await admin
      .from("chore_definitions" as never)
      .select("status")
      .eq("id", def.data as string)
      .single();
    expect((defRow as any)?.status).toBe("active");
  });

  it("[13] responsibility transfer requires acceptance", async () => {
    const area = await crpc<string>(userA.client, "create_responsibility_area", {
      p_household_id: householdA,
      p_name: `Area-${runId}`,
      p_category: "kitchen",
      p_start_date: startDate,
    });
    expect(area.error).toBeNull();

    const assigned = await crpc(userA.client, "assign_responsibility_area", {
      p_area_id: area.data,
      p_membership_id: memA,
      p_role: "owner",
    });
    expect(assigned.error).toBeNull();

    const transfer = await crpc(userA.client, "request_responsibility_transfer", {
      p_area_id: area.data,
      p_to_membership_id: memB,
      p_note: "handoff please",
    });
    expect(transfer.error).toBeNull();

    const { data: beforeOwner } = await admin
      .from("responsibility_assignments" as never)
      .select("membership_id")
      .eq("area_id", area.data as string)
      .eq("role", "owner")
      .eq("status", "active")
      .single();
    expect((beforeOwner as any)?.membership_id).toBe(memA);

    const accepted = await crpc(userB.client, "accept_responsibility_transfer", {
      p_transfer_id: transfer.data,
    });
    expect(accepted.error).toBeNull();

    const { data: afterOwner } = await admin
      .from("responsibility_assignments" as never)
      .select("membership_id")
      .eq("area_id", area.data as string)
      .eq("role", "owner")
      .eq("status", "active")
      .single();
    expect((afterOwner as any)?.membership_id).toBe(memB);
  });

  it("[14] direct responsibility assignment overwrite fails", async () => {
    const area = await crpc<string>(userA.client, "create_responsibility_area", {
      p_household_id: householdA,
      p_name: `Direct-${runId}`,
      p_category: "bathroom",
      p_start_date: startDate,
    });
    expect(area.error).toBeNull();

    await crpc(userA.client, "assign_responsibility_area", {
      p_area_id: area.data,
      p_membership_id: memA,
      p_role: "owner",
    });

    const { error: insertErr } = await ctable(userA.client, "responsibility_assignments").insert({
      area_id: area.data,
      household_id: householdA,
      membership_id: memC,
      role: "owner",
    });
    expect(insertErr).toBeTruthy();

    const { data: forged } = await ctable(userA.client, "responsibility_assignments")
      .update({ membership_id: memC })
      .eq("area_id", area.data)
      .eq("role", "owner")
      .eq("status", "active")
      .select();
    expect((forged ?? []).length).toBe(0);

    const { data: owner } = await admin
      .from("responsibility_assignments" as never)
      .select("membership_id")
      .eq("area_id", area.data as string)
      .eq("role", "owner")
      .eq("status", "active")
      .single();
    expect((owner as any)?.membership_id).toBe(memA);
  });

  it("[15] cross-household SELECT on chore_definitions returns empty", async () => {
    const created = await createOneTimeChore(userA.client, { key: "rls-select" });
    expect(created.error).toBeNull();

    const { data: outsiderRows } = await ctable(userO.client, "chore_definitions")
      .select("id")
      .eq("household_id", householdA);
    expect((outsiderRows ?? []).length).toBe(0);

    const { data: memberRows } = await ctable(userA.client, "chore_definitions")
      .select("id")
      .eq("id", created.data);
    expect((memberRows ?? []).length).toBe(1);
  });

  it("[16] authenticated cannot call claim_chore_horizon_extensions", async () => {
    const denied = await crpc(userA.client, "claim_chore_horizon_extensions", {
      p_limit: 10,
    });
    expect(denied.error).toBeTruthy();
    expect(denied.error?.message.toLowerCase()).toMatch(
      /permission denied|service_role|not authorized|denied/,
    );

    const ok = await crpc<any[]>(admin, "claim_chore_horizon_extensions", {
      p_limit: 10,
    });
    expect(ok.error).toBeNull();
  });

  it("[11] removed/inactive member not assignable", async () => {
    const removed = await userA.client.rpc("remove_household_member", {
      p_household_id: householdA,
      p_membership_id: memC,
      p_reason: "integration test removal",
    });
    expect(removed.error).toBeNull();

    const denied = await createOneTimeChore(userA.client, {
      key: "removed-member",
      assignees: [memC],
    });
    expect(denied.error).toBeTruthy();
    expect(denied.error?.message.toLowerCase()).toMatch(
      /active member|not active|inactive|removed|invalid/,
    );
  });
});
