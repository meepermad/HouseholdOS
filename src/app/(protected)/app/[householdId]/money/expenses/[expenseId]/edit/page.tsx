import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { ExpenseAdjustmentEditor } from "@/components/expenses/expense-adjustment-editor";
import { ExpenseItemEditor } from "@/components/expenses/expense-item-editor";
import { ReconciliationSummary } from "@/components/expenses/reconciliation-summary";
import {
  deleteExpenseAdjustmentAction,
  deleteExpenseDraftAction,
  deleteExpenseItemAction,
  submitExpenseForReviewAction,
  updateExpenseHeaderAction,
} from "@/app/actions/expenses";
import { assertActiveMembership } from "@/lib/household-context";
import { formatMoney } from "@/lib/expenses/display";
import { loadExpenseBundle, recalculateBundle } from "@/lib/expenses/load-bundle";
import { listActiveMemberOptions } from "@/lib/expenses/queries";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function EditExpensePage({
  params,
}: {
  params: Promise<{ householdId: string; expenseId: string }>;
}) {
  const { householdId, expenseId } = await params;
  await assertActiveMembership(householdId);
  const supabase = await createClient();
  const bundle = await loadExpenseBundle(supabase, expenseId);
  if (!bundle || bundle.expense.household_id !== householdId) notFound();

  if (
    bundle.expense.status === "confirmed" ||
    bundle.expense.status === "amended" ||
    bundle.expense.status === "voided"
  ) {
    redirect(`/app/${householdId}/money/expenses/${expenseId}`);
  }

  const members = await listActiveMemberOptions(householdId);
  const calc = recalculateBundle(bundle);
  const e = bundle.expense;

  return (
    <main className="space-y-6">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Edit draft</h1>
          <p className="text-sm text-slate-600">
            Status: {e.status}
            {e.supersedes_expense_id ? " (amendment)" : ""}
          </p>
        </div>
        <Link
          href={`/app/${householdId}/money/expenses`}
          className="text-sm text-slate-600 underline"
        >
          Back
        </Link>
      </div>

      <ActionForm
        action={updateExpenseHeaderAction}
        className="space-y-3 rounded-md border border-line bg-surface p-3"
      >
        <input type="hidden" name="householdId" value={householdId} />
        <input type="hidden" name="expenseId" value={expenseId} />
        <label className="block text-sm">
          Merchant
          <input
            name="merchant"
            required
            defaultValue={e.merchant}
            className="mt-1 w-full rounded-md border border-line px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          Payer
          <select
            name="payerMembershipId"
            defaultValue={e.payer_membership_id}
            className="mt-1 w-full rounded-md border border-line px-3 py-2"
          >
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          Description
          <textarea
            name="description"
            rows={2}
            defaultValue={e.description}
            className="mt-1 w-full rounded-md border border-line px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          Category
          <select
            name="category"
            defaultValue={e.category ?? ""}
            className="mt-1 w-full rounded-md border border-line px-3 py-2"
          >
            <option value="">Uncategorized</option>
            {[
              "groceries",
              "household",
              "utilities",
              "dining",
              "transport",
              "health",
              "other",
            ].map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          Purchase date
          <input
            type="date"
            name="purchaseDate"
            required
            defaultValue={e.purchase_date}
            className="mt-1 w-full rounded-md border border-line px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          Receipt total (cents)
          <input
            type="number"
            name="declaredTotalCents"
            required
            min={0}
            defaultValue={e.declared_total_cents}
            className="mt-1 w-full rounded-md border border-line px-3 py-2"
          />
        </label>
        <button type="submit" className="rounded-md bg-accent px-3 py-2 text-sm text-white">
          Save header
        </button>
      </ActionForm>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Line items</h2>
        {bundle.items.map((item) => (
          <div key={item.id} className="space-y-2">
            <ExpenseItemEditor
              householdId={householdId}
              expenseId={expenseId}
              members={members}
              initial={{
                id: item.id,
                description: item.description,
                quantityLabel: item.quantity_label ?? "",
                totalCents: item.total_cents,
                allocationMode: item.allocation_mode,
                personalMembershipId: item.personal_membership_id ?? "",
                selectedIds: item.allocations.map((a) => a.membership_id),
                fixedMap: Object.fromEntries(
                  item.allocations
                    .filter((a) => a.fixed_cents != null)
                    .map((a) => [a.membership_id, a.fixed_cents!]),
                ),
                percentMap: Object.fromEntries(
                  item.allocations
                    .filter((a) => a.percent_bps != null)
                    .map((a) => [a.membership_id, a.percent_bps! / 100]),
                ),
                weightMap: Object.fromEntries(
                  item.allocations
                    .filter((a) => a.weight != null)
                    .map((a) => [a.membership_id, a.weight!]),
                ),
                excludeFromBasis: item.exclude_from_adjustment_basis,
                displayOrder: item.display_order,
              }}
            />
            <ActionForm action={deleteExpenseItemAction}>
              <input type="hidden" name="householdId" value={householdId} />
              <input type="hidden" name="expenseId" value={expenseId} />
              <input type="hidden" name="itemId" value={item.id} />
              <button type="submit" className="text-xs text-red-700 underline">
                Remove item ({formatMoney(item.total_cents)})
              </button>
            </ActionForm>
          </div>
        ))}
        <ExpenseItemEditor
          householdId={householdId}
          expenseId={expenseId}
          members={members}
          initial={{ displayOrder: bundle.items.length }}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Adjustments</h2>
        <p className="text-xs text-slate-600">
          Tax/tips allocate proportionally to each member&apos;s pre-adjustment item share.
          Excluded lines count toward the payer unless opted out.
        </p>
        {bundle.adjustments.map((adj) => (
          <div key={adj.id} className="space-y-2">
            <ExpenseAdjustmentEditor
              householdId={householdId}
              expenseId={expenseId}
              members={members}
              initial={{
                id: adj.id,
                adjustmentType: adj.adjustment_type,
                description: adj.description,
                amountCents: adj.amount_cents,
                allocationMode: adj.allocation_mode,
                assignedMembershipId: adj.assigned_membership_id ?? undefined,
                selectedIds: adj.allocations.map((a) => a.membership_id),
                displayOrder: adj.display_order,
              }}
            />
            <ActionForm action={deleteExpenseAdjustmentAction}>
              <input type="hidden" name="householdId" value={householdId} />
              <input type="hidden" name="expenseId" value={expenseId} />
              <input type="hidden" name="adjustmentId" value={adj.id} />
              <button type="submit" className="text-xs text-red-700 underline">
                Remove adjustment
              </button>
            </ActionForm>
          </div>
        ))}
        <ExpenseAdjustmentEditor
          householdId={householdId}
          expenseId={expenseId}
          members={members}
          initial={{ displayOrder: bundle.adjustments.length }}
        />
      </section>

      <ReconciliationSummary
        calc={calc}
        members={members}
        declaredTotalCents={e.declared_total_cents}
      />

      <div className="flex flex-wrap gap-2">
        <ActionForm action={submitExpenseForReviewAction} pendingLabel="Submitting for review…">
          <input type="hidden" name="householdId" value={householdId} />
          <input type="hidden" name="expenseId" value={expenseId} />
          <button
            type="submit"
            disabled={!calc.ok}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            Continue to review
          </button>
        </ActionForm>
        <ActionForm action={deleteExpenseDraftAction}>
          <input type="hidden" name="householdId" value={householdId} />
          <input type="hidden" name="expenseId" value={expenseId} />
          <button type="submit" className="rounded-md border border-line px-4 py-2 text-sm">
            Delete draft
          </button>
        </ActionForm>
      </div>
    </main>
  );
}
