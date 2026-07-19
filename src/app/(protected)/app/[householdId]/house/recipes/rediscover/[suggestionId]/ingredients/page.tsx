import { notFound } from "next/navigation";
import { AppBackButton } from "@/components/app-back-button";
import { RediscoveryIngredientReview } from "@/components/shopping/RediscoveryIngredientReview";
import { assertActiveMembership } from "@/lib/household-context";
import { prepareRediscoveryIngredients } from "@/lib/shopping/rediscovery/prepare-ingredients";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function RediscoveryIngredientsPage({
  params,
}: {
  params: Promise<{ householdId: string; suggestionId: string }>;
}) {
  const { householdId, suggestionId } = await params;
  const ctx = await assertActiveMembership(householdId);

  let prepared;
  try {
    prepared = await prepareRediscoveryIngredients({
      householdId,
      membershipId: ctx.membershipId,
      suggestionId,
    });
  } catch {
    notFound();
  }

  // Reload persisted lines so confirm uses DB line ids
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any;
  const { data: lines } = await supabase
    .from("recipe_rediscovery_ingredient_proposal_lines")
    .select(
      "id,display_name,line_status,shortfall_quantity,quantity_unit,excluded,unit_mismatch,required",
    )
    .eq("proposal_id", prepared.proposalId)
    .eq("household_id", householdId)
    .order("sort_order");

  const viewLines = (
    (lines ?? []) as Array<Record<string, unknown>>
  ).map((line) => ({
    id: String(line.id),
    displayName: String(line.display_name),
    lineStatus: String(line.line_status),
    shortfallQuantity:
      line.shortfall_quantity != null ? Number(line.shortfall_quantity) : null,
    quantityUnit: String(line.quantity_unit ?? "item"),
    excluded: Boolean(line.excluded),
    unitMismatch: Boolean(line.unit_mismatch),
    required: Boolean(line.required),
  }));

  return (
    <main className="space-y-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <AppBackButton
        fallbackHref={`/app/${householdId}/house/recipes/rediscover`}
      />
      {viewLines.length === 0 ? (
        <p className="text-sm text-text-muted" data-testid="no-missing-ingredients">
          Nothing missing right now for {prepared.recipeName}. Pantry coverage or
          the shopping list already covers the required ingredients.
        </p>
      ) : (
        <RediscoveryIngredientReview
          householdId={householdId}
          proposalId={prepared.proposalId}
          lines={viewLines}
          householdName={prepared.householdName}
          recipeName={prepared.recipeName}
        />
      )}
    </main>
  );
}
