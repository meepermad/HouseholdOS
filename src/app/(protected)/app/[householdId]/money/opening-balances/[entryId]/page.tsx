import { assertActiveMembership } from "@/lib/household-context";
import { listActiveMemberOptions } from "@/lib/expenses/queries";
import { getOpeningBalance } from "@/lib/payments/opening-routed-queries";
import { OpeningBalanceActions } from "@/components/payments/OpeningBalanceActions";
import { AppBackButton } from "@/components/app-back-button";
import { formatMoney } from "@/lib/expenses/display";
import { householdRoutes } from "@/lib/routes/household";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function OpeningBalanceDetailPage({
  params,
}: {
  params: Promise<{ householdId: string; entryId: string }>;
}) {
  const { householdId, entryId } = await params;
  const ctx = await assertActiveMembership(householdId);
  const [entry, members] = await Promise.all([
    getOpeningBalance(householdId, entryId),
    listActiveMemberOptions(householdId),
  ]);
  if (!entry) notFound();

  const label = (id: string) =>
    members.find((m) => m.id === id)?.label ?? id.slice(0, 8);

  const isParty =
    ctx.membershipId === entry.debtor_membership_id ||
    ctx.membershipId === entry.creditor_membership_id;

  return (
    <main className="space-y-6">
      <AppBackButton fallbackHref={householdRoutes.money.openingBalances(householdId)} />
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
          Opening balance
        </h1>
        <p className="mt-2 text-sm text-text-muted">
          {label(entry.debtor_membership_id)} owes {label(entry.creditor_membership_id)}{" "}
          {formatMoney(entry.amount_cents)} as of {entry.effective_date}.
        </p>
      </div>
      <p className="text-sm" data-testid="opening-balance-status">
        Status: {entry.status}
      </p>
      <p className="whitespace-pre-wrap text-sm">{entry.explanation}</p>
      <OpeningBalanceActions
        householdId={householdId}
        entryId={entry.id}
        status={entry.status}
        isParty={isParty}
        isCreator={ctx.membershipId === entry.created_by_membership_id}
      />
    </main>
  );
}
