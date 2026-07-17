import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { NavBadgeCounts } from "@/components/household-nav";

/**
 * Badge counts for mobile nav. All zeros are omitted by the UI.
 * Failures degrade to empty counts rather than breaking the shell.
 */
export async function getNavBadgeCounts(
  householdId: string,
  membershipId: string,
): Promise<NavBadgeCounts> {
  const supabase = await createClient();
  const counts: NavBadgeCounts = {};

  try {
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const { data: assignments } = await supabase
      .from("chore_assignments")
      .select("id, chore_occurrences!inner(due_at, status)")
      .eq("household_id", householdId)
      .eq("membership_id", membershipId)
      .in("status", ["assigned", "accepted", "claimed"])
      .lte("chore_occurrences.due_at", endOfDay.toISOString())
      .in("chore_occurrences.status", [
        "scheduled",
        "in_progress",
        "reopened",
        "overdue",
      ]);

    const choresDue = assignments?.length ?? 0;
    if (choresDue > 0) counts.chores = choresDue;
  } catch {
    /* degrade */
  }

  try {
    const { count: moneyConfirm } = await supabase
      .from("payments")
      .select("id", { count: "exact", head: true })
      .eq("household_id", householdId)
      .eq("status", "submitted")
      .eq("recipient_membership_id", membershipId);

    if (moneyConfirm && moneyConfirm > 0) counts.money = moneyConfirm;
  } catch {
    /* degrade */
  }

  try {
    const { count: urgentMaint } = await supabase
      .from("maintenance_requests")
      .select("id", { count: "exact", head: true })
      .eq("household_id", householdId)
      .in("status", [
        "reported",
        "triaged",
        "assigned",
        "in_progress",
        "reopened",
        "waiting_on_household",
      ])
      .in("severity", ["urgent", "emergency_guidance"]);

    if (urgentMaint && urgentMaint > 0) counts.maintenance = urgentMaint;
  } catch {
    /* degrade */
  }

  return counts;
}
