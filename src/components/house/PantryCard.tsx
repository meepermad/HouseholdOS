import Link from "next/link";
import type { PantryItemView } from "@/lib/house/queries";
import { PANTRY_CATEGORY_LABELS } from "@/lib/house/categories";
import { formatQuantityLabel } from "@/lib/house/quantity";
import { StatusBadge } from "./ConditionBadge";

const STATE_TONES: Record<PantryItemView["state"], string> = {
  available: "border-success/40 bg-success-soft text-success",
  low: "border-warning/40 bg-warning-soft text-warning",
  use_soon: "border-warning/40 bg-warning-soft text-warning",
  expired: "border-destructive/40 bg-destructive/10 text-destructive",
  finished: "border-border-strong bg-surface-secondary text-text-muted",
  discarded: "border-border-strong bg-surface-secondary text-text-muted",
  unknown: "border-border-strong bg-surface-secondary text-text-muted",
};

const STATE_LABELS: Record<PantryItemView["state"], string> = {
  available: "Available",
  low: "Low",
  use_soon: "Use soon",
  expired: "Past entered date",
  finished: "Finished",
  discarded: "Discarded",
  unknown: "Unknown",
};

export function PantryCard({
  householdId,
  item,
}: {
  householdId: string;
  item: PantryItemView;
}) {
  return (
    <li className="border-b border-border last:border-b-0">
      <Link
        href={`/app/${householdId}/house/pantry/${item.id}`}
        className="block min-h-11 px-4 py-3.5 hover:bg-surface-interactive"
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="font-medium text-text-primary">{item.name}</p>
            <p className="mt-1 text-sm text-text-secondary">
              {PANTRY_CATEGORY_LABELS[item.category]} ·{" "}
              {formatQuantityLabel({ amount: item.quantity, unit: item.quantityUnit })}
              {item.locationName ? ` · ${item.locationName}` : ""}
            </p>
            {item.ownershipMode === "personal" ? (
              <p className="mt-1 text-xs text-text-muted">Personal{item.ownerLabel ? ` · ${item.ownerLabel}` : ""}</p>
            ) : null}
          </div>
          <StatusBadge label={STATE_LABELS[item.state]} tone={STATE_TONES[item.state]} testValue={item.state} />
        </div>
      </Link>
    </li>
  );
}
