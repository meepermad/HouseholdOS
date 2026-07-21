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
const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const password = "Test-Password-123!";

type Admin = SupabaseClient<Database>;
type Session = {
  email: string;
  userId: string;
  client: SupabaseClient<Database>;
};

async function authed(email: string): Promise<Session> {
  const session = await getAuthedClient(email, password);
  return { email, client: session.client, userId: session.userId };
}

describe.skipIf(!hasSupabase)("invitation orchestration + Auth hook", () => {
  let admin: Admin;
  const createdUserIds: string[] = [];
  const householdIds: string[] = [];
  let coordinator: Session;
  let member: Session;
  let outsider: Session;
  let householdId: string;

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

    const emails = [
      `inv-orch-a-${runId}@${TEST_DOMAIN}`,
      `inv-orch-b-${runId}@${TEST_DOMAIN}`,
      `inv-orch-c-${runId}@${TEST_DOMAIN}`,
    ];
    for (const email of emails) {
      const created = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      expect(created.error).toBeNull();
      createdUserIds.push(created.data.user!.id);
    }

    coordinator = await authed(emails[0]!);
    member = await authed(emails[1]!);
    outsider = await authed(emails[2]!);

    const created = await coordinator.client.rpc(
      "create_household_for_current_user",
      {
        p_name: `InvOrch-${runId}`,
        p_acknowledge_reimbursement_policy: true,
        p_purchase_approval_threshold_cents: 5000,
        p_currency: "USD",
        p_timezone: "America/Chicago",
        p_idempotency_key: `idem-inv-orch-${runId}`,
      },
    );
    expect(created.error).toBeNull();
    const row = Array.isArray(created.data) ? created.data[0] : created.data;
    householdId = row!.household_id;
    householdIds.push(householdId);
  }, 60_000);

  afterAll(async () => {
    void householdIds;
    await cleanupTestHouseholdsByRunId(admin, runId);
    await deleteTestAuthUsers(admin, createdUserIds);
  });

  it("normalizes email and commits pending invitation before hook check", async () => {
    const token = generateInviteToken();
    const mixed = `Invitee-${runId}@Example.COM`;
    const created = await coordinator.client.rpc("create_household_invitation", {
      p_household_id: householdId,
      p_email: mixed,
      p_token_hash: hashInviteToken(token),
      p_expires_at: new Date(Date.now() + 3_600_000).toISOString(),
      p_intended_roles: ["member"],
    });
    expect(created.error).toBeNull();

    const { data: row } = await admin
      .from("household_invitations")
      .select("invited_email, status, expires_at, delivery_status")
      .eq("id", created.data as string)
      .single();

    expect(row?.invited_email).toBe(`invitee-${runId}@example.com`);
    expect(row?.status).toBe("pending");
    expect(new Date(row!.expires_at).getTime()).toBeGreaterThan(Date.now());
    expect(row?.delivery_status).toBe("not_attempted");

    const hook = await admin.rpc("hook_before_user_created", {
      event: {
        metadata: {
          uuid: "11111111-1111-4111-8111-111111111111",
          time: new Date().toISOString(),
          name: "before-user-created",
          ip_address: "127.0.0.1",
        },
        user: {
          id: "44444444-4444-4444-8444-444444444444",
          aud: "authenticated",
          role: "",
          email: `Invitee-${runId}@Example.COM`,
          phone: "",
          app_metadata: { provider: "email", providers: ["email"] },
          user_metadata: { householdos_invite: "true" },
          identities: [],
          created_at: "0001-01-01T00:00:00Z",
          updated_at: "0001-01-01T00:00:00Z",
          is_anonymous: false,
        },
      },
    });
    expect(hook.error).toBeNull();
    expect(JSON.stringify(hook.data)).toBe("{}");
  });

  it("rejects expired and revoked invitations in the Auth hook", async () => {
    const expiredEmail = `expired-${runId}@example.com`;
    await admin.from("household_invitations").insert({
      household_id: householdId,
      invited_email: expiredEmail,
      invited_by: coordinator.userId,
      token_hash: hashInviteToken(generateInviteToken()),
      expires_at: new Date(Date.now() - 60_000).toISOString(),
      intended_roles: ["member"],
      status: "pending",
    });

    const expiredHook = await admin.rpc("hook_before_user_created", {
      event: {
        metadata: {
          uuid: "11111111-1111-4111-8111-111111111111",
          time: new Date().toISOString(),
          name: "before-user-created",
          ip_address: "127.0.0.1",
        },
        user: {
          id: "55555555-5555-4555-8555-555555555555",
          aud: "authenticated",
          role: "",
          email: expiredEmail,
          phone: "",
          app_metadata: {},
          user_metadata: {},
          identities: [],
          created_at: "0001-01-01T00:00:00Z",
          updated_at: "0001-01-01T00:00:00Z",
          is_anonymous: false,
        },
      },
    });
    expect((expiredHook.data as { error?: unknown })?.error).toBeTruthy();

    const revokeToken = generateInviteToken();
    const created = await coordinator.client.rpc("create_household_invitation", {
      p_household_id: householdId,
      p_email: `revoked-${runId}@example.com`,
      p_token_hash: hashInviteToken(revokeToken),
      p_expires_at: new Date(Date.now() + 3_600_000).toISOString(),
    });
    await coordinator.client.rpc("revoke_household_invitation", {
      p_household_id: householdId,
      p_invitation_id: created.data as string,
    });

    const revokedHook = await admin.rpc("hook_before_user_created", {
      event: {
        metadata: {
          uuid: "11111111-1111-4111-8111-111111111111",
          time: new Date().toISOString(),
          name: "before-user-created",
          ip_address: "127.0.0.1",
        },
        user: {
          id: "66666666-6666-4666-8666-666666666666",
          aud: "authenticated",
          role: "",
          email: `revoked-${runId}@example.com`,
          phone: "",
          app_metadata: {},
          user_metadata: {},
          identities: [],
          created_at: "0001-01-01T00:00:00Z",
          updated_at: "0001-01-01T00:00:00Z",
          is_anonymous: false,
        },
      },
    });
    expect((revokedHook.data as { error?: unknown })?.error).toBeTruthy();
  });

  it("prevents duplicate pending invitations for the same email", async () => {
    const email = `dup-${runId}@example.com`;
    const first = await coordinator.client.rpc("create_household_invitation", {
      p_household_id: householdId,
      p_email: email,
      p_token_hash: hashInviteToken(generateInviteToken()),
      p_expires_at: new Date(Date.now() + 3_600_000).toISOString(),
    });
    expect(first.error).toBeNull();

    const second = await coordinator.client.rpc("create_household_invitation", {
      p_household_id: householdId,
      p_email: email,
      p_token_hash: hashInviteToken(generateInviteToken()),
      p_expires_at: new Date(Date.now() + 3_600_000).toISOString(),
    });
    expect(second.error).toBeNull();
    expect(second.data).not.toBe(first.data);

    const { data: pending } = await admin
      .from("household_invitations")
      .select("id, status")
      .eq("household_id", householdId)
      .eq("invited_email", email)
      .eq("status", "pending");
    expect(pending).toHaveLength(1);
    expect(pending![0]!.id).toBe(second.data);

    const { data: revoked } = await admin
      .from("household_invitations")
      .select("id")
      .eq("id", first.data as string)
      .eq("status", "revoked");
    expect(revoked).toHaveLength(1);
  });

  it("records delivery status without changing invitation lifecycle", async () => {
    const token = generateInviteToken();
    const created = await coordinator.client.rpc("create_household_invitation", {
      p_household_id: householdId,
      p_email: `delivery-${runId}@example.com`,
      p_token_hash: hashInviteToken(token),
      p_expires_at: new Date(Date.now() + 3_600_000).toISOString(),
    });
    expect(created.error).toBeNull();

    const recorded = await coordinator.client.rpc("record_invitation_delivery", {
      p_household_id: householdId,
      p_invitation_id: created.data as string,
      p_delivery_status: "failed",
      p_error_category: "delivery_failed",
    });
    expect(recorded.error).toBeNull();

    const { data: row } = await admin
      .from("household_invitations")
      .select("status, delivery_status, delivery_error_category, expires_at")
      .eq("id", created.data as string)
      .single();
    expect(row?.status).toBe("pending");
    expect(row?.delivery_status).toBe("failed");
    expect(row?.delivery_error_category).toBe("delivery_failed");
    expect(new Date(row!.expires_at).getTime()).toBeGreaterThan(Date.now());
  });

  it("blocks cross-household and unauthorized member invites", async () => {
    const other = await outsider.client.rpc("create_household_for_current_user", {
      p_name: `InvOrch-Other-${runId}`,
      p_acknowledge_reimbursement_policy: true,
      p_purchase_approval_threshold_cents: 5000,
      p_idempotency_key: `idem-inv-orch-other-${runId}`,
    });
    expect(other.error).toBeNull();
    const otherRow = Array.isArray(other.data) ? other.data[0] : other.data;
    householdIds.push(otherRow!.household_id);

    const cross = await coordinator.client.rpc("create_household_invitation", {
      p_household_id: otherRow!.household_id,
      p_email: `cross-${runId}@example.com`,
      p_token_hash: hashInviteToken(generateInviteToken()),
      p_expires_at: new Date(Date.now() + 3_600_000).toISOString(),
    });
    expect(cross.error).toBeTruthy();

    // Promote member without coordinator responsibility via direct membership.
    const token = generateInviteToken();
    await coordinator.client.rpc("create_household_invitation", {
      p_household_id: householdId,
      p_email: member.email,
      p_token_hash: hashInviteToken(token),
      p_expires_at: new Date(Date.now() + 3_600_000).toISOString(),
    });
    await member.client.rpc("accept_household_invitation", {
      p_token_hash: hashInviteToken(token),
    });

    const unauthorized = await member.client.rpc("create_household_invitation", {
      p_household_id: householdId,
      p_email: `nope-${runId}@example.com`,
      p_token_hash: hashInviteToken(generateInviteToken()),
      p_expires_at: new Date(Date.now() + 3_600_000).toISOString(),
    });
    expect(unauthorized.error).toBeTruthy();
  });

  it("accepts invitation once and allows creating another household afterward", async () => {
    const token = generateInviteToken();
    await coordinator.client.rpc("create_household_invitation", {
      p_household_id: householdId,
      p_email: outsider.email,
      p_token_hash: hashInviteToken(token),
      p_expires_at: new Date(Date.now() + 3_600_000).toISOString(),
      p_intended_roles: ["member"],
    });

    const first = await outsider.client.rpc("accept_household_invitation", {
      p_token_hash: hashInviteToken(token),
    });
    expect(first.error).toBeNull();
    expect(first.data).toBe(householdId);

    const replay = await outsider.client.rpc("accept_household_invitation", {
      p_token_hash: hashInviteToken(token),
    });
    // Idempotent accept or already-used — still one membership.
    void replay;

    const { count } = await admin
      .from("household_memberships")
      .select("*", { count: "exact", head: true })
      .eq("household_id", householdId)
      .eq("user_id", outsider.userId)
      .eq("status", "active");
    expect(count).toBe(1);

    const secondHouse = await outsider.client.rpc(
      "create_household_for_current_user",
      {
        p_name: `InvOrch-Second-${runId}`,
        p_acknowledge_reimbursement_policy: true,
        p_purchase_approval_threshold_cents: 5000,
        p_idempotency_key: `idem-inv-orch-second-${runId}`,
      },
    );
    expect(secondHouse.error).toBeNull();
    const secondRow = Array.isArray(secondHouse.data)
      ? secondHouse.data[0]
      : secondHouse.data;
    householdIds.push(secondRow!.household_id);

    const { data: mems } = await admin
      .from("household_memberships")
      .select("household_id, status, household_membership_roles(role)")
      .eq("user_id", outsider.userId)
      .eq("status", "active");

    expect((mems ?? []).length).toBeGreaterThanOrEqual(2);
    const original = (mems ?? []).find((m) => m.household_id === householdId);
    const created = (mems ?? []).find(
      (m) => m.household_id === secondRow!.household_id,
    );
    expect(original).toBeTruthy();
    expect(created).toBeTruthy();
    const createdRoles = (
      (created?.household_membership_roles as { role: string }[] | null) ?? []
    ).map((r) => r.role);
    expect(createdRoles).toContain("household_coordinator");
  });
});
