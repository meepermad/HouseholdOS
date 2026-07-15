import { statusLabel } from "@/lib/expenses/display";

const tone: Record<string, string> = {
  draft: "bg-surface-secondary text-text-secondary border-border",
  ready_for_review: "bg-warning-soft text-warning border-warning/40",
  confirmed: "bg-success-soft text-success border-success/40",
  amended: "bg-info-soft text-info border-info/40",
  voided: "bg-surface-secondary text-text-muted border-border-strong",
};

export function ExpenseStatusBadge({ status }: { status: string }) {
  const label = statusLabel(status);
  const classes =
    tone[status] ?? "bg-surface-secondary text-text-secondary border-border";

  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${classes}`}
      data-status={status}
    >
      <span className="sr-only">Status: </span>
      {label}
    </span>
  );
}
