import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { ReconciliationSummary } from "@/components/expenses/reconciliation-summary";
import { confirmExpenseAction } from "@/app/actions/expenses";
import { assertActiveMembership } from "@/lib/household-context";
import { formatMoney } from "@/lib/expenses/display";
import { loadExpenseBundle, recalculateBundle } from "@/lib/expenses/load-bundle";
import { listActiveMemberOptions } from "@/lib/expenses/queries";
import { PurchaseItemBreakdown } from "@/components/money/PurchaseItemBreakdown";
import { allocatedRowsToBreakdown } from "@/lib/money/purchase-breakdown";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ReviewExpensePage({
  params,
}: {
  params: Promise<{ householdId: string; expenseId: string }>;
}) {
  const { householdId, expenseId } = await params;
  await assertActiveMembership(householdId);
  const supabase = await createClient();
  const bundle = await loadExpenseBundle(supabase, expenseId);
  if (!bundle || bundle.expense.household_id !== householdId) notFound();

  if (bundle.expense.status === "confirmed") {
    redirect(`/app/${householdId}/money/expenses/${expenseId}`);
  }
  if (bundle.expense.status === "draft") {
    // Allow review from draft if already reconciled via direct URL after submit
  }

  const members = await listActiveMemberOptions(householdId);
  const calc = recalculateBundle(bundle);
  const e = bundle.expense;
  const idempotencyKey = `confirm-${expenseId}-${e.updated_at ?? e.created_at}`;

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Review & confirm</h1>
        <p className="text-sm text-text-secondary">
          Confirming adds this purchase to household balances. You can correct it
          later if something is wrong.
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-2 rounded-md border border-border bg-surface p-3 text-sm">
        <dt className="text-text-muted">Merchant</dt>
        <dd>{e.merchant}</dd>
        <dt className="text-text-muted">Date</dt>
        <dd>{e.purchase_date}</dd>
        <dt className="text-text-muted">Paid by</dt>
        <dd>
          {members.find((m) => m.id === e.payer_membership_id)?.label ?? "Payer"}
        </dd>
        <dt className="text-text-muted">Total</dt>
        <dd>{formatMoney(e.declared_total_cents)}</dd>
      </dl>

      <PurchaseItemBreakdown
        merchant={e.merchant}
        items={allocatedRowsToBreakdown(
          bundle.items.map((item) => ({
            id: item.id,
            name: item.description,
            totalCents: item.total_cents,
            allocationMode: item.allocation_mode,
            personalMembershipId: item.personal_membership_id,
            allocations: item.allocations,
          })),
          (id) => members.find((m) => m.id === id)?.label ?? id.slice(0, 8),
        )}
        adjustments={allocatedRowsToBreakdown(
          bundle.adjustments.map((adj) => ({
            id: adj.id,
            name: adj.description,
            totalCents: adj.amount_cents,
            allocationMode: adj.allocation_mode,
            personalMembershipId: adj.assigned_membership_id,
            allocations: adj.allocations,
          })),
          (id) => members.find((m) => m.id === id)?.label ?? id.slice(0, 8),
        )}
        testId="expense-review-item-breakdown"
      />

      <ReconciliationSummary
        calc={calc}
        members={members}
        declaredTotalCents={e.declared_total_cents}
      />

      <div className="flex flex-wrap gap-2">
        <Link
          href={`/app/${householdId}/money/expenses/${expenseId}/edit`}
          className="rounded-md border border-line px-4 py-2 text-sm"
        >
          Back to edit
        </Link>
        <ActionForm action={confirmExpenseAction} pendingLabel="Confirming expense…">
          <input type="hidden" name="householdId" value={householdId} />
          <input type="hidden" name="expenseId" value={expenseId} />
          <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
          <button
            type="submit"
            disabled={!calc.ok}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
            data-testid="confirm-expense"
          >
            Confirm expense
          </button>
        </ActionForm>
      </div>
    </main>
  );
}
