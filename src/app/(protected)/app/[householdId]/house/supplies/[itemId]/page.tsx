import { notFound } from "next/navigation";
import { AppBackButton } from "@/components/app-back-button";
import { assertActiveMembership } from "@/lib/household-context";
import { getSupplyItem } from "@/lib/house/queries";
import { SUPPLY_STOCK_LABELS } from "@/lib/house/display";

export const dynamic = "force-dynamic";

export default async function SupplyDetailPage({
  params,
}: {
  params: Promise<{ householdId: string; itemId: string }>;
}) {
  const { householdId, itemId } = await params;
  await assertActiveMembership(householdId);
  const result = await getSupplyItem(householdId, itemId);
  if (!result) notFound();
  const { item, stockEvents } = result;

  return (
    <main className="space-y-5">
      <AppBackButton fallbackHref={`/app/${householdId}/house/supplies`} />
      <header>
        <h1 className="font-[family-name:var(--font-display)] text-3xl">{item.name}</h1>
        <p className="mt-1 text-sm text-text-secondary">
          {SUPPLY_STOCK_LABELS[item.stockState] ?? item.stockState}
          {item.quantity != null ? ` · ~${item.quantity} ${item.quantityUnit}` : null}
        </p>
      </header>
      <section className="space-y-2">
        <h2 className="font-semibold">Recent stock history</h2>
        {stockEvents.length === 0 ? (
          <p className="text-sm text-text-secondary">No stock events yet.</p>
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border text-sm">
            {stockEvents.map((e) => (
              <li key={e.id} className="px-4 py-3">
                {e.eventType}
                <span className="ml-2 text-text-muted">
                  {new Date(e.createdAt).toLocaleString()}
                </span>
                {e.note ? <p className="text-text-secondary">{e.note}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
