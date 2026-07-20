import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  isOfflineAllowedAction,
  isOnlineOnlyAction,
} from "@/lib/offline/online-only";

type PushBody = {
  id?: string;
  householdId?: string;
  action?: string;
  body?: Record<string, unknown>;
  clientMutationId?: string;
};

/**
 * Session-authenticated outbox drain.
 * Until domain apply handlers exist, allowlist is empty and responses never
 * claim applied: true. Clients must keep unapplied records recoverable.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: PushBody;
  try {
    payload = (await request.json()) as PushBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const action = String(payload.action ?? "");
  const householdId = String(payload.householdId ?? "");
  if (!action || !householdId) {
    return NextResponse.json({ error: "action and householdId required" }, { status: 400 });
  }
  if (isOnlineOnlyAction(action)) {
    return NextResponse.json(
      {
        ok: false,
        applied: false,
        conflict: true,
        error: "This action cannot sync from the offline outbox",
      },
      { status: 409 },
    );
  }

  // Membership check — never apply (or falsely ack) for a household the actor left.
  const { data: membership, error: membershipError } = await supabase
    .from("household_memberships")
    .select("id, status")
    .eq("household_id", householdId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (membershipError || !membership || membership.status !== "active") {
    return NextResponse.json(
      {
        ok: false,
        applied: false,
        conflict: true,
        error: "Not an active member of this household",
      },
      { status: 403 },
    );
  }

  if (!isOfflineAllowedAction(action)) {
    return NextResponse.json({
      ok: true,
      clientMutationId: payload.clientMutationId ?? payload.id,
      applied: false,
      unsupported: true,
      note: "Server synchronization is not available for this action yet",
    });
  }

  // Domain apply handlers will land here. Until then allowlist stays empty.
  return NextResponse.json({
    ok: true,
    clientMutationId: payload.clientMutationId ?? payload.id,
    applied: false,
    unsupported: true,
    note: "Server synchronization is not available for this action yet",
  });
}
