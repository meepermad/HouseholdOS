import { notFound } from "next/navigation";
import { AppBackButton } from "@/components/app-back-button";
import { assertActiveMembership } from "@/lib/household-context";
import { getPantryItem } from "@/lib/house/queries";
import { markPantryFinishedFormAction, discardPantryItemFormAction } from "@/app/actions/house";
import { classifyPantryDateState } from "@/lib/house/pantry-dates";

export const dynamic = "force-dynamic";

export default async function PantryDetailPage({
  params,
}: {
  params: Promise<{ householdId: string; itemId: string }>;
}) {
  const { householdId, itemId } = await params;
  await assertActiveMembership(householdId);
  const result = await getPantryItem(householdId, itemId);
  if (!result) notFound();
  const { item } = result;
  const review = classifyPantryDateState({
    useSoon: item.useSoonAt,
    useBy: item.useBy,
    bestBy: item.bestBy,
  });

  return (
    <main className="space-y-5">
      <AppBackButton fallbackHref={`/app/${householdId}/house/pantry`} />
      <header>
        <h1 className="font-[family-name:var(--font-display)] text-3xl">{item.name}</h1>
        {review.reviewLabel ? (
          <p className="mt-2 text-sm text-text-secondary">{review.reviewLabel}</p>
        ) : null}
      </header>
      <div className="flex flex-wrap gap-2">
        <form action={markPantryFinishedFormAction}>
          <input type="hidden" name="householdId" value={householdId} />
          <input type="hidden" name="itemId" value={itemId} />
          <button
            type="submit"
            className="min-h-11 rounded-md border border-border px-4 py-2.5 text-sm"
          >
            Mark finished
          </button>
        </form>
        <form action={discardPantryItemFormAction}>
          <input type="hidden" name="householdId" value={householdId} />
          <input type="hidden" name="itemId" value={itemId} />
          <button
            type="submit"
            className="min-h-11 rounded-md border border-border px-4 py-2.5 text-sm"
          >
            Discard
          </button>
        </form>
      </div>
    </main>
  );
}
