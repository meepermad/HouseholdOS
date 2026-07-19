/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Shopping Intelligence RLS + two-household privacy certification.
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
const runId = `shopintel-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const password = "Test-Password-123!";

type Admin = SupabaseClient<Database>;
type Session = {
  email: string;
  userId: string;
  client: SupabaseClient<Database>;
};

function crpc(
  client: SupabaseClient<Database>,
  fn: string,
  args: Record<string, unknown>,
) {
  return (client as any).rpc(fn, args) as Promise<{
    data: unknown;
    error: { message: string } | null;
  }>;
}

function ctable(client: SupabaseClient<Database>, name: string): any {
  return (client as any).from(name);
}

async function authed(email: string): Promise<Session> {
  const session = await getAuthedClient(email, password);
  return { email, client: session.client, userId: session.userId };
}

async function createHousehold(client: SupabaseClient<Database>, name: string) {
  const created = await client.rpc("create_household_for_current_user", {
    p_name: name,
    p_acknowledge_reimbursement_policy: true,
    p_idempotency_key: `${runId}-${name}`,
  } as never);
  expect(created.error).toBeNull();
  const row = Array.isArray(created.data) ? created.data[0] : created.data;
  return (row as { household_id: string }).household_id;
}

async function inviteMember(
  host: Session,
  guest: Session,
  householdId: string,
) {
  const token = generateInviteToken();
  const invite = await host.client.rpc("create_household_invitation", {
    p_household_id: householdId,
    p_email: guest.email,
    p_token_hash: hashInviteToken(token),
    p_expires_at: new Date(Date.now() + 3_600_000).toISOString(),
    p_intended_roles: ["member"],
  } as never);
  expect(invite.error).toBeNull();
  const accept = await guest.client.rpc("accept_household_invitation", {
    p_token_hash: hashInviteToken(token),
  } as never);
  expect(accept.error).toBeNull();
}

describe.skipIf(!hasSupabase)("Shopping Intelligence RLS certification", () => {
  let admin: Admin;
  const createdUserIds: string[] = [];
  let householdA: string;
  let householdB: string;
  let alice: Session;
  let bob: Session;
  let carol: Session;
  let aliceMembershipA: string;

  const emailA = `sia-${runId}@${TEST_DOMAIN}`;
  const emailB = `sib-${runId}@${TEST_DOMAIN}`;
  const emailC = `sic-${runId}@${TEST_DOMAIN}`;

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
    bob = await authed(emailB);
    carol = await authed(emailC);

    householdA = await createHousehold(alice.client, `ShopIntel A ${runId}`);
    householdB = await createHousehold(bob.client, `ShopIntel B ${runId}`);

    await inviteMember(alice, carol, householdA);
    await inviteMember(bob, carol, householdB);

    aliceMembershipA = await membershipId(householdA, alice.userId);

    await crpc(alice.client, "ensure_shopping_recommendation_preferences", {
      p_household_id: householdA,
    });
    await crpc(bob.client, "ensure_shopping_recommendation_preferences", {
      p_household_id: householdB,
    });
  }, 120_000);

  afterAll(async () => {
    try {
      await cleanupTestHouseholdsByRunId(admin, runId);
    } catch {
      /* best-effort cleanup */
    }
    try {
      await deleteTestAuthUsers(admin, createdUserIds);
    } catch {
      /* best-effort cleanup */
    }
  }, 90_000);

  it("isolates recommendation runs and items across households", async () => {
    const listA = await crpc(alice.client, "ensure_default_shopping_list", {
      p_household_id: householdA,
    });
    const runA = await crpc(alice.client, "persist_shopping_recommendation_run", {
      p_household_id: householdA,
      p_list_id: listA.data,
      p_mode_filter: "everything",
      p_scope: "shared",
      p_items: [
        {
          name: "Secret A soap",
          normalizedKey: "secretasoap",
          priorityBand: "recommended",
          suggestedQuantity: 1,
          suggestedUnit: "bottle",
          quantityBreakdown: [],
          unitMismatch: false,
          visibility: "shared",
          ownerMembershipId: null,
          relatedSupplyId: null,
          relatedPantryId: null,
          explanation: "Below the household restock threshold.",
          reasonCodes: ["supply_below_threshold"],
          confidence: "medium",
          existingListItemId: null,
          sortOrder: 0,
          sources: [
            {
              sourceType: "supply_item",
              sourceId: null,
              reasonCode: "supply_below_threshold",
              explanation: "Below the household restock threshold.",
              quantity: null,
              quantityUnit: null,
            },
          ],
        },
      ],
      p_source_freshness: { test: true },
      p_idempotency_key: `run-a-${runId}`,
    });
    expect(runA.error).toBeNull();

    const { data: bobRuns } = await ctable(bob.client, "shopping_recommendation_runs")
      .select("id")
      .eq("household_id", householdA);
    expect(bobRuns ?? []).toHaveLength(0);

    const { data: bobItems } = await ctable(bob.client, "shopping_recommendation_items")
      .select("id,name")
      .eq("household_id", householdA);
    expect(bobItems ?? []).toHaveLength(0);
  });

  it("isolates trips across households", async () => {
    const listA = await crpc(alice.client, "ensure_default_shopping_list", {
      p_household_id: householdA,
    });
    const trip = await crpc(alice.client, "start_shopping_trip", {
      p_household_id: householdA,
      p_list_id: listA.data,
      p_store_label: null,
      p_idempotency_key: `trip-a-${runId}`,
    });
    expect(trip.error).toBeNull();

    const { data: bobTrips } = await ctable(bob.client, "shopping_trip_sessions")
      .select("id")
      .eq("id", trip.data);
    expect(bobTrips ?? []).toHaveLength(0);
  });

  it("rejects cross-household add and decision mutations", async () => {
    const listA = await crpc(alice.client, "ensure_default_shopping_list", {
      p_household_id: householdA,
    });
    const run = await crpc(alice.client, "persist_shopping_recommendation_run", {
      p_household_id: householdA,
      p_list_id: listA.data,
      p_mode_filter: "everything",
      p_scope: "shared",
      p_items: [
        {
          name: "Cross soap",
          normalizedKey: "crosssoap",
          priorityBand: "recommended",
          suggestedQuantity: 1,
          suggestedUnit: "bottle",
          quantityBreakdown: [],
          unitMismatch: false,
          visibility: "shared",
          ownerMembershipId: null,
          relatedSupplyId: null,
          relatedPantryId: null,
          explanation: "Below threshold.",
          reasonCodes: ["supply_below_threshold"],
          confidence: "medium",
          existingListItemId: null,
          sortOrder: 0,
          sources: [],
        },
      ],
      p_source_freshness: {},
      p_idempotency_key: `run-cross-${runId}`,
    });
    expect(run.error).toBeNull();

    const { data: items } = await ctable(alice.client, "shopping_recommendation_items")
      .select("id")
      .eq("run_id", run.data)
      .limit(1);
    const itemId = items?.[0]?.id;
    expect(itemId).toBeTruthy();

    const add = await crpc(bob.client, "add_recommended_item_to_list", {
      p_item_id: itemId,
      p_quantity: 1,
      p_quantity_unit: "bottle",
      p_idempotency_key: `add-cross-${runId}`,
    });
    expect(add.error).not.toBeNull();

    const dismiss = await crpc(bob.client, "dismiss_shopping_recommendation", {
      p_item_id: itemId,
      p_decision: "dismissed",
      p_snooze_until: null,
      p_idempotency_key: `dismiss-cross-${runId}`,
    });
    expect(dismiss.error).not.toBeNull();
  });

  it("stores personal visibility without leaking owner identity in explanation", async () => {
    const listA = await crpc(alice.client, "ensure_default_shopping_list", {
      p_household_id: householdA,
    });
    const run = await crpc(alice.client, "persist_shopping_recommendation_run", {
      p_household_id: householdA,
      p_list_id: listA.data,
      p_mode_filter: "everything",
      p_scope: "personal",
      p_items: [
        {
          name: "Alice personal item",
          normalizedKey: "alicepersonalitem",
          priorityBand: "recommended",
          suggestedQuantity: 1,
          suggestedUnit: "item",
          quantityBreakdown: [],
          unitMismatch: false,
          visibility: "personal",
          ownerMembershipId: aliceMembershipA,
          relatedSupplyId: null,
          relatedPantryId: null,
          explanation: "Personal shopping request.",
          reasonCodes: ["open_shopping_request"],
          confidence: "high",
          existingListItemId: null,
          sortOrder: 0,
          sources: [],
        },
      ],
      p_source_freshness: {},
      p_idempotency_key: `run-personal-${runId}`,
    });
    expect(run.error).toBeNull();

    const { data: items } = await ctable(alice.client, "shopping_recommendation_items")
      .select("id,visibility,owner_membership_id,explanation")
      .eq("run_id", run.data);
    expect(items?.[0]?.visibility).toBe("personal");
    expect(String(items?.[0]?.explanation)).not.toMatch(/membership_/i);
  });

  it("carol dual membership keeps prefs and runs household-scoped", async () => {
    const { data: prefsA } = await ctable(
      carol.client,
      "shopping_recommendation_preferences",
    )
      .select("household_id")
      .eq("household_id", householdA)
      .maybeSingle();
    const { data: prefsB } = await ctable(
      carol.client,
      "shopping_recommendation_preferences",
    )
      .select("household_id")
      .eq("household_id", householdB)
      .maybeSingle();
    expect(prefsA?.household_id).toBe(householdA);
    expect(prefsB?.household_id).toBe(householdB);

    const { data: aOnly } = await ctable(carol.client, "shopping_recommendation_runs")
      .select("household_id")
      .eq("household_id", householdA);
    for (const row of aOnly ?? []) {
      expect(row.household_id).toBe(householdA);
    }
  });

  it("public execute is revoked on shopping-intel RPCs", async () => {
    const anon = createClient(url!, publishableKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const res = await crpc(anon as any, "persist_shopping_recommendation_run", {
      p_household_id: householdA,
      p_list_id: null,
      p_mode_filter: "everything",
      p_scope: "shared",
      p_items: [],
      p_source_freshness: {},
      p_idempotency_key: `anon-${runId}`,
    });
    expect(res.error).not.toBeNull();
  });
});
