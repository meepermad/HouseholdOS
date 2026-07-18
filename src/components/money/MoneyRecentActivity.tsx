import Link from "next/link";
import { formatMoney } from "@/lib/expenses/display";
import type { ActivityItem } from "@/lib/money/activity";
import { EmptyState } from "@/components/ui/empty-state";

export function MoneyRecentActivity({
  householdId,
  items,
  canCreateExpense,
}: {
  householdId: string;
  items: ActivityItem[];
  canCreateExpense: boolean;
}) {
  return (
    <section className="space-y-2" data-testid="money-recent-activity">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">
        Recent activity
      </h2>
      {items.length === 0 ? (
        <EmptyState
          testId="money-activity-empty"
          title="No financial activity yet."
          description="Scan a receipt or add an expense to get started."
          action={
            canCreateExpense ? (
              <Link
                href={`/app/${householdId}/money/expenses/new`}
                className="inline-flex min-h-11 items-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
              >
                Add expense
              </Link>
            ) : undefined
          }
        />
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border bg-surface">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={item.href}
                className="flex flex-col gap-1 px-4 py-3.5 text-sm hover:bg-surface-interactive sm:flex-row sm:items-center sm:justify-between"
              >
                <span>
                  <span className="font-medium">{item.description}</span>
                  <span className="mt-0.5 block text-xs text-text-muted">
                    {item.statusLabel}
                    {item.secondary ? ` · ${item.secondary}` : null}
                    {" · "}
                    {item.date}
                  </span>
                </span>
                {item.amountCents != null ? (
                  <span className="tabular-nums text-text-secondary">
                    {formatMoney(item.amountCents)}
                  </span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
