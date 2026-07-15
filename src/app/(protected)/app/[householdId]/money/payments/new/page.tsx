import { assertActiveMembership } from "@/lib/household-context";
import { listActiveMemberOptions } from "@/lib/expenses/queries";
import { listObligationBalances } from "@/lib/payments/queries";
import { SettleUpForm } from "@/components/payments/settle-up-form";
import { AppBackButton } from "@/components/app-back-button";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function NewPaymentPage({
  params,
}: {
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = await params;
  const ctx = await assertActiveMembership(householdId);
  const supabase = await createClient();
  const [{ data: household }, members, balances] = await Promise.all([
    supabase.from("households").select("currency").eq("id", householdId).single(),
    listActiveMemberOptions(householdId),
    listObligationBalances(householdId),
  ]);

  const obligations = balances
    .filter(
      (b) =>
        b.debtor_membership_id === ctx.membershipId &&
        b.official_outstanding_cents > 0,
    )
    .map((b) => ({
      id: b.obligation_id,
      householdId: b.household_id,
      debtorMembershipId: b.debtor_membership_id,
      creditorMembershipId: b.creditor_membership_id,
      currency: household?.currency ?? "USD",
      effectiveAmountCents: b.effective_amount_cents,
      officialOutstandingCents: b.official_outstanding_cents,
      createdAt: b.created_at,
    }));

  return (
    <main className="space-y-6">
      <AppBackButton fallbackHref={`/app/${householdId}/money/payments`} />
      <header className="space-y-2">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
          Record external payment
        </h1>
        <p className="text-sm text-text-secondary">
          Record a payment already sent outside HouseholdOS. The recipient must confirm
          receipt before official balances change.
        </p>
      </header>
      <SettleUpForm
        householdId={householdId}
        senderMembershipId={ctx.membershipId}
        currency={household?.currency ?? "USD"}
        members={members}
        obligations={obligations}
      />
    </main>
  );
}
