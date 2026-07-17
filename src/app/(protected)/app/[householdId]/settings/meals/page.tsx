import { AppBackButton } from "@/components/app-back-button";
import { ActionForm } from "@/components/action-form";
import { updateMealSettingsAction } from "@/app/actions/meals";
import { assertActiveMembership } from "@/lib/household-context";
import { can } from "@/lib/permissions";
import { getMealSettings } from "@/lib/meals/queries";
import { SHOPPING_PREP_POLICIES } from "@/lib/meals/types";

export const dynamic = "force-dynamic";

export default async function MealSettingsPage({
  params,
}: {
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = await params;
  const ctx = await assertActiveMembership(householdId);
  const settings = await getMealSettings(householdId);
  const canEdit = can(ctx.roles, "meal.settings");

  return (
    <main className="space-y-5">
      <AppBackButton fallbackHref={`/app/${householdId}/settings/profile`} />
      <header>
        <h1 className="font-[family-name:var(--font-display)] text-3xl">Meal settings</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Staple assumptions and shopping-prep policy after accepting a recipe.
        </p>
      </header>

      {canEdit ? (
        <ActionForm action={updateMealSettingsAction} pendingLabel="Saving…" className="space-y-4 max-w-lg">
          <input type="hidden" name="householdId" value={householdId} />
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="assumeStaplesAvailable"
              value="true"
              defaultChecked={Boolean(settings.assume_staples_available)}
              className="size-4"
            />
            Assume pantry staples are available when marked
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium">Shopping prep policy</span>
            <select
              name="shoppingPrepPolicy"
              defaultValue={settings.shopping_prep_policy ?? "suggest_and_confirm"}
              className="min-h-11 w-full rounded-md border border-border bg-surface px-3"
            >
              {SHOPPING_PREP_POLICIES.map((p) => (
                <option key={p} value={p}>
                  {p.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="min-h-11 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground"
          >
            Save settings
          </button>
        </ActionForm>
      ) : (
        <p className="text-sm text-text-secondary">
          Only household coordinators can change meal settings. Current policy:{" "}
          {String(settings.shopping_prep_policy ?? "suggest_and_confirm").replaceAll("_", " ")}.
        </p>
      )}
    </main>
  );
}
