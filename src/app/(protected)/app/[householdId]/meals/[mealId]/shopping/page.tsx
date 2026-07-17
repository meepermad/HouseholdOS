import { notFound } from "next/navigation";
import { AppBackButton } from "@/components/app-back-button";
import { HouseHubTabs } from "@/components/house/HouseHubTabs";
import { MealShoppingPrepReview } from "@/components/meals/MealShoppingPrepReview";
import { assertActiveMembership } from "@/lib/household-context";
import { getMealPlan, getMealSettings } from "@/lib/meals/queries";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function MealShoppingPage({
  params,
}: {
  params: Promise<{ householdId: string; mealId: string }>;
}) {
  const { householdId, mealId } = await params;
  await assertActiveMembership(householdId);
  const detail = await getMealPlan(householdId, mealId);
  if (!detail) notFound();
  const settings = await getMealSettings(householdId);

  let proposal = detail.proposal as {
    id: string;
    policy_snapshot?: string;
    meal_shopping_proposal_lines?: Array<Record<string, unknown>>;
  } | null;

  if (!proposal) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (await createClient()) as any;
    const { data } = await supabase.rpc("build_meal_shopping_proposal", {
      p_meal_plan_id: mealId,
    });
    if (data) {
      const refreshed = await getMealPlan(householdId, mealId);
      proposal = refreshed?.proposal as typeof proposal;
    }
  }

  const lines = (proposal?.meal_shopping_proposal_lines ?? []) as Array<{
    id: string;
    display_name: string;
    line_status: string;
    shortfall_quantity: number | string | null;
    quantity_unit: string;
    excluded: boolean;
  }>;

  return (
    <main className="space-y-5">
      <AppBackButton fallbackHref={`/app/${householdId}/meals/${mealId}`} />
      <header>
        <h1 className="font-[family-name:var(--font-display)] text-3xl">
          Shopping for {detail.plan.title}
        </h1>
      </header>
      <HouseHubTabs householdId={householdId} />
      {proposal ? (
        <MealShoppingPrepReview
          householdId={householdId}
          proposalId={proposal.id}
          lines={lines}
          policy={
            proposal.policy_snapshot ??
            settings.shopping_prep_policy ??
            "suggest_and_confirm"
          }
        />
      ) : (
        <p className="text-sm text-text-secondary">No shopping proposal available.</p>
      )}
    </main>
  );
}
