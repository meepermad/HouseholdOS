import { notFound } from "next/navigation";
import { AppBackButton } from "@/components/app-back-button";
import { HouseHubTabs } from "@/components/house/HouseHubTabs";
import { ActionForm } from "@/components/action-form";
import { updateBatchRemainingAction } from "@/app/actions/meals";
import { assertActiveMembership } from "@/lib/household-context";
import { getMealBatch } from "@/lib/meals/queries";
import { BATCH_REMAINING_STATES } from "@/lib/meals/types";

export const dynamic = "force-dynamic";

export default async function MealBatchPage({
  params,
}: {
  params: Promise<{ householdId: string; batchId: string }>;
}) {
  const { householdId, batchId } = await params;
  await assertActiveMembership(householdId);
  const batch = await getMealBatch(householdId, batchId);
  if (!batch) notFound();

  return (
    <main className="space-y-5">
      <AppBackButton fallbackHref={`/app/${householdId}/meal-prep`} />
      <header>
        <h1 className="font-[family-name:var(--font-display)] text-3xl">{batch.name}</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Remaining: {String(batch.remaining_state).replaceAll("_", " ")}. Shared
          approximate leftovers only — no individual portion claims.
        </p>
      </header>
      <HouseHubTabs householdId={householdId} />

      <ActionForm action={updateBatchRemainingAction} pendingLabel="Updating leftovers…" className="space-y-3">
        <input type="hidden" name="householdId" value={householdId} />
        <input type="hidden" name="batchId" value={batchId} />
        <label className="block space-y-1">
          <span className="text-sm font-medium">Approximate remaining</span>
          <select
            name="remainingState"
            defaultValue={batch.remaining_state}
            className="min-h-11 w-full rounded-md border border-border bg-surface px-3"
          >
            {BATCH_REMAINING_STATES.map((s) => (
              <option key={s} value={s}>
                {s.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="min-h-11 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground"
        >
          Update leftovers
        </button>
      </ActionForm>
    </main>
  );
}
