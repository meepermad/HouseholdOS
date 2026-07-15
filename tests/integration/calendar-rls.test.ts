/* eslint-disable @typescript-eslint/no-explicit-any */
import { createHash, randomBytes } from "crypto";
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
const runId = `cal-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const password = "Test-Password-123!";

type Admin = SupabaseClient<Database>;
type Session = {
  email: string;
  userId: string;
  client: SupabaseClient<Database>;
};

/** sha256 hex of the raw token; only the hash is ever persisted. */
function hash(t: string): string {
  return createHash("sha256").update(t).digest("hex");
}

/**
 * Calendar tables and RPCs are not present in the generated Database types yet,
 * so these thin helpers cast to a loose surface while keeping call sites tidy.
 */
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

describe.skipIf(!hasSupabase)("Phase 4 calendar RLS + RPCs", () => {
  let admin: Admin;
  const createdUserIds: string[] = [];

  // Household A: organizer A + members B, C.
  let householdA: string;
  let memA: string;
  let memB: string;
  let memC: string;
  let userA: Session;
  let userB: Session;
  let userC: Session;

  // Outsider O owns their own household D.
  let householdD: string;
  let memD: string;
  let userO: Session;

  const emailA = `ca-${runId}@${TEST_DOMAIN}`;
  const emailB = `cb-${runId}@${TEST_DOMAIN}`;
  const emailC = `cc-${runId}@${TEST_DOMAIN}`;
  const emailO = `co-${runId}@${TEST_DOMAIN}`;

  // Every event uses a timed window comfortably in the future so reminder
  // scheduling never trips on already-passed fire times.
  const startAt = new Date(Date.now() + 30 * 24 * 3600 * 1000);
  const startISO = startAt.toISOString();
  const endISO = new Date(startAt.getTime() + 3600 * 1000).toISOString();

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

  async function createEvent(
    client: SupabaseClient<Database>,
    opts: {
      key: string;
      householdId?: string;
      title?: string;
      visibility?: "household" | "participants" | "private_busy";
      attendees?: string[];
      reminders?: number[];
      category?: string;
    },
  ): Promise<RpcResult<string>> {
    return crpc<string>(client, "create_calendar_event", {
      p_household_id: opts.householdId ?? householdA,
      p_title: opts.title ?? `Evt-${opts.key}`,
      p_category: opts.category ?? "household_meeting",
      p_visibility: opts.visibility ?? "household",
      p_all_day: false,
      p_starts_at: startISO,
      p_ends_at: endISO,
      p_time_zone: "America/Chicago",
      p_event_guest_count: 0,
      p_attendee_membership_ids: opts.attendees ?? [],
      p_reminder_offsets_minutes: opts.reminders ?? [60],
      p_client_idempotency_key: `${runId}-${opts.key}`,
    });
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

    // Household A owned by organizer A.
    userA = await authed(emailA);
    const createdA = await userA.client.rpc("create_household_for_current_user", {
      p_name: `CalA-${runId}`,
      p_acknowledge_reimbursement_policy: true,
      p_idempotency_key: `${runId}-hhA`,
    });
    expect(createdA.error).toBeNull();
    const rowA = Array.isArray(createdA.data) ? createdA.data[0] : createdA.data;
    householdA = rowA!.household_id;
    memA = rowA!.membership_id;

    // Members B and C join household A.
    userB = await inviteAccept(userA, emailB, householdA);
    userC = await inviteAccept(userA, emailC, householdA);
    memB = await membershipId(householdA, userB.userId);
    memC = await membershipId(householdA, userC.userId);

    // Outsider O owns a separate household D.
    userO = await authed(emailO);
    const createdD = await userO.client.rpc("create_household_for_current_user", {
      p_name: `CalD-${runId}`,
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

  it("[1,3] active member creates event; organizer derived from auth", async () => {
    const created = await createEvent(userA.client, {
      key: "basic",
      attendees: [memB],
    });
    expect(created.error).toBeNull();
    const eventId = created.data;
    expect(eventId).toBeTruthy();

    const { data: row } = await admin
      .from("calendar_events" as never)
      .select("organizer_membership_id, household_id, status, visibility")
      .eq("id", eventId)
      .single();
    // Organizer is always the creating membership; it cannot be spoofed by a param.
    expect((row as any)?.organizer_membership_id).toBe(memA);
    expect((row as any)?.household_id).toBe(householdA);
    expect((row as any)?.status).toBe("scheduled");

    // The organizer is auto-added as a 'going' organizer attendee.
    const { data: att } = await admin
      .from("calendar_event_attendees" as never)
      .select("membership_id, participation_role, rsvp_status")
      .eq("event_id", eventId as string);
    const organizerRow = (att as any[]).find((a) => a.membership_id === memA);
    expect(organizerRow?.participation_role).toBe("organizer");
    expect(organizerRow?.rsvp_status).toBe("going");
  });

  it("[2] user cannot create an event in another household", async () => {
    // A is not a member of household D.
    const denied = await createEvent(userA.client, {
      key: "cross-hh",
      householdId: householdD,
    });
    expect(denied.error).toBeTruthy();
  });

  it("[4] cross-household attendee is rejected", async () => {
    // memD belongs to household D, not A.
    const denied = await createEvent(userA.client, {
      key: "cross-attendee",
      attendees: [memD],
    });
    expect(denied.error).toBeTruthy();
    expect(denied.error?.message.toLowerCase()).toContain("active member");
  });

  it("[5,6] household event visible to members; participants event hidden from nonparticipants", async () => {
    // Household-visible event: C (plain member, non-attendee) can see the row.
    const householdEvt = await createEvent(userA.client, {
      key: "visible",
      visibility: "household",
    });
    expect(householdEvt.error).toBeNull();
    const visibleId = householdEvt.data;

    const { data: cSeesHousehold } = await ctable(userC.client, "calendar_events")
      .select("id")
      .eq("id", visibleId);
    expect((cSeesHousehold ?? []).length).toBe(1);

    // Participants-only event with only B invited; C must not see the row at all.
    const partEvt = await createEvent(userA.client, {
      key: "participants",
      visibility: "participants",
      attendees: [memB],
    });
    expect(partEvt.error).toBeNull();
    const partId = partEvt.data;

    const { data: cSeesParticipants } = await ctable(userC.client, "calendar_events")
      .select("id")
      .eq("id", partId);
    expect((cSeesParticipants ?? []).length).toBe(0);

    // The invited participant B does see it.
    const { data: bSeesParticipants } = await ctable(userB.client, "calendar_events")
      .select("id")
      .eq("id", partId);
    expect((bSeesParticipants ?? []).length).toBe(1);

    // C also cannot read the participants-only attendee rows.
    const { data: cAttendees } = await ctable(userC.client, "calendar_event_attendees")
      .select("id")
      .eq("event_id", partId);
    expect((cAttendees ?? []).length).toBe(0);
  });

  it("[7] private_busy row is visible to members but reminders stay participant-only", async () => {
    const privateEvt = await createEvent(userA.client, {
      key: "private",
      visibility: "private_busy",
      reminders: [30],
    });
    expect(privateEvt.error).toBeNull();
    const privateId = privateEvt.data;

    // RLS lets other members see that a private_busy row exists (free/busy shell).
    const { data: cSeesRow } = await ctable(userC.client, "calendar_events")
      .select("id, visibility")
      .eq("id", privateId);
    expect((cSeesRow ?? []).length).toBe(1);

    // But reminders require participant access, so C sees none.
    const { data: cReminders } = await ctable(userC.client, "calendar_event_reminders")
      .select("id")
      .eq("event_id", privateId);
    expect((cReminders ?? []).length).toBe(0);

    // The organizer A can read its own reminders.
    const { data: aReminders } = await ctable(userA.client, "calendar_event_reminders")
      .select("id")
      .eq("event_id", privateId);
    expect((aReminders ?? []).length).toBeGreaterThanOrEqual(1);
  });

  it("[8,9,10] attendee RSVPs own row; cannot edit another's; guest count is bounded", async () => {
    const evt = await createEvent(userA.client, {
      key: "rsvp",
      attendees: [memB],
    });
    expect(evt.error).toBeNull();
    const eventId = evt.data;

    // [8] B updates their own RSVP.
    const rsvp = await crpc(userB.client, "respond_to_calendar_event", {
      p_event_id: eventId,
      p_rsvp_status: "going",
      p_guest_count: 2,
    });
    expect(rsvp.error).toBeNull();

    const { data: bRow } = await admin
      .from("calendar_event_attendees" as never)
      .select("rsvp_status, guest_count")
      .eq("event_id", eventId as string)
      .eq("membership_id", memB)
      .single();
    expect((bRow as any)?.rsvp_status).toBe("going");
    expect((bRow as any)?.guest_count).toBe(2);

    // [9] B cannot mutate A's attendee row directly (no UPDATE policy → 0 rows).
    const { data: forged } = await ctable(userB.client, "calendar_event_attendees")
      .update({ rsvp_status: "not_going" })
      .eq("event_id", eventId)
      .eq("membership_id", memA)
      .select();
    expect((forged ?? []).length).toBe(0);

    // Organizer A's RSVP is untouched.
    const { data: aRow } = await admin
      .from("calendar_event_attendees" as never)
      .select("rsvp_status")
      .eq("event_id", eventId as string)
      .eq("membership_id", memA)
      .single();
    expect((aRow as any)?.rsvp_status).toBe("going");

    // [10] Guest count above the cap is rejected.
    const overCount = await crpc(userB.client, "respond_to_calendar_event", {
      p_event_id: eventId,
      p_rsvp_status: "going",
      p_guest_count: 21,
    });
    expect(overCount.error).toBeTruthy();
  });

  it("[11,12] only the organizer can update the event", async () => {
    const evt = await createEvent(userA.client, {
      key: "update",
      attendees: [memB],
    });
    expect(evt.error).toBeNull();
    const eventId = evt.data;

    // [11] Non-organizer B cannot update.
    const denied = await crpc(userB.client, "update_calendar_event", {
      p_event_id: eventId,
      p_title: `Hacked-${runId}`,
    });
    expect(denied.error).toBeTruthy();
    expect(denied.error?.message.toLowerCase()).toContain("organizer");

    // [12] Organizer A can update.
    const ok = await crpc(userA.client, "update_calendar_event", {
      p_event_id: eventId,
      p_title: `Updated-${runId}`,
      p_location: "Living room",
    });
    expect(ok.error).toBeNull();

    const { data: row } = await admin
      .from("calendar_events" as never)
      .select("title, location")
      .eq("id", eventId as string)
      .single();
    expect((row as any)?.title).toBe(`Updated-${runId}`);
    expect((row as any)?.location).toBe("Living room");
  });

  it("[13,14] organizer can cancel; direct status flip to cancelled is blocked", async () => {
    const evt = await createEvent(userA.client, { key: "cancel-guard" });
    expect(evt.error).toBeNull();
    const eventId = evt.data;

    // [14] Direct table update to cancelled must not take effect (no UPDATE policy).
    const { data: directFlip } = await ctable(userA.client, "calendar_events")
      .update({ status: "cancelled" })
      .eq("id", eventId)
      .select();
    expect((directFlip ?? []).length).toBe(0);

    const { data: stillScheduled } = await admin
      .from("calendar_events" as never)
      .select("status")
      .eq("id", eventId as string)
      .single();
    expect((stillScheduled as any)?.status).toBe("scheduled");

    // [13] Organizer cancels through the RPC.
    const cancelled = await crpc(userA.client, "cancel_calendar_event", {
      p_event_id: eventId,
      p_reason: "no longer needed",
    });
    expect(cancelled.error).toBeNull();

    const { data: afterCancel } = await admin
      .from("calendar_events" as never)
      .select("status, cancelled_by_membership_id")
      .eq("id", eventId as string)
      .single();
    expect((afterCancel as any)?.status).toBe("cancelled");
    expect((afterCancel as any)?.cancelled_by_membership_id).toBe(memA);
  });

  it("[15] coordinator override cancels household events but never private_busy", async () => {
    // Promote B to household_coordinator (A is coordinator by bootstrap).
    const promote = await userA.client.rpc("change_membership_roles", {
      p_household_id: householdA,
      p_membership_id: memB,
      p_roles: ["member", "household_coordinator"],
    });
    expect(promote.error).toBeNull();

    // Household-visible event organized by A: coordinator B may override-cancel.
    const householdEvt = await createEvent(userA.client, {
      key: "coord-household",
      visibility: "household",
    });
    expect(householdEvt.error).toBeNull();
    const overrideOk = await crpc(userB.client, "cancel_calendar_event", {
      p_event_id: householdEvt.data,
      p_reason: "coordinator cleanup",
      p_coordinator_override: true,
    });
    expect(overrideOk.error).toBeNull();

    // private_busy event organized by A: override is refused even for a coordinator.
    const privateEvt = await createEvent(userA.client, {
      key: "coord-private",
      visibility: "private_busy",
    });
    expect(privateEvt.error).toBeNull();
    const overrideDenied = await crpc(userB.client, "cancel_calendar_event", {
      p_event_id: privateEvt.data,
      p_reason: "should fail",
      p_coordinator_override: true,
    });
    expect(overrideDenied.error).toBeTruthy();

    const { data: stillScheduled } = await admin
      .from("calendar_events" as never)
      .select("status")
      .eq("id", privateEvt.data as string)
      .single();
    expect((stillScheduled as any)?.status).toBe("scheduled");
  });

  it("[16] reconcile materializes occurrences idempotently", async () => {
    const evt = await createEvent(userA.client, { key: "materialize" });
    expect(evt.error).toBeNull();
    const eventId = evt.data;

    const occurrences = [
      {
        original_starts_at: startISO,
        starts_at: startISO,
        ends_at: endISO,
        all_day: false,
        start_date: null,
        end_date_exclusive: null,
        is_cancelled: false,
      },
    ];

    const first = await crpc<number>(userA.client, "reconcile_calendar_event_occurrences", {
      p_event_id: eventId,
      p_occurrences: occurrences,
    });
    expect(first.error).toBeNull();
    expect(first.data).toBe(1);

    // Second call is idempotent: same count, same number of rows.
    const second = await crpc<number>(userA.client, "reconcile_calendar_event_occurrences", {
      p_event_id: eventId,
      p_occurrences: occurrences,
    });
    expect(second.error).toBeNull();
    expect(second.data).toBe(1);

    const { count } = await admin
      .from("calendar_event_occurrences" as never)
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId as string);
    expect(count).toBe(1);
  });

  it("[17] update_calendar_occurrence writes an override exception", async () => {
    const evt = await createEvent(userA.client, { key: "occ-update" });
    expect(evt.error).toBeNull();
    const eventId = evt.data;

    await crpc(userA.client, "reconcile_calendar_event_occurrences", {
      p_event_id: eventId,
      p_occurrences: [
        {
          original_starts_at: startISO,
          starts_at: startISO,
          ends_at: endISO,
          all_day: false,
          start_date: null,
          end_date_exclusive: null,
          is_cancelled: false,
        },
      ],
    });

    const movedStart = new Date(startAt.getTime() + 2 * 3600 * 1000).toISOString();
    const movedEnd = new Date(startAt.getTime() + 3 * 3600 * 1000).toISOString();
    const updated = await crpc<string>(userA.client, "update_calendar_occurrence", {
      p_event_id: eventId,
      p_original_starts_at: startISO,
      p_all_day: false,
      p_starts_at: movedStart,
      p_ends_at: movedEnd,
    });
    expect(updated.error).toBeNull();

    const { data: exception } = await admin
      .from("calendar_event_exceptions" as never)
      .select("kind, starts_at")
      .eq("id", updated.data as string)
      .single();
    expect((exception as any)?.kind).toBe("override");

    const { data: occ } = await admin
      .from("calendar_event_occurrences" as never)
      .select("starts_at, exception_id, is_cancelled")
      .eq("event_id", eventId as string)
      .eq("original_starts_at", startISO)
      .single();
    expect((occ as any)?.exception_id).toBe(updated.data);
    expect((occ as any)?.is_cancelled).toBe(false);
  });

  it("[18] cancel_calendar_occurrence marks the occurrence cancelled", async () => {
    const evt = await createEvent(userA.client, { key: "occ-cancel" });
    expect(evt.error).toBeNull();
    const eventId = evt.data;

    await crpc(userA.client, "reconcile_calendar_event_occurrences", {
      p_event_id: eventId,
      p_occurrences: [
        {
          original_starts_at: startISO,
          starts_at: startISO,
          ends_at: endISO,
          all_day: false,
          start_date: null,
          end_date_exclusive: null,
          is_cancelled: false,
        },
      ],
    });

    const cancelled = await crpc<string>(userA.client, "cancel_calendar_occurrence", {
      p_event_id: eventId,
      p_original_starts_at: startISO,
      p_reason: "skip this one",
    });
    expect(cancelled.error).toBeNull();

    const { data: exception } = await admin
      .from("calendar_event_exceptions" as never)
      .select("kind")
      .eq("id", cancelled.data as string)
      .single();
    expect((exception as any)?.kind).toBe("cancelled");

    const { data: occ } = await admin
      .from("calendar_event_occurrences" as never)
      .select("is_cancelled")
      .eq("event_id", eventId as string)
      .eq("original_starts_at", startISO)
      .single();
    expect((occ as any)?.is_cancelled).toBe(true);
  });

  it("[20] personal feeds: owner-scoped tokens, service-role context, revocation", async () => {
    const rawToken = randomBytes(32).toString("hex");
    const created = await crpc<string>(userA.client, "create_calendar_feed", {
      p_household_id: householdA,
      p_token_hash: hash(rawToken),
      p_label: `Feed-${runId}`,
      p_scope: "visible_to_me",
    });
    expect(created.error).toBeNull();
    const feedId = created.data;

    // Another member (B) cannot read A's feed token row (RLS: user_id = auth.uid()).
    const { data: bFeeds } = await ctable(userB.client, "calendar_feed_tokens")
      .select("id")
      .eq("id", feedId);
    expect((bFeeds ?? []).length).toBe(0);

    // Service role resolves feed context by hash.
    const context = await crpc<any[]>(admin, "get_calendar_feed_context", {
      p_token_hash: hash(rawToken),
    });
    expect(context.error).toBeNull();
    const ctx = Array.isArray(context.data) ? context.data[0] : context.data;
    expect(ctx?.household_id).toBe(householdA);
    expect(ctx?.user_id).toBe(userA.userId);
    expect(ctx?.membership_active).toBe(true);

    // Authorized events are listable while the feed is live.
    const listBefore = await crpc<any[]>(admin, "list_authorized_feed_events", {
      p_feed_id: feedId,
      p_range_start: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
      p_range_end: new Date(Date.now() + 400 * 24 * 3600 * 1000).toISOString(),
    });
    expect(listBefore.error).toBeNull();
    expect((listBefore.data ?? []).length).toBeGreaterThanOrEqual(1);

    // Revoking the feed stops the listing.
    const revoked = await crpc(userA.client, "revoke_calendar_feed", {
      p_feed_id: feedId,
    });
    expect(revoked.error).toBeNull();

    const listAfter = await crpc<any[]>(admin, "list_authorized_feed_events", {
      p_feed_id: feedId,
      p_range_start: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
      p_range_end: new Date(Date.now() + 400 * 24 * 3600 * 1000).toISOString(),
    });
    expect(listAfter.error).toBeNull();
    expect((listAfter.data ?? []).length).toBe(0);
  });

  it("[21] direct audit_events insert is rejected (no forgery)", async () => {
    const { error } = await ctable(userA.client, "audit_events").insert({
      household_id: householdA,
      actor_user_id: userA.userId,
      entity_type: "calendar_event",
      entity_id: crypto.randomUUID(),
      event_type: "calendar.event_created",
      after_state: { forged: true },
    });
    expect(error).toBeTruthy();
  });

  it("[19] removed member loses access to household events", async () => {
    // Run last: removing C would break its use as a plain member elsewhere.
    const removed = await userA.client.rpc("remove_household_member", {
      p_household_id: householdA,
      p_membership_id: memC,
      p_reason: "test cleanup",
    });
    expect(removed.error).toBeNull();

    const evt = await createEvent(userA.client, {
      key: "after-removal",
      visibility: "household",
    });
    expect(evt.error).toBeNull();

    const { data: cSees } = await ctable(userC.client, "calendar_events")
      .select("id")
      .eq("id", evt.data);
    expect((cSees ?? []).length).toBe(0);
  });
});
