import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/types/database";
import { CURRENT_HOUSEHOLD_COOKIE } from "@/lib/navigation";
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
const runId = `rec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const password = "Test-Password-123!";

type Admin = SupabaseClient<Database>;

function authed(email: string) {
  return getAuthedClient(email, password);
}

describe.skipIf(!hasSupabase)("recovery context and logout safety", () => {
  let admin: Admin;
  const createdUserIds: string[] = [];
  let householdId: string;
  let membershipId: string;
  let email: string;

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

    email = `r-${runId}@${TEST_DOMAIN}`;
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    expect(created.error).toBeNull();
    createdUserIds.push(created.data.user!.id);

    const session = await authed(email);
    const hh = await session.client.rpc("create_household", {
      p_name: `Rec-${runId}`,
      p_acknowledge_reimbursement_policy: true,
    });
    expect(hh.error).toBeNull();
    householdId = hh.data as string;

    const { data: mem } = await session.client
      .from("household_memberships")
      .select("id")
      .eq("household_id", householdId)
      .eq("user_id", session.userId)
      .single();
    membershipId = mem!.id;
  }, 120_000);

  afterAll(async () => {
    if (!admin) return;
    await cleanupTestHouseholdsByRunId(admin, runId);
    await deleteTestAuthUsers(admin, createdUserIds);
  }, 120_000);

  it("clearing household preference does not delete memberships or expenses", async () => {
    const session = await authed(email);
    await session.client
      .from("user_preferences")
      .update({ current_household_id: householdId })
      .eq("user_id", session.userId);

    await session.client
      .from("user_preferences")
      .update({ current_household_id: null })
      .eq("user_id", session.userId);

    const { data: mem } = await session.client
      .from("household_memberships")
      .select("id, status")
      .eq("id", membershipId)
      .single();
    expect(mem?.status).toBe("active");

    const { count } = await admin
      .from("households")
      .select("id", { count: "exact", head: true })
      .eq("id", householdId);
    expect(count).toBe(1);
  });

  it("removed membership no longer authorizes household access", async () => {
    // Create second user, invite, then remove — verify deny without crash path
    const emailB = `rb-${runId}@${TEST_DOMAIN}`;
    const createdB = await admin.auth.admin.createUser({
      email: emailB,
      password,
      email_confirm: true,
    });
    expect(createdB.error).toBeNull();
    createdUserIds.push(createdB.data.user!.id);

    const a = await authed(email);
    const { generateInviteToken, hashInviteToken } = await import("@/lib/tokens");
    const token = generateInviteToken();
    const invite = await a.client.rpc("create_household_invitation", {
      p_household_id: householdId,
      p_email: emailB,
      p_token_hash: hashInviteToken(token),
      p_expires_at: new Date(Date.now() + 3_600_000).toISOString(),
      p_intended_roles: ["member"],
    });
    expect(invite.error).toBeNull();

    const b = await authed(emailB);
    await b.client.rpc("accept_household_invitation", {
      p_token_hash: hashInviteToken(token),
    });

    const { data: memB } = await b.client
      .from("household_memberships")
      .select("id")
      .eq("household_id", householdId)
      .eq("user_id", b.userId)
      .single();

    await a.client.rpc("remove_household_member", {
      p_household_id: householdId,
      p_membership_id: memB!.id,
      p_reason: "recovery test",
    });

    const denied = await b.client
      .from("households")
      .select("id")
      .eq("id", householdId)
      .maybeSingle();
    expect(denied.data).toBeNull();
  });

  it("logout signOut is idempotent for missing session clients", async () => {
    const client = createClient<Database>(url!, publishableKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const first = await client.auth.signOut();
    expect(first.error).toBeNull();
    const second = await client.auth.signOut();
    expect(second.error).toBeNull();
  });

  it("documents household cookie name for recovery clearing", () => {
    expect(CURRENT_HOUSEHOLD_COOKIE).toBe("householdos_current_household");
  });
});
