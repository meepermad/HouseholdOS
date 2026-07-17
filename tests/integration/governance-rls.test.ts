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
const runId = `gov-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const password = "Test-Password-123!";

type Admin = SupabaseClient<Database>;
type Session = {
  email: string;
  userId: string;
  client: SupabaseClient<Database>;
};

function crpc<T = unknown>(
  client: SupabaseClient<Database>,
  fn: string,
  args: Record<string, unknown>,
) {
  return (client as any).rpc(fn, args) as Promise<{
    data: T;
    error: { message: string } | null;
  }>;
}

describe.skipIf(!hasSupabase)("Phase 8 governance RLS + RPCs", () => {
  let admin: Admin;
  const createdUserIds: string[] = [];
  let householdA: string;
  let householdB: string;
  let userA: Session;
  let userB: Session;
  let userOutsider: Session;
  let memA: string;
  let memB: string;

  const emailA = `ga-${runId}@${TEST_DOMAIN}`;
  const emailB = `gb-${runId}@${TEST_DOMAIN}`;
  const emailO = `go-${runId}@${TEST_DOMAIN}`;

  async function authed(email: string): Promise<Session> {
    const session = await getAuthedClient(email, password);
    return { email, client: session.client, userId: session.userId };
  }

  async function membershipId(householdId: string, userId: string) {
    const { data } = await admin
      .from("household_memberships")
      .select("id")
      .eq("household_id", householdId)
      .eq("user_id", userId)
      .single();
    return data!.id as string;
  }

  beforeAll(async () => {
    admin = createClient<Database>(url!, secretKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    for (const email of [emailA, emailB, emailO]) {
      const created = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (created.error) throw created.error;
      createdUserIds.push(created.data.user!.id);
    }

    userA = await authed(emailA);
    const created = await userA.client.rpc("create_household_for_current_user", {
      p_name: `Gov A ${runId}`,
      p_acknowledge_reimbursement_policy: true,
      p_idempotency_key: `${runId}-hhA`,
    });
    expect(created.error).toBeNull();
    const rowA = Array.isArray(created.data) ? created.data[0] : created.data;
    householdA = (rowA as { household_id: string }).household_id;
    memA = (rowA as { membership_id: string }).membership_id;

    const token = generateInviteToken();
    const invite = await crpc(userA.client, "create_household_invitation", {
      p_household_id: householdA,
      p_email: emailB,
      p_token_hash: hashInviteToken(token),
      p_expires_at: new Date(Date.now() + 3_600_000).toISOString(),
      p_intended_roles: ["member"],
    });
    expect(invite.error).toBeNull();
    userB = await authed(emailB);
    const accept = await crpc(userB.client, "accept_household_invitation", {
      p_token_hash: hashInviteToken(token),
    });
    expect(accept.error).toBeNull();
    memB = await membershipId(householdA, userB.userId);

    userOutsider = await authed(emailO);
    const other = await userOutsider.client.rpc(
      "create_household_for_current_user",
      {
        p_name: `Gov B ${runId}`,
        p_acknowledge_reimbursement_policy: true,
        p_idempotency_key: `${runId}-hhB`,
      },
    );
    expect(other.error).toBeNull();
    const rowB = Array.isArray(other.data) ? other.data[0] : other.data;
    householdB = (rowB as { household_id: string }).household_id;
  }, 120_000);

  afterAll(async () => {
    try {
      await cleanupTestHouseholdsByRunId(admin, runId);
    } finally {
      await deleteTestAuthUsers(admin, createdUserIds);
    }
  });

  it("rejects direct client inserts into governance tables", async () => {
    const attempt = await (userA.client as any)
      .from("governance_documents")
      .insert({
        household_id: householdA,
        document_class: "custom",
        title: "Direct write",
        created_by_membership_id: memA,
      });
    expect(attempt.error).toBeTruthy();
  });

  it("isolates private drafts across households and non-participants", async () => {
    const created = await crpc<string>(userA.client, "create_governance_document", {
      p_household_id: householdA,
      p_document_class: "house_rules",
      p_title: `Quiet hours ${runId}`,
      p_summary: "Private draft",
      p_visibility: "private_draft",
      p_sections: [
        {
          section_type: "rule",
          heading: "Quiet hours",
          body: "Keep it reasonable after 11pm",
        },
      ],
    });
    expect(created.error).toBeNull();
    const docId = created.data!;

    const outsiderRead = await (userOutsider.client as any)
      .from("governance_documents")
      .select("id")
      .eq("id", docId)
      .maybeSingle();
    expect(outsiderRead.data).toBeNull();

    const memberRead = await (userB.client as any)
      .from("governance_documents")
      .select("id")
      .eq("id", docId)
      .maybeSingle();
    expect(memberRead.data).toBeNull();

    const authorRead = await (userA.client as any)
      .from("governance_documents")
      .select("id, status")
      .eq("id", docId)
      .single();
    expect(authorRead.error).toBeNull();
    expect(authorRead.data.status).toBe("draft");
  });

  it("proposes, responds, and does not allow approving for another member", async () => {
    const created = await crpc<string>(userA.client, "create_governance_document", {
      p_household_id: householdA,
      p_document_class: "guest_policy",
      p_title: `Guests ${runId}`,
      p_visibility: "participants",
      p_participant_membership_ids: [memB],
      p_sections: [{ section_type: "rule", heading: "Guests", body: "Give notice" }],
      p_approval_rules: { mode: "unanimous", quorum: 2 },
    });
    expect(created.error).toBeNull();
    const docId = created.data!;

    const proposed = await crpc<string>(userA.client, "propose_governance_version", {
      p_document_id: docId,
    });
    expect(proposed.error).toBeNull();
    const requestId = proposed.data!;

    const aApprove = await crpc(userA.client, "respond_to_governance_approval", {
      p_request_id: requestId,
      p_decision: "approve",
    });
    expect(aApprove.error).toBeNull();

    const bApprove = await crpc(userB.client, "respond_to_governance_approval", {
      p_request_id: requestId,
      p_decision: "approve",
    });
    expect(bApprove.error).toBeNull();

    // Responses are keyed to the authenticated membership — no on-behalf-of
    const responses = await (userA.client as any)
      .from("governance_approval_responses")
      .select("responder_membership_id, decision")
      .eq("request_id", requestId);
    const responders = new Set(
      (responses.data ?? []).map((r: { responder_membership_id: string }) =>
        r.responder_membership_id,
      ),
    );
    expect(responders.has(memA)).toBe(true);
    expect(responders.has(memB)).toBe(true);
  });

  it("blocks outsider transition access and requires confirmation notes", async () => {
    const created = await crpc<string>(userA.client, "create_household_transition", {
      p_household_id: householdA,
      p_workflow_type: "move_out",
      p_subject_membership_id: memB,
    });
    expect(created.error).toBeNull();
    const workflowId = created.data!;

    const outsider = await (userOutsider.client as any)
      .from("household_transition_workflows")
      .select("id")
      .eq("id", workflowId)
      .maybeSingle();
    expect(outsider.data).toBeNull();

    const tasks = await (userA.client as any)
      .from("household_transition_tasks")
      .select("id, task_key, requires_explicit_confirmation")
      .eq("workflow_id", workflowId);
    const deposit = (tasks.data ?? []).find(
      (t: { task_key: string }) => t.task_key === "deposit_discussion",
    );
    expect(deposit).toBeTruthy();

    const missingNote = await crpc(
      userA.client,
      "complete_household_transition_task",
      { p_task_id: deposit.id },
    );
    expect(missingNote.error?.message).toMatch(/explicit confirmation/i);

    void householdB;
  });
});
