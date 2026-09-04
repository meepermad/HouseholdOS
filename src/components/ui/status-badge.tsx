import { humanStatusLabel } from "@/lib/presentation/human-status";

const tone: Record<string, string> = {
  draft: "bg-surface-secondary text-text-secondary border-border",
  ready_for_review: "bg-warning-soft text-warning border-warning/40",
  confirmed: "bg-success-soft text-success border-success/40",
  amended: "bg-info-soft text-info border-info/40",
  voided: "bg-surface-secondary text-text-muted border-border-strong",
  submitted: "bg-warning-soft text-warning border-warning/40",
  rejected: "bg-destructive/10 text-destructive border-destructive/40",
  cancelled: "bg-surface-secondary text-text-muted border-border-strong",
  reversed: "bg-info-soft text-info border-info/40",
  unpaid: "bg-warning-soft text-warning border-warning/40",
  partially_settled: "bg-info-soft text-info border-info/40",
  settled: "bg-success-soft text-success border-success/40",
  open: "bg-warning-soft text-warning border-warning/40",
  under_review: "bg-info-soft text-info border-info/40",
  resolved: "bg-success-soft text-success border-success/40",
  withdrawn: "bg-surface-secondary text-text-muted border-border-strong",
  awaiting_confirmation: "bg-warning-soft text-warning border-warning/40",
  awaiting_intermediary_approval: "bg-warning-soft text-warning border-warning/40",
  awaiting_acceptance: "bg-warning-soft text-warning border-warning/40",
  ready_to_pay: "bg-info-soft text-info border-info/40",
  stale: "bg-surface-secondary text-text-muted border-border-strong",
};

export function ExpenseStatusBadge({ status }: { status: string }) {
  const label = humanStatusLabel(status);
  const classes =
    tone[status] ?? "bg-surface-secondary text-text-secondary border-border";

  return (
    <span
      className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-medium ${classes}`}
      data-status={status}
    >
      <span className="sr-only">Status: </span>
      {label}
    </span>
  );
}

export function PaymentStatusBadge({ status }: { status: string }) {
  return <ExpenseStatusBadge status={status} />;
}

export function SettlementStatusBadge({ status }: { status: string }) {
  return <ExpenseStatusBadge status={status} />;
}
