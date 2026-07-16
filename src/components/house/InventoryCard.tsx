import Link from "next/link";
import type { InventoryItemView } from "@/lib/house/queries";
import { INVENTORY_CATEGORY_LABELS } from "@/lib/house/categories";
import { OWNERSHIP_MODE_LABELS } from "@/lib/house/ownership";
import { formatQuantityLabel } from "@/lib/house/quantity";
import { ConditionBadge, InventoryStatusBadge } from "./ConditionBadge";

export function InventoryCard({
  householdId,
  item,
}: {
  householdId: string;
  item: InventoryItemView;
}) {
  return (
    <li className="border-b border-border last:border-b-0">
      <Link
        href={`/app/${householdId}/house/inventory/${item.id}`}
        className="block min-h-11 px-4 py-3.5 hover:bg-surface-interactive"
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="font-medium text-text-primary">{item.name}</p>
            <p className="mt-1 text-sm text-text-secondary">
              {INVENTORY_CATEGORY_LABELS[item.category]} ·{" "}
              {formatQuantityLabel({
                amount: item.quantity,
                unit: item.quantityUnit,
                isApproximate: item.quantityIsApproximate,
              })}
              {item.locationName ? ` · ${item.locationName}` : ""}
            </p>
            {item.ownershipMode !== "household" ? (
              <p className="mt-1 text-xs text-text-muted">
                {OWNERSHIP_MODE_LABELS[item.ownershipMode]}
                {item.ownerLabel ? ` · ${item.ownerLabel}` : ""}
              </p>
            ) : null}
          </div>
          <div className="flex flex-col items-end gap-1">
            <InventoryStatusBadge status={item.status} />
            <ConditionBadge condition={item.condition} />
          </div>
        </div>
      </Link>
    </li>
  );
}
