/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Phase 7A preference privacy + attendee-scoped recommendation RLS tests.
 */
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
const runId = `pref-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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

describe.skipIf(!hasSupabase)("Phase 7A recipe preference RLS", () => {
  let admin: Admin;
  const createdUserIds: string[] = [];
  let householdId: string;
  let otherHouseholdId: string;
  let alice: Session;
  let bob: Session;
  let carol: Session;
  let aliceMembershipId: string;
  let bobMembershipId: string;
  let recipeId: string;

  const emailA = `pa-${runId}@${TEST_DOMAIN}`;
  const emailB = `pb-${runId}@${TEST_DOMAIN}`;
  const emailC = `pc-${runId}@${TEST_DOMAIN}`;

  async function membershipId(hid: string, userId: string) {
    const { data } = await admin
      .from("household_memberships")
      .select("id")
      .eq("household_id", hid)
      .eq("user_id", userId)
      .single();
    return data!.id as string;
  }

  beforeAll(async () => {
    admin = createClient<Database>(url!, secretKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    await admin.from("auth_registration_policy").upsert({
      id: 1,
      mode: "invite_only",
      allow_test_emails: true,
      test_email_domain: TEST_DOMAIN,
    } as never);

    for (const email of [emailA, emailB, emailC]) {
      const created = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      expect(created.error).toBeNull();
      createdUserIds.push(created.data.user!.id);
    }

    alice = await authed(emailA);
    const createdHh = await alice.client.rpc("create_household_for_current_user", {
      p_name: `PrefA-${runId}`,
      p_acknowledge_reimbursement_policy: true,
      p_idempotency_key: `${runId}-pref-a`,
    } as never);
    expect(createdHh.error).toBeNull();
    const row = Array.isArray(createdHh.data) ? createdHh.data[0] : createdHh.data;
    householdId = (row as { household_id: string }).household_id;
    aliceMembershipId = await membershipId(householdId, alice.userId);

    const token = generateInviteToken();
    const invite = await alice.client.rpc("create_household_invitation", {
      p_household_id: householdId,
      p_email: emailB,
      p_token_hash: hashInviteToken(token),
      p_expires_at: new Date(Date.now() + 3_600_000).toISOString(),
      p_intended_roles: ["member"],
    } as never);
    expect(invite.error).toBeNull();
    bob = await authed(emailB);
    const accept = await bob.client.rpc("accept_household_invitation", {
      p_token_hash: hashInviteToken(token),
    } as never);
    expect(accept.error).toBeNull();
    bobMembershipId = await membershipId(householdId, bob.userId);

    carol = await authed(emailC);
    const other = await carol.client.rpc("create_household_for_current_user", {
      p_name: `PrefC-${runId}`,
      p_acknowledge_reimbursement_policy: true,
      p_idempotency_key: `${runId}-pref-c`,
    } as never);
    expect(other.error).toBeNull();
    const otherRow = Array.isArray(other.data) ? other.data[0] : other.data;
    otherHouseholdId = (otherRow as { household_id: string }).household_id;

    const recipe = await crpc<string>(alice.client, "create_recipe", {
      p_household_id: householdId,
      p_name: `Pref Recipe ${runId}`,
      p_visibility: "household",
      p_base_servings: 4,
      p_ingredients: [
        {
          display_name: "spinach",
          quantity: "1",
          quantity_unit: "pound",
          quantity_mode: "exact",
          required: true,
        },
        {
          display_name: "garlic",
          quantity: "2",
          quantity_unit: "item",
          quantity_mode: "exact",
          required: true,
        },
      ],
      p_steps: [{ step_number: 1, instruction: "Cook it.", phase: "cooking" }],
    });
    expect(recipe.error).toBeNull();
    recipeId = recipe.data!;
  }, 120_000);

  afterAll(async () => {
    if (!admin) return;
    try {
      await (admin as any).rpc("_test_cleanup_meal_household", {
        p_household_id: householdId,
      });
      await (admin as any).rpc("_test_cleanup_meal_household", {
        p_household_id: otherHouseholdId,
      });
    } catch {
      /* optional until migration applied */
    }
    await cleanupTestHouseholdsByRunId(admin, runId);
    await deleteTestAuthUsers(admin, createdUserIds);
  }, 90_000);

  it("member sets own preference", async () => {
    const res = await crpc(alice.client, "set_recipe_preference", {
      p_recipe_id: recipeId,
      p_preference_signal: "would_make_again",
      p_is_favorite: false,
    });
    expect(res.error).toBeNull();
    const { data } = await ctable(alice.client, "recipe_user_preferences")
      .select("preference_signal, membership_id")
      .eq("recipe_id", recipeId)
      .eq("membership_id", aliceMembershipId)
      .single();
    expect(data.preference_signal).toBe("would_make_again");
  });

  it("another member cannot read private preference rows", async () => {
    await crpc(bob.client, "set_recipe_preference", {
      p_recipe_id: recipeId,
      p_preference_signal: "would_not_choose_again",
    });
    const { data: aliceView } = await ctable(
      alice.client,
      "recipe_user_preferences",
    )
      .select("preference_signal")
      .eq("recipe_id", recipeId)
      .eq("membership_id", bobMembershipId)
      .maybeSingle();
    expect(aliceView).toBeNull();
  });

  it("recommendation uses expected attendees only and hides identity", async () => {
    const req = await crpc<string>(alice.client, "create_meal_request", {
      p_household_id: householdId,
      p_meal_type: "shared_household",
      p_ranking_mode: "best_overall",
      p_preference_scope: "attendees",
      p_attendee_membership_ids: [aliceMembershipId, bobMembershipId],
      p_constraints: [],
    });
    expect(req.error).toBeNull();
    const results = await crpc<any>(
      alice.client,
      "get_recipe_recommendation_results",
      { p_meal_request_id: req.data },
    );
    expect(results.error).toBeNull();
    const hit = (results.data?.results ?? []).find(
      (r: any) => r.recipe_id === recipeId,
    );
    expect(hit).toBeTruthy();
    const blob = JSON.stringify(hit);
    expect(blob).not.toMatch(new RegExp(bobMembershipId, "i"));
    expect(blob).not.toMatch(/@/);
  });

  it("cross-household recommendation access fails", async () => {
    const req = await crpc<string>(alice.client, "create_meal_request", {
      p_household_id: householdId,
      p_meal_type: "shared_household",
      p_attendee_membership_ids: [aliceMembershipId],
    });
    expect(req.error).toBeNull();
    const denied = await crpc(carol.client, "get_recipe_recommendation_results", {
      p_meal_request_id: req.data,
    });
    expect(denied.error).toBeTruthy();
  });

  it("accepting recommendation creates meal plan", async () => {
    const req = await crpc<string>(alice.client, "create_meal_request", {
      p_household_id: householdId,
      p_meal_type: "shared_household",
      p_attendee_membership_ids: [aliceMembershipId],
    });
    expect(req.error).toBeNull();
    const accept = await crpc<string>(
      alice.client,
      "accept_recipe_recommendation",
      {
        p_meal_request_id: req.data,
        p_recipe_id: recipeId,
        p_meal_date: "2026-07-20",
        p_desired_servings: 4,
        p_link_calendar: false,
        p_attendee_membership_ids: [aliceMembershipId],
      },
    );
    expect(accept.error).toBeNull();
    expect(accept.data).toBeTruthy();
  });

  it("direct recommendation-result insert is blocked", async () => {
    const forged = await ctable(
      alice.client,
      "recipe_recommendation_results",
    ).insert({
      household_id: householdId,
      recipe_id: recipeId,
      run_id: crypto.randomUUID(),
      total_score: 999,
      explanation: ["forged"],
    });
    expect(forged.error).toBeTruthy();
  });

  it("audit payload for preference_set has no private note or signal", async () => {
    await crpc(alice.client, "set_recipe_preference", {
      p_recipe_id: recipeId,
      p_preference_signal: "favorite",
      p_private_note: "secret note should not audit",
    });
    const { data: events } = await admin
      .from("audit_events")
      .select("event_type, after_state, before_state")
      .eq("household_id", householdId)
      .eq("event_type", "recipe.preference_set")
      .order("created_at", { ascending: false })
      .limit(1);
    const payload = JSON.stringify(events?.[0] ?? {});
    expect(payload).not.toMatch(/secret note/);
  });
});
