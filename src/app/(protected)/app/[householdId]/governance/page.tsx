import Link from "next/link";
import { assertActiveMembership } from "@/lib/household-context";
import {
  listGovernanceDocuments,
  listOpenApprovalRequests,
  listPendingAcknowledgments,
  listTransitions,
} from "@/lib/governance/queries";
import { LEGAL_COORDINATION_NOTICE } from "@/lib/governance/types";
import { GovernanceStatusBadge } from "@/components/governance/GovernanceStatusBadge";
import type { GovernanceStatus } from "@/lib/governance/types";

export default async function GovernanceDashboardPage({
  params,
}: {
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = await params;
  const membership = await assertActiveMembership(householdId);
  const [docs, approvals, acks, transitions] = await Promise.all([
    listGovernanceDocuments(householdId),
    listOpenApprovalRequests(householdId),
    listPendingAcknowledgments(householdId, membership.membershipId),
    listTransitions(householdId),
  ]);

  const active = docs.filter((d) => d.status === "active");
  const drafts = docs.filter((d) =>
    ["draft", "rejected", "withdrawn"].includes(d.status),
  );
  const activeTransitions = transitions.filter(
    (t) => !["completed", "cancelled"].includes(t.status),
  );

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-6 pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Governance</h1>
          <p className="text-sm text-text-secondary">
            Household agreements, policies, approvals, and move-in/out checklists
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/app/${householdId}/governance/templates`}
            className="min-h-11 rounded-md border border-border px-4 py-2.5 text-sm"
          >
            Templates
          </Link>
          <Link
            href={`/app/${householdId}/governance/new`}
            className="min-h-11 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground"
          >
            New draft
          </Link>
        </div>
      </header>

      <p className="rounded-md border border-border bg-surface-muted px-3 py-2 text-xs text-text-secondary">
        {LEGAL_COORDINATION_NOTICE}
      </p>

      <nav className="flex flex-wrap gap-2 text-sm">
        {[
          ["Active", "active"],
          ["Drafts", "drafts"],
          ["Approvals", "approvals"],
          ["Acknowledgments", "acknowledgments"],
          ["Transitions", "transitions"],
          ["Settings", "settings"],
        ].map(([label, path]) => (
          <Link
            key={path}
            href={
              path === "settings"
                ? `/app/${householdId}/settings/governance`
                : `/app/${householdId}/governance/${path}`
            }
            className="min-h-11 rounded-md border border-border px-3 py-2"
          >
            {label}
          </Link>
        ))}
      </nav>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Needs your attention</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <Link
            href={`/app/${householdId}/governance/approvals`}
            className="rounded-md border border-border p-4"
          >
            <p className="font-medium">Pending approvals</p>
            <p className="text-2xl font-semibold">{approvals.length}</p>
          </Link>
          <Link
            href={`/app/${householdId}/governance/acknowledgments`}
            className="rounded-md border border-border p-4"
          >
            <p className="font-medium">Pending acknowledgments</p>
            <p className="text-2xl font-semibold">{acks.length}</p>
          </Link>
          <Link
            href={`/app/${householdId}/governance/transitions`}
            className="rounded-md border border-border p-4"
          >
            <p className="font-medium">Active transitions</p>
            <p className="text-2xl font-semibold">{activeTransitions.length}</p>
          </Link>
          <Link
            href={`/app/${householdId}/governance/drafts`}
            className="rounded-md border border-border p-4"
          >
            <p className="font-medium">Your drafts</p>
            <p className="text-2xl font-semibold">{drafts.length}</p>
          </Link>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Active policies</h2>
        {active.length === 0 ? (
          <p className="text-sm text-text-secondary">No active policies yet.</p>
        ) : (
          <ul className="space-y-2">
            {active.map((doc) => (
              <li key={doc.id}>
                <Link
                  href={`/app/${householdId}/governance/documents/${doc.id}`}
                  className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-3"
                >
                  <span className="font-medium">{doc.title}</span>
                  <GovernanceStatusBadge status={doc.status as GovernanceStatus} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
