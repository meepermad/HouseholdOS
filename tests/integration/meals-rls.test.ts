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
const runId = `meals-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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

describe.skipIf(!hasSupabase)("Phase 6.5 meals RLS + RPCs", () => {
  let admin: Admin;
  const createdUserIds: string[] = [];
  let householdId: string;
  let alice: Session;
  let bob: Session;
  let bobMembershipId: string;

  const emailA = `ma-${runId}@${TEST_DOMAIN}`;
  const emailB = `mb-${runId}@${TEST_DOMAIN}`;

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
    await admin.from("auth_registration_policy").upsert({
      id: 1,
      mode: "invite_only",
      allow_test_emails: true,
      test_email_domain: TEST_DOMAIN,
    } as never);

    for (const email of [emailA, emailB]) {
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
      p_name: `MealsA-${runId}`,
      p_acknowledge_reimbursement_policy: true,
      p_idempotency_key: `${runId}-meals`,
    } as never);
    expect(createdHh.error).toBeNull();
    const row = Array.isArray(createdHh.data) ? createdHh.data[0] : createdHh.data;
    householdId = (row as { household_id: string }).household_id;

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
  }, 120_000);

  afterAll(async () => {
    if (!admin) return;
    try {
      await (admin as any).rpc("_test_cleanup_meal_household", {
        p_household_id: householdId,
      });
    } catch {
      /* optional until migration applied */
    }
    await cleanupTestHouseholdsByRunId(admin, runId);
    await deleteTestAuthUsers(admin, createdUserIds);
  }, 90_000);

  it("active member creates household recipe; creator-only stays private", async () => {
    const shared = await crpc<string>(alice.client, "create_recipe", {
      p_household_id: householdId,
      p_name: "Shared Pasta",
      p_visibility: "household",
      p_base_servings: 4,
      p_ingredients: [
        {
          display_name: "pasta",
          quantity: "1",
          quantity_unit: "pound",
          quantity_mode: "exact",
          required: true,
        },
      ],
      p_steps: [{ step_number: 1, instruction: "Boil water.", phase: "cooking" }],
    });
    expect(shared.error).toBeNull();

    const privateRecipe = await crpc<string>(alice.client, "create_recipe", {
      p_household_id: householdId,
      p_name: "Secret Soup",
      p_visibility: "creator_only",
      p_base_servings: 2,
    });
    expect(privateRecipe.error).toBeNull();

    const bobSeesShared = await ctable(bob.client, "recipes")
      .select("id")
      .eq("id", shared.data)
      .maybeSingle();
    expect(bobSeesShared.data?.id).toBe(shared.data);

    const bobSeesPrivate = await ctable(bob.client, "recipes")
      .select("id")
      .eq("id", privateRecipe.data)
      .maybeSingle();
    expect(bobSeesPrivate.data).toBeNull();
  });

  it("ranking does not mutate shopping; accept creates a meal plan", async () => {
    const recipe = await crpc<string>(alice.client, "create_recipe", {
      p_household_id: householdId,
      p_name: "Spinach Dinner",
      p_visibility: "household",
      p_base_servings: 4,
      p_ingredients: [
        {
          display_name: "spinach",
          quantity: "2",
          quantity_unit: "item",
          quantity_mode: "exact",
          required: true,
        },
      ],
    });
    expect(recipe.error).toBeNull();

    const beforeShop = await ctable(alice.client, "shopping_list_items")
      .select("id")
      .eq("household_id", householdId);
    const beforeCount = beforeShop.data?.length ?? 0;

    const request = await crpc<string>(alice.client, "create_meal_request", {
      p_household_id: householdId,
      p_max_missing_ingredients: 5,
    });
    expect(request.error).toBeNull();

    const afterRankShop = await ctable(alice.client, "shopping_list_items")
      .select("id")
      .eq("household_id", householdId);
    expect(afterRankShop.data?.length ?? 0).toBe(beforeCount);

    const plan = await crpc<string>(alice.client, "accept_meal_request_result", {
      p_meal_request_id: request.data,
      p_recipe_id: recipe.data,
      p_meal_date: new Date().toISOString().slice(0, 10),
      p_target_servings: 4,
    });
    expect(plan.error).toBeNull();
    expect(plan.data).toBeTruthy();
  });

  it("user updates only their own RSVP", async () => {
    const plan = await crpc<string>(alice.client, "create_meal_plan", {
      p_household_id: householdId,
      p_meal_type: "shared_household",
      p_title: "Tuesday dinner",
      p_meal_date: new Date().toISOString().slice(0, 10),
      p_attendee_membership_ids: [bobMembershipId],
    });
    expect(plan.error).toBeNull();

    const rsvp = await crpc(bob.client, "respond_to_meal_plan", {
      p_meal_plan_id: plan.data,
      p_status: "going",
      p_guest_count: 1,
    });
    expect(rsvp.error).toBeNull();

    const rows = await ctable(alice.client, "meal_attendees")
      .select("membership_id,attendance_status,guest_count")
      .eq("meal_plan_id", plan.data)
      .eq("membership_id", bobMembershipId)
      .maybeSingle();
    expect(rows.data?.attendance_status).toBe("going");
    expect(rows.data?.guest_count).toBe(1);
  });

  it("prepared meal creates batch without portion ownership", async () => {
    const plan = await crpc<string>(alice.client, "create_meal_plan", {
      p_household_id: householdId,
      p_meal_type: "meal_prep",
      p_title: "Sunday prep",
      p_meal_date: new Date().toISOString().slice(0, 10),
      p_target_servings: 10,
    });
    expect(plan.error).toBeNull();
    const prepared = await crpc(alice.client, "mark_meal_prepared", {
      p_meal_plan_id: plan.data,
      p_create_batch: true,
      p_remaining_state: "plenty",
    });
    expect(prepared.error).toBeNull();
    const batch = await ctable(alice.client, "meal_prep_batches")
      .select("*")
      .eq("meal_plan_id", plan.data)
      .maybeSingle();
    expect(batch.data?.remaining_state).toBe("plenty");
    expect(
      Object.keys(batch.data ?? {}).some((k) => k.includes("portion")),
    ).toBe(false);
  });
});
