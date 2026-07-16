import Link from "next/link";
import type { SupplyItemView } from "@/lib/house/queries";
import { SUPPLY_CATEGORY_LABELS } from "@/lib/house/categories";
import { formatQuantityLabel } from "@/lib/house/quantity";
import { StatusBadge } from "./ConditionBadge";

const STOCK_TONES: Record<SupplyItemView["stockState"], string> = {
  in_stock: "border-success/40 bg-success-soft text-success",
  low: "border-warning/40 bg-warning-soft text-warning",
  out: "border-destructive/40 bg-destructive/10 text-destructive",
  unknown: "border-border-strong bg-surface-secondary text-text-muted",
};

const STOCK_LABELS: Record<SupplyItemView["stockState"], string> = {
  in_stock: "In stock",
  low: "Low",
  out: "Out",
  unknown: "Unknown",
};

export function SupplyCard({
  householdId,
  item,
}: {
  householdId: string;
  item: SupplyItemView;
}) {
  return (
    <li className="border-b border-border last:border-b-0">
      <Link
        href={`/app/${householdId}/house/supplies/${item.id}`}
        className="block min-h-11 px-4 py-3.5 hover:bg-surface-interactive"
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="font-medium text-text-primary">{item.name}</p>
            <p className="mt-1 text-sm text-text-secondary">
              {SUPPLY_CATEGORY_LABELS[item.category]} ·{" "}
              {formatQuantityLabel({
                amount: item.quantity,
                unit: item.quantityUnit,
                isApproximate: item.quantityIsApproximate,
              })}
              {item.locationName ? ` · ${item.locationName}` : ""}
            </p>
            {item.responsibleLabel ? (
              <p className="mt-1 text-xs text-text-muted">Responsible: {item.responsibleLabel}</p>
            ) : null}
          </div>
          <StatusBadge label={STOCK_LABELS[item.stockState]} tone={STOCK_TONES[item.stockState]} testValue={item.stockState} />
        </div>
      </Link>
    </li>
  );
}
