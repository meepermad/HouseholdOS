import { createClient } from "@/lib/supabase/server";
import type { MemberOption } from "@/lib/expenses/display";

export async function listActiveMemberOptions(
  householdId: string,
): Promise<MemberOption[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("household_memberships")
    .select("id, profiles(display_name, email)")
    .eq("household_id", householdId)
    .eq("status", "active");

  return (data ?? []).map((m) => {
    const profile = m.profiles as
      | { display_name: string | null; email: string }
      | null;
    return {
      id: m.id,
      label: profile?.display_name || profile?.email || m.id.slice(0, 8),
    };
  });
}

export async function getBalancesForMembership(
  householdId: string,
  membershipId: string,
) {
  const supabase = await createClient();
  const { data: owed } = await supabase
    .from("reimbursement_obligations")
    .select("current_amount_cents")
    .eq("household_id", householdId)
    .eq("debtor_membership_id", membershipId)
    .eq("status", "pending");

  const { data: owedToYou } = await supabase
    .from("reimbursement_obligations")
    .select("current_amount_cents")
    .eq("household_id", householdId)
    .eq("creditor_membership_id", membershipId)
    .eq("status", "pending");

  const youOwe = (owed ?? []).reduce((s, r) => s + r.current_amount_cents, 0);
  const youAreOwed = (owedToYou ?? []).reduce(
    (s, r) => s + r.current_amount_cents,
    0,
  );
  return {
    youOwe,
    youAreOwed,
    net: youAreOwed - youOwe,
  };
}
