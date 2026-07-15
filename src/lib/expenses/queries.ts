import { createClient } from "@/lib/supabase/server";
import type { MemberOption } from "@/lib/expenses/display";
import { getSettlementBalancesForMembership } from "@/lib/payments/queries";

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

/** Official balances from ledger-derived outstanding (not raw current_amount_cents). */
export async function getBalancesForMembership(
  householdId: string,
  membershipId: string,
) {
  const { summary } = await getSettlementBalancesForMembership(
    householdId,
    membershipId,
  );
  return {
    youOwe: summary.officialYouOweCents,
    youAreOwed: summary.officialYouAreOwedCents,
    net: summary.officialNetCents,
    pendingOutgoing: summary.pendingOutgoingCents,
    pendingIncoming: summary.pendingIncomingCents,
    projectedYouOwe: summary.projectedYouOweCents,
    projectedYouAreOwed: summary.projectedYouAreOwedCents,
  };
}
