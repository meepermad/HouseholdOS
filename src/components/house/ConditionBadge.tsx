import { CONDITION_LABELS, INVENTORY_STATUS_LABELS } from "@/lib/house/display";
import type { InventoryCondition, InventoryStatus } from "@/lib/house/types";

export function StatusBadge({
  label,
  tone,
  testValue,
}: {
  label: string;
  tone?: string;
  testValue?: string;
}) {
  return (
    <span
      data-status={testValue}
      className={`inline-flex rounded-md border px-2.5 py-1 text-xs font-medium ${
        tone ?? "border-border bg-surface-secondary text-text-secondary"
      }`}
    >
      {label}
    </span>
  );
}

const CONDITION_TONES: Partial<Record<InventoryCondition, string>> = {
  new: "border-success/40 bg-success-soft text-success",
  good: "border-success/40 bg-success-soft text-success",
  fair: "border-warning/40 bg-warning-soft text-warning",
  worn: "border-warning/40 bg-warning-soft text-warning",
  damaged: "border-destructive/40 bg-destructive/10 text-destructive",
  repair_needed: "border-destructive/40 bg-destructive/10 text-destructive",
  unknown: "border-border-strong bg-surface-secondary text-text-muted",
};

export function ConditionBadge({ condition }: { condition: InventoryCondition }) {
  return (
    <StatusBadge
      label={CONDITION_LABELS[condition]}
      tone={CONDITION_TONES[condition]}
      testValue={condition}
    />
  );
}

const INVENTORY_STATUS_TONES: Partial<Record<InventoryStatus, string>> = {
  active: "border-success/40 bg-success-soft text-success",
  loaned: "border-info/40 bg-info-soft text-info",
  missing: "border-destructive/40 bg-destructive/10 text-destructive",
  damaged: "border-destructive/40 bg-destructive/10 text-destructive",
  repair_needed: "border-warning/40 bg-warning-soft text-warning",
  disposed: "border-border-strong bg-surface-secondary text-text-muted",
  donated: "border-border-strong bg-surface-secondary text-text-muted",
  sold: "border-border-strong bg-surface-secondary text-text-muted",
  moved_out: "border-border-strong bg-surface-secondary text-text-muted",
  returned: "border-border-strong bg-surface-secondary text-text-muted",
};

export function InventoryStatusBadge({ status }: { status: InventoryStatus }) {
  return (
    <StatusBadge
      label={INVENTORY_STATUS_LABELS[status]}
      tone={INVENTORY_STATUS_TONES[status]}
      testValue={status}
    />
  );
}
