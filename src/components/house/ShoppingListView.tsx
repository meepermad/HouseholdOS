import { EmptyState } from "@/components/ui/empty-state";
import { SHOPPING_CATEGORY_LABELS } from "@/lib/house/categories";
import type { ShoppingCategory } from "@/lib/house/categories";
import type { ShoppingListItemView } from "@/lib/house/queries";
import { ShoppingItemRow } from "./ShoppingItemRow";
import { ShoppingQuickAdd } from "./ShoppingQuickAdd";

const OPEN_STATUSES = new Set(["requested", "approved", "assigned", "in_cart"]);

/** Mobile grocery-trip layout: sticky quick add, grouped by category, no tables. */
export function ShoppingListView({
  householdId,
  listId,
  items,
  currentMembershipId,
}: {
  householdId: string;
  listId: string;
  items: ShoppingListItemView[];
  currentMembershipId: string;
}) {
  const open = items.filter((item) => OPEN_STATUSES.has(item.status));
  const closed = items.filter((item) => !OPEN_STATUSES.has(item.status));

  const groups = new Map<ShoppingCategory, ShoppingListItemView[]>();
  for (const item of open) {
    groups.set(item.category, [...(groups.get(item.category) ?? []), item]);
  }

  return (
    <div className="space-y-5">
      <div className="sticky top-0 z-10 -mx-4 border-b border-border bg-surface-page px-4 py-3 sm:static sm:mx-0 sm:rounded-md sm:border sm:border-border sm:bg-surface">
        <ShoppingQuickAdd householdId={householdId} listId={listId} />
      </div>
      {open.length === 0 ? (
        <EmptyState
          title="Shopping list is empty"
          description="Add an item above to start your next trip."
          testId="shopping-list-empty"
        />
      ) : (
        [...groups.entries()].map(([category, rows]) => (
          <section key={category} className="space-y-2" data-testid="shopping-category-group">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">
              {SHOPPING_CATEGORY_LABELS[category]}
            </h2>
            <ul className="rounded-md border border-border bg-surface">
              {rows.map((item) => (
                <ShoppingItemRow
                  key={item.id}
                  householdId={householdId}
                  item={item}
                  currentMembershipId={currentMembershipId}
                />
              ))}
            </ul>
          </section>
        ))
      )}
      {closed.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">Completed</h2>
          <ul className="rounded-md border border-border bg-surface-secondary">
            {closed.map((item) => (
              <ShoppingItemRow
                key={item.id}
                householdId={householdId}
                item={item}
                currentMembershipId={currentMembershipId}
              />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
