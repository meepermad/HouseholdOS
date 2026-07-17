import {
  STATUS_LABELS,
  type GovernanceStatus,
} from "@/lib/governance/types";

const TONE: Record<GovernanceStatus, string> = {
  draft: "bg-surface-muted text-text-secondary",
  proposed: "bg-amber-500/15 text-amber-800 dark:text-amber-200",
  under_review: "bg-amber-500/15 text-amber-800 dark:text-amber-200",
  approved: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200",
  active: "bg-emerald-600/20 text-emerald-900 dark:text-emerald-100",
  superseded: "bg-surface-muted text-text-secondary",
  archived: "bg-surface-muted text-text-secondary",
  rejected: "bg-red-500/15 text-red-800 dark:text-red-200",
  withdrawn: "bg-surface-muted text-text-secondary",
};

export function GovernanceStatusBadge({ status }: { status: GovernanceStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${TONE[status] ?? TONE.draft}`}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}
