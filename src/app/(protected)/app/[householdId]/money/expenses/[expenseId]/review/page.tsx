import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { ReconciliationSummary } from "@/components/expenses/reconciliation-summary";
import { confirmExpenseAction } from "@/app/actions/expenses";
import { assertActiveMembership } from "@/lib/household-context";
import { formatMoney } from "@/lib/expenses/display";
import { loadExpenseBundle, recalculateBundle } from "@/lib/expenses/load-bundle";
import { listActiveMemberOptions } from "@/lib/expenses/queries";
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
        <p className="text-sm text-slate-600">
          Confirming writes this expense into the household financial record. Later
          corrections require an amendment or void and will be audited.
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-2 rounded-md border border-line bg-surface p-3 text-sm">
        <dt className="text-slate-500">Merchant</dt>
        <dd>{e.merchant}</dd>
        <dt className="text-slate-500">Date</dt>
        <dd>{e.purchase_date}</dd>
        <dt className="text-slate-500">Payer</dt>
        <dd>
          {members.find((m) => m.id === e.payer_membership_id)?.label ?? "Payer"}
        </dd>
        <dt className="text-slate-500">Total</dt>
        <dd>{formatMoney(e.declared_total_cents)}</dd>
      </dl>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Items
        </h2>
        <ul className="space-y-1 text-sm">
          {bundle.items.map((item) => (
            <li key={item.id} className="flex justify-between">
              <span>
                {item.description}{" "}
                <span className="text-xs text-slate-500">({item.allocation_mode})</span>
              </span>
              <span>{formatMoney(item.total_cents)}</span>
            </li>
          ))}
        </ul>
      </section>

      {bundle.adjustments.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Adjustments
          </h2>
          <ul className="space-y-1 text-sm">
            {bundle.adjustments.map((adj) => (
              <li key={adj.id} className="flex justify-between">
                <span>
                  {adj.description}{" "}
                  <span className="text-xs text-slate-500">({adj.allocation_mode})</span>
                </span>
                <span>{formatMoney(adj.amount_cents)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

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
