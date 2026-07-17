"use client";

import Link from "next/link";
import {
  maintenanceCategoryLabel,
  maintenanceSeverityLabel,
  maintenanceSeverityMark,
  maintenanceStatusLabel,
} from "@/lib/maintenance";
import type { MaintenanceListItem } from "@/lib/maintenance/queries";

export function MaintenanceCard({
  householdId,
  item,
}: {
  householdId: string;
  item: MaintenanceListItem;
}) {
  return (
    <Link
      href={`/app/${householdId}/maintenance/${item.id}`}
      className="block rounded-md border border-border bg-surface p-4 transition hover:border-primary"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h3 className="truncate text-base font-semibold text-text-primary">
            {item.title}
          </h3>
          <p className="text-sm text-text-secondary">
            {maintenanceCategoryLabel(item.category)} ·{" "}
            {maintenanceStatusLabel(item.status)}
          </p>
        </div>
        <span
          className="shrink-0 rounded border border-border px-2 py-1 text-xs font-medium"
          aria-label={`Severity ${maintenanceSeverityLabel(item.severity)}`}
        >
          <span aria-hidden="true" className="mr-1">
            {maintenanceSeverityMark(item.severity)}
          </span>
          {maintenanceSeverityLabel(item.severity)}
        </span>
      </div>
    </Link>
  );
}
