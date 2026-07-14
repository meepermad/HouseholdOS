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

type Admin = SupabaseClient<Database>;

function authed(email: string, password: string) {
  return createClient<Database>(url!, publishableKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  }).auth.signInWithPassword({ email, password }).then(async (res) => {
    if (res.error) throw res.error;
    const client = createClient<Database>(url!, publishableKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        headers: { Authorization: `Bearer ${res.data.session!.access_token}` },
      },
    });
    return { client, userId: res.data.user!.id, session: res.data.session! };
  });
}

describe.skipIf(!hasSupabase)("linked RLS and authorization hardening", () => {
  let admin: Admin;
  const createdUserIds: string[] = [];
  let householdA: string;
  let householdB: string;
  let membershipA: string;
  let membershipBOnA: string;
  let emailA: string;
  let emailB: string;
  let emailC: string;
  const password = "Test-Password-123!";

  beforeAll(async () => {
    admin = createClient<Database>(url!, secretKey!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Ensure test signups allowed by auth policy row
    await admin.from("auth_registration_policy").upsert({
      id: 1,
      mode: "invite_only",
      allow_test_emails: true,
      test_email_domain: TEST_DOMAIN,
    });

    emailA = `a-${runId}@${TEST_DOMAIN}`;
    emailB = `b-${runId}@${TEST_DOMAIN}`;
    emailC = `c-${runId}@${TEST_DOMAIN}`;

    for (const email of [emailA, emailB, emailC]) {
      const created = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      expect(created.error).toBeNull();
      createdUserIds.push(created.data.user!.id);
    }

    const a = await authed(emailA, password);
    const createdA = await a.client.rpc("create_household", {
      p_name: `HouseA-${runId}`,
      p_acknowledge_reimbursement_policy: true,
    });
    expect(createdA.error).toBeNull();
    householdA = createdA.data as string;

    const bAlone = await authed(emailB, password);
    const createdB = await bAlone.client.rpc("create_household", {
      p_name: `HouseB-${runId}`,
      p_acknowledge_reimbursement_policy: true,
    });
    expect(createdB.error).toBeNull();
    householdB = createdB.data as string;

    const { data: memA } = await a.client
      .from("household_memberships")
      .select("id")
      .eq("household_id", householdA)
      .eq("user_id", a.userId)
      .single();
    membershipA = memA!.id;

    // Invite B into A
    const token = generateInviteToken();
    const invite = await a.client.rpc("create_household_invitation", {
      p_household_id: householdA,
      p_email: emailB,
      p_token_hash: hashInviteToken(token),
      p_expires_at: new Date(Date.now() + 3_600_000).toISOString(),
      p_intended_roles: ["member"],
    });
    expect(invite.error).toBeNull();

    const b = await authed(emailB, password);
    const accept = await b.client.rpc("accept_household_invitation", {
      p_token_hash: hashInviteToken(token),
    });
    expect(accept.error).toBeNull();

    const { data: memB } = await b.client
      .from("household_memberships")
      .select("id")
      .eq("household_id", householdA)
      .eq("user_id", b.userId)
      .single();
    membershipBOnA = memB!.id;
  }, 120_000);

  afterAll(async () => {
    if (!admin) return;
    // Cleanup narrowly by run-scoped households / users
    for (const id of [householdA, householdB].filter(Boolean)) {
      await admin.from("reimbursement_obligations").delete().eq("household_id", id);
      await admin.from("expense_amendments").delete().eq("household_id", id);
      await admin.from("expense_adjustment_allocations").delete().eq("household_id", id);
      await admin.from("expense_item_allocations").delete().eq("household_id", id);
      await admin.from("expense_adjustments").delete().eq("household_id", id);
      await admin.from("expense_items").delete().eq("household_id", id);
      await admin.from("expenses").delete().eq("household_id", id);
      await admin.from("audit_events").delete().eq("household_id", id);
      await admin.from("household_invitations").delete().eq("household_id", id);
      await admin.from("household_settings").delete().eq("household_id", id);
      await admin.from("user_preferences").update({ current_household_id: null }).eq("current_household_id", id);
      const { data: mems } = await admin
        .from("household_memberships")
        .select("id")
        .eq("household_id", id);
      for (const m of mems ?? []) {
        await admin.from("household_membership_roles").delete().eq("membership_id", m.id);
      }
      await admin.from("household_memberships").delete().eq("household_id", id);
      await admin.from("households").delete().eq("id", id);
    }
    for (const userId of createdUserIds) {
      await admin.from("user_preferences").delete().eq("user_id", userId);
      await admin.from("profiles").delete().eq("id", userId);
      await admin.auth.admin.deleteUser(userId);
    }
  }, 120_000);

  it("blocks cross-household reads and writes", async () => {
    const a = await authed(emailA, password);
    const leak = await a.client.from("households").select("*").eq("id", householdB).maybeSingle();
    expect(leak.data).toBeNull();

    const write = await a.client
      .from("households")
      .update({ name: "Hacked" })
      .eq("id", householdB)
      .select();
    expect(write.data ?? []).toHaveLength(0);
  });

  it("blocks direct membership status updates by members", async () => {
    const b = await authed(emailB, password);
    const direct = await b.client
      .from("household_memberships")
      .update({ status: "removed" })
      .eq("id", membershipA)
      .select();
    expect(direct.data ?? []).toHaveLength(0);

    const selfPromoteRoles = await b.client
      .from("household_membership_roles")
      .insert({
        membership_id: membershipBOnA,
        role: "household_coordinator",
      });
    expect(selfPromoteRoles.error).toBeTruthy();

    const selfPromoteRpc = await b.client.rpc("change_membership_roles", {
      p_household_id: householdA,
      p_membership_id: membershipBOnA,
      p_roles: ["member", "household_coordinator"],
    });
    expect(selfPromoteRpc.error).toBeTruthy();
  });

  it("blocks non-coordinators from creating invitations", async () => {
    const b = await authed(emailB, password);
    const invite = await b.client.rpc("create_household_invitation", {
      p_household_id: householdA,
      p_email: emailC,
      p_token_hash: hashInviteToken(generateInviteToken()),
      p_expires_at: new Date(Date.now() + 3_600_000).toISOString(),
    });
    expect(invite.error).toBeTruthy();
  });

  it("rejects wrong email, expired, revoked, and replayed invitations", async () => {
    const a = await authed(emailA, password);
    const c = await authed(emailC, password);

    const wrongToken = generateInviteToken();
    await a.client.rpc("create_household_invitation", {
      p_household_id: householdA,
      p_email: "someone-else@example.com",
      p_token_hash: hashInviteToken(wrongToken),
      p_expires_at: new Date(Date.now() + 3_600_000).toISOString(),
    });
    const wrong = await c.client.rpc("accept_household_invitation", {
      p_token_hash: hashInviteToken(wrongToken),
    });
    expect(wrong.error).toBeTruthy();

    const expiredToken = generateInviteToken();
    const expiredHash = hashInviteToken(expiredToken);
    await admin.from("household_invitations").insert({
      household_id: householdA,
      invited_email: emailC,
      invited_by: createdUserIds[0],
      token_hash: expiredHash,
      expires_at: new Date(Date.now() - 60_000).toISOString(),
      intended_roles: ["member"],
      status: "pending",
    });
    const expired = await c.client.rpc("accept_household_invitation", {
      p_token_hash: expiredHash,
    });
    expect(expired.error).toBeTruthy();

    const revokeToken = generateInviteToken();
    const created = await a.client.rpc("create_household_invitation", {
      p_household_id: householdA,
      p_email: emailC,
      p_token_hash: hashInviteToken(revokeToken),
      p_expires_at: new Date(Date.now() + 3_600_000).toISOString(),
    });
    expect(created.error).toBeNull();
    await a.client.rpc("revoke_household_invitation", {
      p_household_id: householdA,
      p_invitation_id: created.data as string,
    });
    const revoked = await c.client.rpc("accept_household_invitation", {
      p_token_hash: hashInviteToken(revokeToken),
    });
    expect(revoked.error).toBeTruthy();

    const goodToken = generateInviteToken();
    await a.client.rpc("create_household_invitation", {
      p_household_id: householdA,
      p_email: emailC,
      p_token_hash: hashInviteToken(goodToken),
      p_expires_at: new Date(Date.now() + 3_600_000).toISOString(),
    });
    const first = await c.client.rpc("accept_household_invitation", {
      p_token_hash: hashInviteToken(goodToken),
    });
    expect(first.error).toBeNull();
    const replay = await c.client.rpc("accept_household_invitation", {
      p_token_hash: hashInviteToken(goodToken),
    });
    // Idempotent success or conflict — still one membership
    void replay;
    const { count } = await admin
      .from("household_memberships")
      .select("*", { count: "exact", head: true })
      .eq("household_id", householdA)
      .eq("user_id", createdUserIds[2]);
    expect(count).toBe(1);
  });

  it("removes access after member removal and prevents household substitution", async () => {
    const a = await authed(emailA, password);
    const c = await authed(emailC, password);
    const { data: memC } = await c.client
      .from("household_memberships")
      .select("id")
      .eq("household_id", householdA)
      .eq("user_id", c.userId)
      .single();

    const remove = await a.client.rpc("remove_household_member", {
      p_household_id: householdA,
      p_membership_id: memC!.id,
    });
    expect(remove.error).toBeNull();

    const after = await c.client.from("households").select("id").eq("id", householdA).maybeSingle();
    expect(after.data).toBeNull();

    const switchFail = await c.client.rpc("set_current_household", {
      p_household_id: householdA,
    });
    expect(switchFail.error).toBeTruthy();
  });

  it("blocks forging, editing, and deleting audit events", async () => {
    const a = await authed(emailA, password);
    const forged = await a.client.from("audit_events").insert({
      household_id: householdA,
      actor_user_id: createdUserIds[1],
      entity_type: "household",
      entity_id: householdA,
      event_type: "household.archived",
      after_state: { forged: true },
    });
    expect(forged.error).toBeTruthy();

    const written = await a.client.rpc("write_audit_event", {
      p_household_id: householdA,
      p_entity_type: "household",
      p_entity_id: householdA,
      p_event_type: "household.updated",
      p_after_state: { name: "ok" },
    });
    expect(written.error).toBeNull();

    const { data: rows } = await a.client
      .from("audit_events")
      .select("id, actor_user_id, event_type")
      .eq("id", written.data as string)
      .single();
    expect(rows?.actor_user_id).toBe(a.userId);

    const edit = await a.client
      .from("audit_events")
      .update({ event_type: "household.archived" } as never)
      .eq("id", written.data as string)
      .select();
    expect(edit.data ?? []).toHaveLength(0);

    const del = await a.client.from("audit_events").delete().eq("id", written.data as string).select();
    expect(del.data ?? []).toHaveLength(0);
  });

  it("rejects unpermitted write_audit_event types and secret-like payloads", async () => {
    const a = await authed(emailA, password);
    const badType = await a.client.rpc("write_audit_event", {
      p_household_id: householdA,
      p_entity_type: "household",
      p_entity_id: householdA,
      p_event_type: "totally.fake",
    });
    expect(badType.error).toBeTruthy();

    const secrets = await a.client.rpc("write_audit_event", {
      p_household_id: householdA,
      p_entity_type: "household",
      p_entity_id: householdA,
      p_event_type: "household.updated",
      p_after_state: { password: "nope" },
    });
    expect(secrets.error).toBeTruthy();
  });

  it("signup hook denies unrelated emails and allows invited or test domains", async () => {
    const deny = await admin.rpc("hook_before_user_created", {
      event: {
        metadata: {
          uuid: "11111111-1111-4111-8111-111111111111",
          time: new Date().toISOString(),
          name: "before-user-created",
          ip_address: "127.0.0.1",
        },
        user: {
          id: "22222222-2222-4222-8222-222222222222",
          aud: "authenticated",
          role: "",
          email: "stranger@example.com",
          phone: "",
          app_metadata: { provider: "email", providers: ["email"] },
          user_metadata: {},
          identities: [],
          created_at: "0001-01-01T00:00:00Z",
          updated_at: "0001-01-01T00:00:00Z",
          is_anonymous: false,
        },
      },
    });
    expect(deny.error).toBeNull();
    expect((deny.data as { error?: unknown })?.error).toBeTruthy();

    const allowTest = await admin.rpc("hook_before_user_created", {
      event: {
        metadata: {
          uuid: "11111111-1111-4111-8111-111111111111",
          time: new Date().toISOString(),
          name: "before-user-created",
          ip_address: "127.0.0.1",
        },
        user: {
          id: "33333333-3333-4333-8333-333333333333",
          aud: "authenticated",
          role: "",
          email: `ok-${runId}@${TEST_DOMAIN}`,
          phone: "",
          app_metadata: { provider: "email", providers: ["email"] },
          user_metadata: {},
          identities: [],
          created_at: "0001-01-01T00:00:00Z",
          updated_at: "0001-01-01T00:00:00Z",
          is_anonymous: false,
        },
      },
    });
    expect(allowTest.error).toBeNull();
    expect(JSON.stringify(allowTest.data)).toBe("{}");
  });

  it("ensure_profile is idempotent", async () => {
    const a = await authed(emailA, password);
    const first = await a.client.rpc("ensure_profile");
    const second = await a.client.rpc("ensure_profile");
    expect(first.error).toBeNull();
    expect(second.error).toBeNull();
    expect(first.data?.id).toBe(second.data?.id);
  });
});
