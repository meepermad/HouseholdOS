import Link from "next/link";
import { assertActiveMembership } from "@/lib/household-context";
import { listActiveMemberOptions } from "@/lib/expenses/queries";
import { listObligationBalances, loadObligationPurchaseSources } from "@/lib/payments/queries";
import { obligationPurchaseLabel, sourceFromMaps } from "@/lib/payments/obligation-source";
import { SettleUpForm } from "@/components/payments/settle-up-form";
import { AppBackButton } from "@/components/app-back-button";
import { createClient } from "@/lib/supabase/server";
import type { SettlementDirection, SettlementExpense } from "@/lib/payments/selection";

export const dynamic = "force-dynamic";

export default async function NewPaymentPage({
  params,
  searchParams,
}: {
  params: Promise<{ householdId: string }>;
  searchParams: Promise<{ direction?: string; counterparty?: string }>;
}) {
  const { householdId } = await params;
  const sp = await searchParams;
  const ctx = await assertActiveMembership(householdId);
  const supabase = await createClient();
  const [{ data: household }, members, balances] = await Promise.all([
    supabase.from("households").select("currency").eq("id", householdId).single(),
    listActiveMemberOptions(householdId),
    listObligationBalances(householdId),
  ]);

  const sources = await loadObligationPurchaseSources(
    householdId,
    balances.map((balance) => balance.expense_id),
  );
  const currency = household?.currency ?? "USD";
  const expenses: SettlementExpense[] = balances
    .filter(
      (balance) =>
        (balance.debtor_membership_id === ctx.membershipId ||
          balance.creditor_membership_id === ctx.membershipId) &&
        (balance.official_outstanding_cents > 0 || balance.pending_payment_cents > 0),
    )
    .map((balance) => {
      const source = sourceFromMaps(balance.expense_id, balance.obligation_kind, sources);
      const waiting =
        balance.official_outstanding_cents > 0 &&
        balance.pending_payment_cents >= balance.official_outstanding_cents;
      return {
        id: balance.obligation_id,
        label: obligationPurchaseLabel(source),
        householdId: balance.household_id,
        debtorMembershipId: balance.debtor_membership_id,
        creditorMembershipId: balance.creditor_membership_id,
        currency,
        effectiveAmountCents: balance.effective_amount_cents,
        officialOutstandingCents: balance.official_outstanding_cents,
        pendingPaymentCents: balance.pending_payment_cents,
        createdAt: balance.created_at,
        eligible: balance.stored_status !== "reversed" && balance.official_outstanding_cents > 0,
        ineligibleReason: waiting
          ? "A payment is already waiting for confirmation."
          : undefined,
      };
    });

  const canSend = expenses.some(
    (expense) =>
      expense.debtorMembershipId === ctx.membershipId &&
      expense.officialOutstandingCents - expense.pendingPaymentCents > 0,
  );
  const canReceive = expenses.some(
    (expense) =>
      expense.creditorMembershipId === ctx.membershipId &&
      expense.officialOutstandingCents > 0,
  );
  const direction: SettlementDirection =
    sp.direction === "received" || sp.direction === "sent"
      ? sp.direction
      : canSend
        ? "sent"
        : canReceive
          ? "received"
          : "sent";

  const base = `/app/${householdId}/money/payments/new`;
  const counterparty =
    sp.counterparty && /^[0-9a-f-]{36}$/i.test(sp.counterparty)
      ? sp.counterparty
      : undefined;

  return (
    <main className="space-y-6">
      <AppBackButton fallbackHref={`/app/${householdId}/money`} />
      <header className="space-y-2">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
          {direction === "received" ? "Record payment received" : "I sent payment"}
        </h1>
        <p className="text-sm text-text-secondary">
          {direction === "received"
            ? "Recording money you received settles that debt. The other person does not have to approve it."
            : "Recording money you sent tells your roommate. Their balance changes when they acknowledge it, or when they record the receipt themselves."}
        </p>
      </header>
      <div className="flex flex-wrap gap-2" data-testid="payment-direction">
        <Link
          href={`${base}?direction=sent${counterparty ? `&counterparty=${counterparty}` : ""}`}
          className={`inline-flex min-h-11 items-center rounded-md px-3 text-sm font-medium ${
            direction === "sent"
              ? "bg-primary text-primary-foreground"
              : "border border-border"
          }`}
          aria-current={direction === "sent" ? "page" : undefined}
        >
          I sent payment
        </Link>
        <Link
          href={`${base}?direction=received${counterparty ? `&counterparty=${counterparty}` : ""}`}
          className={`inline-flex min-h-11 items-center rounded-md px-3 text-sm font-medium ${
            direction === "received"
              ? "bg-primary text-primary-foreground"
              : "border border-border"
          }`}
          aria-current={direction === "received" ? "page" : undefined}
        >
          Record payment received
        </Link>
      </div>
      <SettleUpForm
        householdId={householdId}
        viewerMembershipId={ctx.membershipId}
        currency={currency}
        members={members}
        expenses={expenses}
        direction={direction}
        initialCounterpartyId={counterparty}
      />
    </main>
  );
}
