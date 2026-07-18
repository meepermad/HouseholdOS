import { AppBackButton } from "@/components/app-back-button";
import { ShoppingIntelSettingsForm } from "@/components/shopping/ShoppingIntelSettingsForm";
import { assertActiveMembership } from "@/lib/household-context";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ShoppingSettingsPage({
  params,
}: {
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = await params;
  await assertActiveMembership(householdId);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any;
  await supabase.rpc("ensure_shopping_recommendation_preferences", {
    p_household_id: householdId,
  });
  const [{ data: shopping }, { data: rediscovery }] = await Promise.all([
    supabase
      .from("shopping_recommendation_preferences")
      .select("*")
      .eq("household_id", householdId)
      .maybeSingle(),
    supabase
      .from("recipe_rediscovery_preferences")
      .select("*")
      .eq("household_id", householdId)
      .maybeSingle(),
  ]);

  return (
    <main className="space-y-6" data-testid="shopping-settings">
      <AppBackButton fallbackHref={`/app/${householdId}/settings`} />
      <header>
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
          Shopping & recipe suggestions
        </h1>
        <p className="mt-2 text-sm text-text-secondary">
          Deterministic, reviewable recommendations. No retailer checkout or location
          tracking.
        </p>
      </header>
      <ShoppingIntelSettingsForm
        householdId={householdId}
        shopping={{
          enabled: shopping?.enabled !== false,
          includeSupplyForecasts: shopping?.include_supply_forecasts !== false,
          includeRecurringStaples: shopping?.include_recurring_staples !== false,
          includeProposedMeals:
            shopping?.include_proposed_meal_ingredients !== false,
          includeGuestNeeds: shopping?.include_guest_needs !== false,
          forecastConfidence: String(
            shopping?.forecast_confidence_threshold ?? "medium",
          ),
          horizonDays: Number(shopping?.recommendation_horizon_days ?? 10),
          showPersonalSeparately: shopping?.show_personal_separately !== false,
        }}
        rediscovery={{
          enabled: rediscovery?.enabled !== false,
          cadence: String(rediscovery?.cadence ?? "smart"),
          minDays: Number(rediscovery?.min_days_since_prepared ?? 45),
          maxSuggestions: Number(rediscovery?.max_suggestions_per_trip ?? 2),
          allowPush: rediscovery?.allow_push_reminders !== false,
          includeGuestFriendly: rediscovery?.include_guest_friendly !== false,
          includeMealPrep: rediscovery?.include_meal_prep_favorites !== false,
        }}
      />
    </main>
  );
}
