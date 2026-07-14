import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import {
  createExpenseAmendmentAction,
  voidExpenseAction,
} from "@/app/actions/expenses";
import { assertActiveMembership } from "@/lib/household-context";
import { formatMoney, statusLabel } from "@/lib/expenses/display";
import { loadExpenseBundle, recalculateBundle } from "@/lib/expenses/load-bundle";
import { listActiveMemberOptions } from "@/lib/expenses/queries";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ExpenseDetailPage({
  params,
}: {
  params: Promise<{ householdId: string; expenseId: string }>;
}) {
  const { householdId, expenseId } = await params;
  const ctx = await assertActiveMembership(householdId);
  const supabase = await createClient();
  const bundle = await loadExpenseBundle(supabase, expenseId);
  if (!bundle || bundle.expense.household_id !== householdId) notFound();

  if (bundle.expense.status === "draft" || bundle.expense.status === "ready_for_review") {
    redirect(`/app/${householdId}/money/expenses/${expenseId}/edit`);
  }

  const members = await listActiveMemberOptions(householdId);
  const label = (id: string) =>
    members.find((m) => m.id === id)?.label ?? id.slice(0, 8);

  const { data: obligations } = await supabase
    .from("reimbursement_obligations")
    .select("*")
    .eq("expense_id", expenseId)
    .order("created_at", { ascending: true });

  const { data: audits } = await supabase
    .from("audit_events")
    .select("event_type, created_at, reason, after_state")
    .eq("household_id", householdId)
    .eq("entity_id", expenseId)
    .order("created_at", { ascending: false })
    .limit(20);

  // Rebuild explanation from stored allocation amounts when confirmed
  const calc =
    bundle.expense.status === "confirmed" || bundle.expense.status === "amended"
      ? null
      : recalculateBundle(bundle);

  const e = bundle.expense;

  return (
    <main className="space-y-6">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">{e.merchant || "Expense"}</h1>
          <p className="text-sm text-slate-600">
            {statusLabel(e.status)} · {e.purchase_date} · {formatMoney(e.declared_total_cents)}
          </p>
        </div>
        <Link href={`/app/${householdId}/money/expenses`} className="text-sm underline">
          All expenses
        </Link>
      </div>

      <dl className="grid grid-cols-2 gap-2 rounded-md border border-line bg-surface p-3 text-sm">
        <dt className="text-slate-500">Payer</dt>
        <dd>{label(e.payer_membership_id)}</dd>
        <dt className="text-slate-500">Creator</dt>
        <dd>{label(e.created_by_membership_id)}</dd>
        <dt className="text-slate-500">Confirmed</dt>
        <dd>{e.confirmed_at ? new Date(e.confirmed_at).toLocaleString() : "—"}</dd>
        {e.void_reason ? (
          <>
            <dt className="text-slate-500">Void reason</dt>
            <dd>{e.void_reason}</dd>
          </>
        ) : null}
        {e.supersedes_expense_id ? (
          <>
            <dt className="text-slate-500">Supersedes</dt>
            <dd>
              <Link
                className="underline"
                href={`/app/${householdId}/money/expenses/${e.supersedes_expense_id}`}
              >
                Original expense
              </Link>
            </dd>
          </>
        ) : null}
        {e.superseded_by_expense_id ? (
          <>
            <dt className="text-slate-500">Superseded by</dt>
            <dd>
              <Link
                className="underline"
                href={`/app/${householdId}/money/expenses/${e.superseded_by_expense_id}`}
              >
                Amended expense
              </Link>
            </dd>
          </>
        ) : null}
      </dl>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Items
        </h2>
        <ul className="space-y-3">
          {bundle.items.map((item) => (
            <li key={item.id} className="rounded-md border border-line bg-surface p-3 text-sm">
              <div className="flex justify-between font-medium">
                <span>{item.description}</span>
                <span>{formatMoney(item.total_cents)}</span>
              </div>
              <p className="text-xs text-slate-500">{item.allocation_mode}</p>
              <ul className="mt-2 space-y-0.5 text-xs">
                {item.allocations
                  .filter((a) => a.amount_cents !== 0)
                  .map((a) => (
                    <li key={a.membership_id} className="flex justify-between">
                      <span>{label(a.membership_id)}</span>
                      <span>{formatMoney(a.amount_cents)}</span>
                    </li>
                  ))}
                {item.allocation_mode === "excluded" ? (
                  <li className="text-slate-500">Excluded — no reimbursement allocation</li>
                ) : null}
              </ul>
            </li>
          ))}
        </ul>
      </section>

      {bundle.adjustments.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Adjustments
          </h2>
          <ul className="space-y-2">
            {bundle.adjustments.map((adj) => (
              <li key={adj.id} className="rounded-md border border-line bg-surface p-3 text-sm">
                <div className="flex justify-between font-medium">
                  <span>
                    {adj.description}{" "}
                    <span className="text-xs font-normal text-slate-500">
                      ({adj.adjustment_type})
                    </span>
                  </span>
                  <span>{formatMoney(adj.amount_cents)}</span>
                </div>
                <ul className="mt-2 space-y-0.5 text-xs">
                  {adj.allocations
                    .filter((a) => a.amount_cents !== 0)
                    .map((a) => (
                      <li key={a.membership_id} className="flex justify-between">
                        <span>{label(a.membership_id)}</span>
                        <span>{formatMoney(a.amount_cents)}</span>
                      </li>
                    ))}
                </ul>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="space-y-2" data-testid="obligation-breakdown">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Reimbursement obligations
        </h2>
        {(obligations ?? []).length === 0 ? (
          <p className="text-sm text-slate-600">No obligations for this expense.</p>
        ) : (
          <ul className="space-y-3">
            {(obligations ?? []).map((o) => {
              // Build explanation from stored per-member allocation lines
              const lines: Array<{ description: string; amount: number }> = [];
              for (const item of bundle.items) {
                const alloc = item.allocations.find(
                  (a) => a.membership_id === o.debtor_membership_id,
                );
                if (alloc && alloc.amount_cents !== 0) {
                  lines.push({ description: item.description, amount: alloc.amount_cents });
                }
              }
              for (const adj of bundle.adjustments) {
                const alloc = adj.allocations.find(
                  (a) => a.membership_id === o.debtor_membership_id,
                );
                if (alloc && alloc.amount_cents !== 0) {
                  lines.push({ description: adj.description, amount: alloc.amount_cents });
                }
              }
              // If obligation flipped (payer is debtor), use creditor lines
              if (o.debtor_membership_id === e.payer_membership_id) {
                lines.length = 0;
                for (const item of bundle.items) {
                  const alloc = item.allocations.find(
                    (a) => a.membership_id === o.creditor_membership_id,
                  );
                  if (alloc && alloc.amount_cents !== 0) {
                    lines.push({
                      description: item.description,
                      amount: -alloc.amount_cents,
                    });
                  }
                }
                for (const adj of bundle.adjustments) {
                  const alloc = adj.allocations.find(
                    (a) => a.membership_id === o.creditor_membership_id,
                  );
                  if (alloc && alloc.amount_cents !== 0) {
                    lines.push({
                      description: adj.description,
                      amount: -alloc.amount_cents,
                    });
                  }
                }
              }

              return (
                <li
                  key={o.id}
                  className="rounded-md border border-line bg-surface p-3 text-sm"
                >
                  <p className="font-medium">
                    {label(o.debtor_membership_id)} owes {label(o.creditor_membership_id)}{" "}
                    {formatMoney(o.current_amount_cents)}
                    <span className="ml-2 text-xs font-normal text-slate-500">
                      {o.status}
                    </span>
                  </p>
                  <ul className="mt-2 space-y-0.5 text-xs">
                    {lines.map((line, idx) => (
                      <li key={idx} className="flex justify-between">
                        <span>{line.description}</span>
                        <span>{formatMoney(line.amount)}</span>
                      </li>
                    ))}
                    <li className="flex justify-between border-t border-line pt-1 font-medium">
                      <span>Total</span>
                      <span>{formatMoney(o.current_amount_cents)}</span>
                    </li>
                  </ul>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Audit history
        </h2>
        <ul className="space-y-1 text-xs text-slate-600">
          {(audits ?? []).map((a, i) => (
            <li key={`${a.created_at}-${i}`}>
              {new Date(a.created_at).toLocaleString()} — {a.event_type}
              {a.reason ? `: ${a.reason}` : ""}
            </li>
          ))}
          {(audits ?? []).length === 0 ? <li>No audit events yet.</li> : null}
        </ul>
      </section>

      {e.status === "confirmed" ? (
        <section className="space-y-4 border-t border-line pt-4">
          {can(ctx.roles, "expense.amend") ? (
            <ActionForm action={createExpenseAmendmentAction} className="space-y-2">
              <input type="hidden" name="householdId" value={householdId} />
              <input type="hidden" name="expenseId" value={expenseId} />
              <label className="block text-sm">
                Correct expense — reason
                <textarea
                  name="reason"
                  required
                  rows={2}
                  className="mt-1 w-full rounded-md border border-line px-3 py-2"
                  placeholder="Why is this being corrected?"
                />
              </label>
              <button
                type="submit"
                className="rounded-md border border-line bg-surface px-4 py-2 text-sm"
                data-testid="amend-expense"
              >
                Create amendment draft
              </button>
            </ActionForm>
          ) : null}

          {can(ctx.roles, "expense.void") ? (
            <ActionForm action={voidExpenseAction} className="space-y-2">
              <input type="hidden" name="householdId" value={householdId} />
              <input type="hidden" name="expenseId" value={expenseId} />
              <label className="block text-sm">
                Void expense — reason
                <textarea
                  name="reason"
                  required
                  rows={2}
                  className="mt-1 w-full rounded-md border border-line px-3 py-2"
                  placeholder="Why should this record be voided?"
                />
              </label>
              <button
                type="submit"
                className="rounded-md border border-red-300 px-4 py-2 text-sm text-red-800"
                data-testid="void-expense"
              >
                Void expense
              </button>
            </ActionForm>
          ) : null}
        </section>
      ) : null}

      {calc && !calc.ok ? (
        <p className="text-xs text-slate-500">Historical note: preview calc unavailable.</p>
      ) : null}
    </main>
  );
}
