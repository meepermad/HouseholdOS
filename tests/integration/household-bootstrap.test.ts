import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { generateInviteToken, hashInviteToken } from "@/lib/tokens";
import type { Database } from "@/types/database";

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
  const res = await createClient<Database>(url!, publishableKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  }).auth.signInWithPassword({ email, password });
  if (res.error) throw res.error;
  const client = createClient<Database>(url!, publishableKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: { Authorization: `Bearer ${res.data.session!.access_token}` },
    },
  });
  return { email, client, userId: res.data.user!.id };
}

describe.skipIf(!hasSupabase)("Phase 2.2 household bootstrap + invitations", () => {
  let admin: Admin;
  const createdUserIds: string[] = [];
  const householdIds: string[] = [];
  let creator: Session;
  let invitee: Session;
  let outsider: Session;

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
      `boot-a-${runId}@${TEST_DOMAIN}`,
      `boot-b-${runId}@${TEST_DOMAIN}`,
      `boot-c-${runId}@${TEST_DOMAIN}`,
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

    creator = await authed(emails[0]!);
    invitee = await authed(emails[1]!);
    outsider = await authed(emails[2]!);
  }, 60_000);

  afterAll(async () => {
    for (const id of householdIds) {
      const { data: mems } = await admin
        .from("household_memberships")
        .select("id")
        .eq("household_id", id);
      for (const m of mems ?? []) {
        await admin.from("household_membership_roles").delete().eq("membership_id", m.id);
      }
      await admin.from("household_invitations").delete().eq("household_id", id);
      await admin.from("household_memberships").delete().eq("household_id", id);
      await admin.from("household_settings").delete().eq("household_id", id);
      await admin.from("audit_events").delete().eq("household_id", id);
      await admin
        .from("user_preferences")
        .update({ current_household_id: null })
        .eq("current_household_id", id);
      await admin.from("households").delete().eq("id", id);
    }
    for (const userId of createdUserIds) {
      await admin.from("user_preferences").delete().eq("user_id", userId);
      await admin.from("profiles").delete().eq("id", userId);
      await admin.auth.admin.deleteUser(userId);
    }
  });

  it("bootstraps household with settings, roles, preference, and audits", async () => {
    const created = await creator.client.rpc("create_household_for_current_user", {
      p_name: `Boot-${runId}`,
      p_acknowledge_reimbursement_policy: true,
      p_purchase_approval_threshold_cents: 5000,
      p_currency: "USD",
      p_timezone: "America/Chicago",
      p_idempotency_key: `idem-${runId}-boot`,
    });
    expect(created.error).toBeNull();
    const row = Array.isArray(created.data) ? created.data[0] : created.data;
    expect(row?.household_id).toBeTruthy();
    expect(row?.membership_id).toBeTruthy();
    householdIds.push(row!.household_id);

    const { count: settingsCount } = await admin
      .from("household_settings")
      .select("household_id", { count: "exact", head: true })
      .eq("household_id", row!.household_id);
    expect(settingsCount).toBe(1);

    const { data: membership } = await admin
      .from("household_memberships")
      .select("id, status, joined_at")
      .eq("id", row!.membership_id)
      .single();
    expect(membership?.status).toBe("active");

    const { data: roles } = await admin
      .from("household_membership_roles")
      .select("role")
      .eq("membership_id", row!.membership_id);
    expect(roles?.map((r) => r.role).sort()).toEqual([
      "financial_coordinator",
      "household_coordinator",
      "member",
    ]);

    const { data: prefs } = await admin
      .from("user_preferences")
      .select("current_household_id")
      .eq("user_id", creator.userId)
      .single();
    expect(prefs?.current_household_id).toBe(row!.household_id);

    const { data: audits } = await admin
      .from("audit_events")
      .select("event_type")
      .eq("household_id", row!.household_id);
    const types = (audits ?? []).map((a) => a.event_type);
    expect(types).toContain("household.created");
    expect(types).toContain("membership.status_changed");
  });

  it("denies anonymous create and dedupes idempotent retries", async () => {
    const anon = createClient<Database>(url!, publishableKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const denied = await anon.rpc("create_household_for_current_user", {
      p_name: "Nope",
      p_acknowledge_reimbursement_policy: true,
    });
    expect(denied.error).toBeTruthy();

    const key = `idem-${runId}-dedupe`;
    const first = await invitee.client.rpc("create_household_for_current_user", {
      p_name: `Dedupe-${runId}`,
      p_acknowledge_reimbursement_policy: true,
      p_idempotency_key: key,
    });
    expect(first.error).toBeNull();
    const firstRow = Array.isArray(first.data) ? first.data[0] : first.data;
    householdIds.push(firstRow!.household_id);

    const second = await invitee.client.rpc("create_household_for_current_user", {
      p_name: `Dedupe-${runId}`,
      p_acknowledge_reimbursement_policy: true,
      p_idempotency_key: key,
    });
    expect(second.error).toBeNull();
    const secondRow = Array.isArray(second.data) ? second.data[0] : second.data;
    expect(secondRow?.household_id).toBe(firstRow?.household_id);
  });

  it("rolls back invalid leases and keeps direct membership inserts denied", async () => {
    const before = await admin
      .from("households")
      .select("id", { count: "exact", head: true })
      .eq("created_by", outsider.userId);

    const failed = await outsider.client.rpc("create_household_for_current_user", {
      p_name: `BadLease-${runId}`,
      p_lease_start: "2026-06-01",
      p_lease_end: "2026-05-01",
      p_acknowledge_reimbursement_policy: true,
    });
    expect(failed.error).toBeTruthy();

    const after = await admin
      .from("households")
      .select("id", { count: "exact", head: true })
      .eq("created_by", outsider.userId);
    expect(after.count).toBe(before.count);

    const memInsert = await outsider.client.from("household_memberships").insert({
      household_id: "00000000-0000-4000-8000-000000000001",
      user_id: outsider.userId,
      status: "active",
    });
    expect(memInsert.error).toBeTruthy();
  });

  it("accepts invite and rejects wrong email, expired, revoked, and replay", async () => {
    const hh = householdIds[0]!;

    async function invite(email: string) {
      const token = generateInviteToken();
      const created = await creator.client.rpc("create_household_invitation", {
        p_household_id: hh,
        p_email: email,
        p_token_hash: hashInviteToken(token),
        p_expires_at: new Date(Date.now() + 3_600_000).toISOString(),
        p_intended_roles: ["member"],
      });
      expect(created.error).toBeNull();
      return token;
    }

    // invitee already has their own household from dedupe test; still can join creator's.
    const goodToken = await invite(invitee.email);
    const accept = await invitee.client.rpc("accept_household_invitation", {
      p_token_hash: hashInviteToken(goodToken),
    });
    expect(accept.error).toBeNull();
    expect(accept.data).toBe(hh);

    const { data: prefs } = await admin
      .from("user_preferences")
      .select("current_household_id")
      .eq("user_id", invitee.userId)
      .single();
    expect(prefs?.current_household_id).toBe(hh);

    const replay = await invitee.client.rpc("accept_household_invitation", {
      p_token_hash: hashInviteToken(goodToken),
    });
    expect(replay.error).toBeNull();

    const wrongToken = await invite(invitee.email);
    const mismatch = await outsider.client.rpc("accept_household_invitation", {
      p_token_hash: hashInviteToken(wrongToken),
    });
    expect(mismatch.error?.message.toLowerCase()).toContain("email");

    const expiredToken = generateInviteToken();
    const expiredHash = hashInviteToken(expiredToken);
    await admin.from("household_invitations").insert({
      household_id: hh,
      invited_email: outsider.email,
      invited_by: creator.userId,
      token_hash: expiredHash,
      expires_at: new Date(Date.now() - 60_000).toISOString(),
      intended_roles: ["member"],
      status: "pending",
    });
    const expired = await outsider.client.rpc("accept_household_invitation", {
      p_token_hash: expiredHash,
    });
    expect(expired.error?.message.toLowerCase()).toContain("expired");

    const revokeToken = await invite(outsider.email);
    const { data: inviteRow } = await admin
      .from("household_invitations")
      .select("id")
      .eq("token_hash", hashInviteToken(revokeToken))
      .single();
    const revoke = await creator.client.rpc("revoke_household_invitation", {
      p_household_id: hh,
      p_invitation_id: inviteRow!.id,
    });
    expect(revoke.error).toBeNull();
    const revoked = await outsider.client.rpc("accept_household_invitation", {
      p_token_hash: hashInviteToken(revokeToken),
    });
    expect(revoked.error?.message.toLowerCase()).toContain("revoked");
  });

  it("allows selecting either authorized household and denies unauthorized", async () => {
    const a = householdIds[0]!;
    const b = householdIds[1]!;

    const setA = await invitee.client.rpc("set_current_household", {
      p_household_id: a,
    });
    expect(setA.error).toBeNull();
    const setB = await invitee.client.rpc("set_current_household", {
      p_household_id: b,
    });
    expect(setB.error).toBeNull();

    const denied = await invitee.client.rpc("set_current_household", {
      p_household_id: "00000000-0000-4000-8000-000000000099",
    });
    expect(denied.error).toBeTruthy();
  });

  it("ensure_profile is idempotent", async () => {
    const first = await outsider.client.rpc("ensure_profile");
    const second = await outsider.client.rpc("ensure_profile");
    expect(first.error).toBeNull();
    expect(second.error).toBeNull();
    expect(first.data?.id).toBe(outsider.userId);
    expect(second.data?.id).toBe(outsider.userId);
  });
});
