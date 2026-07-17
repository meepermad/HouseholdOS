import Link from "next/link";
import { AppBackButton } from "@/components/app-back-button";
import { HouseHubTabs } from "@/components/house/HouseHubTabs";
import { assertActiveMembership } from "@/lib/household-context";
import { listMealPrepBatches } from "@/lib/meals/queries";

export const dynamic = "force-dynamic";

export default async function MealPrepPage({
  params,
}: {
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = await params;
  await assertActiveMembership(householdId);
  const batches = await listMealPrepBatches(householdId);

  return (
    <main className="space-y-5">
      <AppBackButton fallbackHref={`/app/${householdId}/house`} />
      <header>
        <h1 className="font-[family-name:var(--font-display)] text-3xl">Meal prep</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Approximate batches for later use. No portion claiming or leftover reservations.
        </p>
      </header>
      <HouseHubTabs householdId={householdId} />

      {batches.length === 0 ? (
        <p className="text-sm text-text-secondary">
          No meal-prep batches yet. Mark a meal prepared to create one.
        </p>
      ) : (
        <ul className="rounded-md border border-border divide-y divide-border">
          {batches.map((b) => (
            <li key={b.id}>
              <Link
                href={`/app/${householdId}/meal-prep/${b.id}`}
                className="block min-h-11 px-4 py-3.5 hover:bg-surface-interactive"
              >
                <span className="font-medium">{b.name}</span>
                <span className="text-text-secondary">
                  {" "}
                  · {b.remainingState.replaceAll("_", " ")} · {b.availability.replaceAll("_", " ")}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
