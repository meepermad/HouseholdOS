import "server-only";
import { createClient } from "@/lib/supabase/server";
import { formatUsdFromCents, toCents } from "@/lib/money";

export type WeeklyReviewLine = {
  text: string;
  href?: string;
};

export type WeeklyReview = {
  lastWeek: WeeklyReviewLine[];
  nextWeek: WeeklyReviewLine[];
  needsDiscussion: WeeklyReviewLine[];
};

function startOfWeek(d: Date): Date {
  const x = new Date(d);
  const day = x.getDay();
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - day);
  return x;
}

export async function buildWeeklyReview(
  householdId: string,
): Promise<WeeklyReview> {
  const supabase = await createClient();
  const now = new Date();
  const thisWeekStart = startOfWeek(now);
  const lastWeekStart = new Date(thisWeekStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);
  const nextWeekEnd = new Date(thisWeekStart);
  nextWeekEnd.setDate(nextWeekEnd.getDate() + 14);

  const lastWeek: WeeklyReviewLine[] = [];
  const nextWeek: WeeklyReviewLine[] = [];
  const needsDiscussion: WeeklyReviewLine[] = [];

  try {
    const { count: choresDone } = await supabase
      .from("chore_occurrences")
      .select("id", { count: "exact", head: true })
      .eq("household_id", householdId)
      .in("status", ["completed", "verified"])
      .gte("due_at", lastWeekStart.toISOString())
      .lt("due_at", thisWeekStart.toISOString());

    const { count: choresTotal } = await supabase
      .from("chore_occurrences")
      .select("id", { count: "exact", head: true })
      .eq("household_id", householdId)
      .gte("due_at", lastWeekStart.toISOString())
      .lt("due_at", thisWeekStart.toISOString())
      .not("status", "in", '("cancelled","skipped")');

    if ((choresTotal ?? 0) > 0) {
      lastWeek.push({
        text: `${choresDone ?? 0} of ${choresTotal} chores completed`,
        href: `/app/${householdId}/chores`,
      });
    }
  } catch {
    /* degrade */
  }

  try {
    const { data: expenses } = await supabase
      .from("expenses")
      .select("declared_total_cents")
      .eq("household_id", householdId)
      .gte("purchase_date", lastWeekStart.toISOString().slice(0, 10))
      .lt("purchase_date", thisWeekStart.toISOString().slice(0, 10));
    const total = (expenses ?? []).reduce(
      (sum, e) => sum + (e.declared_total_cents ?? 0),
      0,
    );
    if (total > 0) {
      lastWeek.push({
        text: `${formatUsdFromCents(toCents(total))} in shared expenses`,
        href: `/app/${householdId}/money`,
      });
    }
  } catch {
    /* degrade */
  }

  try {
    const { count: maintResolved } = await supabase
      .from("maintenance_requests")
      .select("id", { count: "exact", head: true })
      .eq("household_id", householdId)
      .in("status", ["resolved", "closed"])
      .gte("updated_at", lastWeekStart.toISOString())
      .lt("updated_at", thisWeekStart.toISOString());
    if ((maintResolved ?? 0) > 0) {
      lastWeek.push({
        text: `${maintResolved} maintenance item${maintResolved === 1 ? "" : "s"} resolved`,
        href: `/app/${householdId}/maintenance`,
      });
    }
  } catch {
    /* degrade */
  }

  try {
    const { data: meals } = await supabase
      .from("meal_plans")
      .select("id")
      .eq("household_id", householdId)
      .gte("meal_date", thisWeekStart.toISOString().slice(0, 10))
      .lt("meal_date", nextWeekEnd.toISOString().slice(0, 10))
      .limit(20);
    if ((meals ?? []).length > 0) {
      nextWeek.push({
        text: `${meals!.length} shared meal${meals!.length === 1 ? "" : "s"} planned`,
        href: `/app/${householdId}/meals`,
      });
    }
  } catch {
    /* degrade */
  }

  try {
    const { data: guests } = await supabase
      .from("guest_notices" as never)
      .select("id, guest_count, visit_date")
      .eq("household_id", householdId)
      .eq("status", "active")
      .gte("visit_date", thisWeekStart.toISOString().slice(0, 10))
      .lt("visit_date", nextWeekEnd.toISOString().slice(0, 10));
    const rows = (guests ?? []) as Array<{ guest_count: number }>;
    if (rows.length > 0) {
      const count = rows.reduce((s, g) => s + (g.guest_count ?? 0), 0);
      nextWeek.push({
        text: `${count} guest${count === 1 ? "" : "s"} expected`,
        href: `/app/${householdId}/calendar`,
      });
    }
  } catch {
    /* degrade */
  }

  try {
    const { count: openApprovals } = await supabase
      .from("governance_approval_requests")
      .select("id", { count: "exact", head: true })
      .eq("household_id", householdId)
      .eq("status", "open");
    if ((openApprovals ?? 0) > 0) {
      needsDiscussion.push({
        text: `${openApprovals} governance approval${openApprovals === 1 ? "" : "s"} awaiting decision`,
        href: `/app/${householdId}/governance/approvals`,
      });
    }
  } catch {
    /* degrade */
  }

  return { lastWeek, nextWeek, needsDiscussion };
}
