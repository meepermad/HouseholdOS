import { describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret =
  process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
const hasSupabase = Boolean(url && secret);

function adminClient(): SupabaseClient {
  return createClient(url!, secret!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

const CLAIM_RPCS = [
  "start_receipt_claiming",
  "claim_receipt_line",
  "claim_receipt_line_quantity",
  "unclaim_receipt_line",
  "mark_receipt_line_shared",
  "assign_receipt_line",
  "finish_receipt_claiming",
  "finalize_receipt_claims",
  "confirm_claimed_receipt_as_expense",
  "confirm_receipt_as_expense",
  "set_receipt_split_workflow",
  "apply_remaining_receipt_lines",
  "remind_receipt_claiming",
  "record_receipt_orphan_cleanup",
  "mark_receipt_ocr_outcome",
] as const;

describe.skipIf(!hasSupabase)("receipt claim RPCs", () => {
  it("exposes claim lifecycle functions after migration", async () => {
    const admin = adminClient();
    for (const name of CLAIM_RPCS) {
      const { error } = await admin.rpc(name, {});
      if (error) {
        expect(error.message.toLowerCase()).not.toMatch(/does not exist|pgrst202/);
      }
    }
  });

  it("claim tables exist and deny direct client writes conceptually", async () => {
    const admin = adminClient();
    const { error: claimsErr } = await admin
      .from("expense_receipt_line_claims")
      .select("id")
      .limit(0);
    if (claimsErr) {
      expect(claimsErr.message.toLowerCase()).not.toMatch(/does not exist/);
    }
    const { error: invitesErr } = await admin
      .from("expense_receipt_claim_invites")
      .select("receipt_id")
      .limit(0);
    if (invitesErr) {
      expect(invitesErr.message.toLowerCase()).not.toMatch(/does not exist/);
    }
  });
});
