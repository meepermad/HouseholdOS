import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isOnlineOnlyAction } from "@/lib/offline/online-only";

type PushBody = {
  id?: string;
  householdId?: string;
  action?: string;
  body?: Record<string, unknown>;
  clientMutationId?: string;
};

/**
 * Session-authenticated outbox drain for allowlisted non-financial mutations.
 * Financial confirms/routes stay online-only and are rejected here.
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
      { error: "This action cannot sync from the offline outbox" },
      { status: 409 },
    );
  }

  // Acknowledge allowlisted mutations. Domain-specific apply can expand later.
  if (
    ![
      "addComment",
      "createShoppingItem",
      "markShoppingPurchased",
      "createPantryNote",
      "createChoreCompletionDraft",
    ].includes(action)
  ) {
    return NextResponse.json({ error: "Action not allowlisted" }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    clientMutationId: payload.clientMutationId ?? payload.id,
    applied: false,
    note: "Queued mutation acknowledged; expand domain apply as features need offline writes.",
  });
}
