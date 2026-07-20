import { assertActiveMembership } from "@/lib/household-context";
import { listActiveMemberOptions } from "@/lib/expenses/queries";
import {
  getOpenRoutedCorrection,
  getRoutedProposal,
} from "@/lib/payments/opening-routed-queries";
import { RoutedProposalActions } from "@/components/payments/RoutedProposalActions";
import { AppBackButton } from "@/components/app-back-button";
import { formatMoney } from "@/lib/expenses/display";
import { householdRoutes } from "@/lib/routes/household";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function RoutedProposalDetailPage({
  params,
}: {
  params: Promise<{ householdId: string; proposalId: string }>;
}) {
  const { householdId, proposalId } = await params;
  const ctx = await assertActiveMembership(householdId);
  const [proposal, members, correction] = await Promise.all([
    getRoutedProposal(householdId, proposalId),
    listActiveMemberOptions(householdId),
    getOpenRoutedCorrection(householdId, proposalId),
  ]);
  if (!proposal) notFound();

  const label = (id: string) =>
    members.find((m) => m.id === id)?.label ?? id.slice(0, 8);

  let role: "payer" | "intermediary" | "recipient" | "other" = "other";
  if (ctx.membershipId === proposal.payer_membership_id) role = "payer";
  else if (ctx.membershipId === proposal.intermediary_membership_id)
    role = "intermediary";
  else if (ctx.membershipId === proposal.recipient_membership_id) role = "recipient";

  return (
    <main className="space-y-6">
      <AppBackButton fallbackHref={householdRoutes.money.simplify(householdId)} />
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
          Routed payment
        </h1>
        <p className="mt-2 text-sm text-text-muted">
          {label(proposal.payer_membership_id)} pays{" "}
          {label(proposal.recipient_membership_id)} outside the app on behalf of the
          chain through {label(proposal.intermediary_membership_id)}.
        </p>
      </div>

      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-text-muted">Amount</dt>
          <dd className="font-semibold tabular-nums">
            {formatMoney(proposal.amount_cents)}
          </dd>
        </div>
        <div>
          <dt className="text-text-muted">Status</dt>
          <dd data-testid="routed-status">{proposal.status}</dd>
        </div>
      </dl>

      <RoutedProposalActions
        householdId={householdId}
        proposalId={proposal.id}
        status={proposal.status}
        role={role}
        correction={
          correction
            ? { id: correction.id, status: correction.status }
            : null
        }
      />
    </main>
  );
}
