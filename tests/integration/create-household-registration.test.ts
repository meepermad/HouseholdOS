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

function hookEvent(email: string) {
  return {
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
      email,
      phone: "",
      app_metadata: { provider: "email", providers: ["email"] },
      user_metadata: {},
      identities: [],
      created_at: "0001-01-01T00:00:00Z",
      updated_at: "0001-01-01T00:00:00Z",
      is_anonymous: false,
    },
  };
}

describe.skipIf(!hasSupabase)("create-household registration invitations", () => {
  let admin: Admin;
  const createdUserIds: string[] = [];
  const householdIds: string[] = [];
  let issuer: Session;
  let member: Session;
  let householdId: string;
  const issuerEmail = `reg-iss-${runId}@${TEST_DOMAIN}`;
  const memberEmail = `reg-mem-${runId}@${TEST_DOMAIN}`;

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

    for (const email of [issuerEmail, memberEmail]) {
      const created = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      expect(created.error).toBeNull();
      createdUserIds.push(created.data.user!.id);
    }

    issuer = await authed(issuerEmail);
    member = await authed(memberEmail);

    await admin.from("platform_registration_issuers").upsert(
      {
        email: issuerEmail,
        note: `test issuer ${runId}`,
        created_by: issuer.userId,
      },
      { onConflict: "email" },
    );

    const created = await issuer.client.rpc("create_household_for_current_user", {
      p_name: `RegInv-${runId}`,
      p_acknowledge_reimbursement_policy: true,
      p_purchase_approval_threshold_cents: 5000,
      p_currency: "USD",
      p_timezone: "America/Chicago",
      p_idempotency_key: `idem-reg-inv-${runId}`,
    });
    expect(created.error).toBeNull();
    const row = Array.isArray(created.data) ? created.data[0] : created.data;
    householdId = row!.household_id;
    householdIds.push(householdId);

    // Add member without issuer rights
    const joinToken = generateInviteToken();
    await issuer.client.rpc("create_household_invitation", {
      p_household_id: householdId,
      p_email: memberEmail,
      p_token_hash: hashInviteToken(joinToken),
      p_expires_at: new Date(Date.now() + 3_600_000).toISOString(),
      p_intended_roles: ["member"],
    });
    await member.client.rpc("accept_household_invitation", {
      p_token_hash: hashInviteToken(joinToken),
    });
  }, 90_000);

  afterAll(async () => {
    void householdIds;
    await admin.from("platform_registration_issuers").delete().eq("email", issuerEmail);
    await admin
      .from("registration_invitations")
      .delete()
      .ilike("invited_email", `%${runId}%`);
    await cleanupTestHouseholdsByRunId(admin, runId);
    await deleteTestAuthUsers(admin, createdUserIds);
  });

  it("creates create_household invitation with no household_id or roles", async () => {
    const token = generateInviteToken();
    const inviteEmail = `Create-HH-${runId}@Example.COM`;
    const created = await issuer.client.rpc("create_registration_invitation", {
      p_email: inviteEmail,
      p_token_hash: hashInviteToken(token),
      p_expires_at: new Date(Date.now() + 3_600_000).toISOString(),
      p_purpose: "create_household",
      p_household_id: undefined,
      p_intended_roles: [],
    });
    expect(created.error).toBeNull();

    const { data: row } = await admin
      .from("registration_invitations")
      .select("invited_email, purpose, household_id, intended_roles, status")
      .eq("id", created.data as string)
      .single();

    expect(row?.invited_email).toBe(`create-hh-${runId}@example.com`);
    expect(row?.purpose).toBe("create_household");
    expect(row?.household_id).toBeNull();
    expect(row?.intended_roles).toEqual([]);
    expect(row?.status).toBe("pending");
  });

  it("rejects household roles for create_household purpose", async () => {
    const token = generateInviteToken();
    const rejected = await issuer.client.rpc("create_registration_invitation", {
      p_email: `roles-${runId}@example.com`,
      p_token_hash: hashInviteToken(token),
      p_expires_at: new Date(Date.now() + 3_600_000).toISOString(),
      p_purpose: "create_household",
      p_intended_roles: ["member"],
    });
    expect(rejected.error).not.toBeNull();
    expect(rejected.error!.message).toMatch(/must not include household roles/i);
  });

  it("rejects household_id for create_household purpose", async () => {
    const token = generateInviteToken();
    const rejected = await issuer.client.rpc("create_registration_invitation", {
      p_email: `hid-${runId}@example.com`,
      p_token_hash: hashInviteToken(token),
      p_expires_at: new Date(Date.now() + 3_600_000).toISOString(),
      p_purpose: "create_household",
      p_household_id: householdId,
      p_intended_roles: [],
    });
    expect(rejected.error).not.toBeNull();
    expect(rejected.error!.message).toMatch(/must not include a household_id/i);
  });

  it("Before User Created accepts valid create_household invitation", async () => {
    const email = `hook-ok-${runId}@example.com`;
    const token = generateInviteToken();
    await issuer.client.rpc("create_registration_invitation", {
      p_email: email,
      p_token_hash: hashInviteToken(token),
      p_expires_at: new Date(Date.now() + 3_600_000).toISOString(),
      p_purpose: "create_household",
    });

    const hook = await admin.rpc("hook_before_user_created", {
      event: hookEvent(email),
    });
    expect(hook.error).toBeNull();
    expect(JSON.stringify(hook.data)).toBe("{}");
  });

  it("hook rejects expired, revoked, and consumed invitations", async () => {
    const expiredEmail = `hook-exp-${runId}@example.com`;
    await admin.from("registration_invitations").insert({
      invited_email: expiredEmail,
      purpose: "create_household",
      household_id: null,
      intended_roles: [],
      token_hash: hashInviteToken(generateInviteToken()),
      status: "pending",
      expires_at: new Date(Date.now() - 60_000).toISOString(),
      created_by: issuer.userId,
    });
    const expiredHook = await admin.rpc("hook_before_user_created", {
      event: hookEvent(expiredEmail),
    });
    expect(JSON.stringify(expiredHook.data)).toContain("Registration is not available");

    const revokedEmail = `hook-rev-${runId}@example.com`;
    const revToken = generateInviteToken();
    const rev = await issuer.client.rpc("create_registration_invitation", {
      p_email: revokedEmail,
      p_token_hash: hashInviteToken(revToken),
      p_expires_at: new Date(Date.now() + 3_600_000).toISOString(),
    });
    await issuer.client.rpc("revoke_registration_invitation", {
      p_invitation_id: rev.data as string,
    });
    const revokedHook = await admin.rpc("hook_before_user_created", {
      event: hookEvent(revokedEmail),
    });
    expect(JSON.stringify(revokedHook.data)).toContain("Registration is not available");

    const consumedEmail = `hook-con-${runId}@example.com`;
    await admin.from("registration_invitations").insert({
      invited_email: consumedEmail,
      purpose: "create_household",
      household_id: null,
      intended_roles: [],
      token_hash: hashInviteToken(generateInviteToken()),
      status: "consumed",
      expires_at: new Date(Date.now() + 3_600_000).toISOString(),
      created_by: issuer.userId,
      consumed_at: new Date().toISOString(),
      auth_user_id: issuer.userId,
    });
    const consumedHook = await admin.rpc("hook_before_user_created", {
      event: hookEvent(consumedEmail),
    });
    expect(JSON.stringify(consumedHook.data)).toContain("Registration is not available");
  });

  it("wrong email is rejected on consume; invitation is single-use", async () => {
    const invited = `claim-${runId}@example.com`;
    const token = generateInviteToken();
    const tokenHash = hashInviteToken(token);
    await issuer.client.rpc("create_registration_invitation", {
      p_email: invited,
      p_token_hash: tokenHash,
      p_expires_at: new Date(Date.now() + 3_600_000).toISOString(),
    });

    const mismatch = await member.client.rpc("consume_registration_invitation", {
      p_token_hash: tokenHash,
    });
    expect(mismatch.error).not.toBeNull();
    expect(mismatch.error!.message).toMatch(/email mismatch/i);

    const inviteeCreated = await admin.auth.admin.createUser({
      email: invited,
      password,
      email_confirm: true,
    });
    expect(inviteeCreated.error).toBeNull();
    createdUserIds.push(inviteeCreated.data.user!.id);
    const invitee = await authed(invited);

    const first = await invitee.client.rpc("consume_registration_invitation", {
      p_token_hash: tokenHash,
    });
    expect(first.error).toBeNull();

    const second = await invitee.client.rpc("consume_registration_invitation", {
      p_token_hash: tokenHash,
    });
    expect(second.error).not.toBeNull();
    expect(second.error!.message).toMatch(/already consumed/i);
  });

  it("household creation assigns three roles and does not join inviter household", async () => {
    const email = `indie-${runId}@example.com`;
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    expect(created.error).toBeNull();
    createdUserIds.push(created.data.user!.id);
    const indie = await authed(email);

    const token = generateInviteToken();
    await issuer.client.rpc("create_registration_invitation", {
      p_email: email,
      p_token_hash: hashInviteToken(token),
      p_expires_at: new Date(Date.now() + 3_600_000).toISOString(),
    });
    await indie.client.rpc("consume_registration_invitation", {
      p_token_hash: hashInviteToken(token),
    });

    const hh = await indie.client.rpc("create_household_for_current_user", {
      p_name: `Indie-${runId}`,
      p_acknowledge_reimbursement_policy: true,
      p_purchase_approval_threshold_cents: 5000,
      p_currency: "USD",
      p_timezone: "America/Chicago",
      p_idempotency_key: `idem-indie-${runId}`,
    });
    expect(hh.error).toBeNull();
    const hhRow = Array.isArray(hh.data) ? hh.data[0] : hh.data;
    const newHouseholdId = hhRow!.household_id;
    householdIds.push(newHouseholdId);

    // Idempotent retry
    const retry = await indie.client.rpc("create_household_for_current_user", {
      p_name: `Indie-${runId}-retry`,
      p_acknowledge_reimbursement_policy: true,
      p_purchase_approval_threshold_cents: 5000,
      p_currency: "USD",
      p_timezone: "America/Chicago",
      p_idempotency_key: `idem-indie-${runId}`,
    });
    expect(retry.error).toBeNull();
    const retryRow = Array.isArray(retry.data) ? retry.data[0] : retry.data;
    expect(retryRow!.household_id).toBe(newHouseholdId);

    const { data: roles } = await admin
      .from("household_membership_roles")
      .select("role, household_memberships!inner(household_id, user_id, status)")
      .eq("household_memberships.household_id", newHouseholdId)
      .eq("household_memberships.user_id", indie.userId);
    const roleSet = new Set((roles ?? []).map((r) => r.role));
    expect(roleSet.has("member")).toBe(true);
    expect(roleSet.has("household_coordinator")).toBe(true);
    expect(roleSet.has("financial_coordinator")).toBe(true);

    const { data: inviterMembership } = await admin
      .from("household_memberships")
      .select("id")
      .eq("household_id", householdId)
      .eq("user_id", indie.userId)
      .maybeSingle();
    expect(inviterMembership).toBeNull();

    // Isolation: indie cannot read inviter household settings
    const { data: leaked, error: leakError } = await indie.client
      .from("household_settings")
      .select("household_id")
      .eq("household_id", householdId)
      .maybeSingle();
    expect(leakError).toBeNull();
    expect(leaked).toBeNull();
  });

  it("unauthorized member cannot issue platform registration grants", async () => {
    const token = generateInviteToken();
    const denied = await member.client.rpc("create_registration_invitation", {
      p_email: `denied-${runId}@example.com`,
      p_token_hash: hashInviteToken(token),
      p_expires_at: new Date(Date.now() + 3_600_000).toISOString(),
      p_purpose: "create_household",
    });
    expect(denied.error).not.toBeNull();
    expect(denied.error!.message).toMatch(/not allowed/i);
  });

  it("join_household invitations continue working alongside create grants", async () => {
    const joinEmail = `join-still-${runId}@example.com`;
    const joinToken = generateInviteToken();
    const join = await issuer.client.rpc("create_household_invitation", {
      p_household_id: householdId,
      p_email: joinEmail,
      p_token_hash: hashInviteToken(joinToken),
      p_expires_at: new Date(Date.now() + 3_600_000).toISOString(),
      p_intended_roles: ["member"],
    });
    expect(join.error).toBeNull();

    const hook = await admin.rpc("hook_before_user_created", {
      event: hookEvent(joinEmail),
    });
    expect(JSON.stringify(hook.data)).toBe("{}");

    const preview = await admin.rpc("get_invitation_preview", {
      p_token_hash: hashInviteToken(joinToken),
    });
    const row = Array.isArray(preview.data) ? preview.data[0] : preview.data;
    expect(row?.status).toBe("pending");
  });

  it("creating another household does not auto-accept pending join invitation", async () => {
    const email = `dual-${runId}@example.com`;
    const user = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    expect(user.error).toBeNull();
    createdUserIds.push(user.data.user!.id);
    const dual = await authed(email);

    const joinToken = generateInviteToken();
    await issuer.client.rpc("create_household_invitation", {
      p_household_id: householdId,
      p_email: email,
      p_token_hash: hashInviteToken(joinToken),
      p_expires_at: new Date(Date.now() + 3_600_000).toISOString(),
      p_intended_roles: ["member"],
    });

    const createToken = generateInviteToken();
    await issuer.client.rpc("create_registration_invitation", {
      p_email: email,
      p_token_hash: hashInviteToken(createToken),
      p_expires_at: new Date(Date.now() + 3_600_000).toISOString(),
    });
    await dual.client.rpc("consume_registration_invitation", {
      p_token_hash: hashInviteToken(createToken),
    });

    const hh = await dual.client.rpc("create_household_for_current_user", {
      p_name: `Dual-${runId}`,
      p_acknowledge_reimbursement_policy: true,
      p_purchase_approval_threshold_cents: 5000,
      p_currency: "USD",
      p_timezone: "America/Chicago",
      p_idempotency_key: `idem-dual-${runId}`,
    });
    expect(hh.error).toBeNull();
    const hhRow = Array.isArray(hh.data) ? hh.data[0] : hh.data;
    householdIds.push(hhRow!.household_id);

    const { data: joinInvite } = await admin
      .from("household_invitations")
      .select("status")
      .eq("household_id", householdId)
      .eq("invited_email", email)
      .eq("status", "pending")
      .maybeSingle();
    expect(joinInvite?.status).toBe("pending");

    const { data: membership } = await admin
      .from("household_memberships")
      .select("id")
      .eq("household_id", householdId)
      .eq("user_id", dual.userId)
      .maybeSingle();
    expect(membership).toBeNull();
  });
});
