import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import {
  confirmExpenseAction,
  createExpenseAmendmentAction,
  voidExpenseAction,
} from "@/app/actions/expenses";
import { assertActiveMembership } from "@/lib/household-context";
import {
  adjustmentTypeLabel,
  formatMoney,
  itemAllocationLabel,
} from "@/lib/expenses/display";
import { ExpenseStatusBadge } from "@/components/ui/status-badge";
import { DisclosureSection } from "@/components/ui/disclosure-section";
import { loadExpenseBundle, recalculateBundle } from "@/lib/expenses/load-bundle";
import { listActiveMemberOptions } from "@/lib/expenses/queries";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { CommentThread } from "@/components/comments/CommentThread";
import { listRecordComments } from "@/lib/comments/queries";
import { expenseWaitingCopy } from "@/lib/presentation/human-status";
import { formatAuditEventLabel } from "@/lib/presentation/audit-events";
import { settlementStatusCopy } from "@/lib/presentation/human-status";

export const dynamic = "force-dynamic";

export default async function ExpenseDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ householdId: string; expenseId: string }>;
  searchParams: Promise<{ fromReceipt?: string }>;
}) {
  const { householdId, expenseId } = await params;
  const { fromReceipt } = await searchParams;
  const ctx = await assertActiveMembership(householdId);
  const supabase = await createClient();
  const bundle = await loadExpenseBundle(supabase, expenseId);
  if (!bundle || bundle.expense.household_id !== householdId) notFound();

  if (bundle.expense.status === "draft") {
    redirect(`/app/${householdId}/money/expenses/${expenseId}/edit`);
  }

  const [members, obligationsResult, auditsResult, comments] = await Promise.all([
    listActiveMemberOptions(householdId),
    supabase
      .from("reimbursement_obligations")
      .select("*")
      .eq("expense_id", expenseId)
      .order("created_at", { ascending: true }),
    supabase
      .from("audit_events")
      .select("event_type, created_at, reason, after_state")
      .eq("household_id", householdId)
      .eq("entity_id", expenseId)
      .order("created_at", { ascending: false })
      .limit(20),
    listRecordComments({
      householdId,
      parentType: "expense",
      parentId: expenseId,
      actorMembershipId: ctx.membershipId,
    }),
  ]);

  const obligations = obligationsResult.data;
  const audits = auditsResult.data;

  const label = (id: string) =>
    members.find((m) => m.id === id)?.label ?? id.slice(0, 8);

  const calc =
    bundle.expense.status === "confirmed" || bundle.expense.status === "amended"
      ? null
      : recalculateBundle(bundle);

  const e = bundle.expense;
  const shares = calc && calc.ok ? calc.memberShares : [];
  const myShare = shares.find((s) => s.membershipId === ctx.membershipId);
  const myObligation = (obligations ?? []).find(
    (o) => o.debtor_membership_id === ctx.membershipId,
  );
  const othersOwe = (obligations ?? [])
    .filter((o) => o.creditor_membership_id === ctx.membershipId)
    .reduce((sum, o) => sum + (o.current_amount_cents ?? 0), 0);
  const isPayer = ctx.membershipId === e.payer_membership_id;
  const waitingConfirm = e.status === "ready_for_review";
  const previewOwed =
    calc && calc.ok
      ? calc.obligations
          .filter((o) => o.creditorMembershipId === ctx.membershipId)
          .reduce((sum, o) => sum + o.amountCents, 0)
      : 0;
  const payerLabel = label(e.payer_membership_id);
  const statusDetail = expenseWaitingCopy({
    status: e.status,
    isPayer,
    payerLabel,
  });

  return (
    <main className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">{e.merchant || "Expense"}</h1>
        <p className="text-2xl font-semibold tabular-nums">
          {formatMoney(e.declared_total_cents)}
        </p>
        <p className="flex flex-wrap items-center gap-2 text-sm text-text-secondary">
          <span>Paid by {payerLabel}</span>
          <ExpenseStatusBadge status={e.status} />
        </p>
      </header>

      <section
        className="rounded-md border border-border bg-surface p-4"
        data-testid="expense-your-share"
      >
        {isPayer ? (
          <>
            <p className="text-sm text-text-secondary">You paid</p>
            <p className="text-xl font-semibold tabular-nums">
              {formatMoney(e.declared_total_cents)}
            </p>
            <p className="mt-2 text-sm text-text-secondary">Others owe you</p>
            <p className="text-lg font-semibold tabular-nums">
              {formatMoney(othersOwe || previewOwed)}
            </p>
          </>
        ) : (
          <>
            <p className="text-sm text-text-secondary">Your share</p>
            <p className="text-xl font-semibold tabular-nums">
              {formatMoney(
                myShare?.totalShareCents ?? myObligation?.current_amount_cents ?? 0,
              )}
            </p>
            <p className="mt-2 text-sm text-text-secondary">
              You owe {payerLabel}
            </p>
            <p className="text-lg font-semibold tabular-nums">
              {formatMoney(
                myObligation?.current_amount_cents ??
                  myShare?.totalShareCents ??
                  0,
              )}
            </p>
          </>
        )}
        <p className="mt-3 text-sm text-text-secondary">{statusDetail}</p>
        {waitingConfirm && can(ctx.roles, "expense.confirm") ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <ActionForm action={confirmExpenseAction} pendingLabel="Confirming…">
              <input type="hidden" name="householdId" value={householdId} />
              <input type="hidden" name="expenseId" value={expenseId} />
              <input type="hidden" name="idempotencyKey" value={crypto.randomUUID()} />
              <button
                type="submit"
                className="min-h-11 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
              >
                Confirm
              </button>
            </ActionForm>
            <Link
              href={`/app/${householdId}/money/disputes`}
              className="inline-flex min-h-11 items-center rounded-md border border-border px-4 text-sm"
            >
              Dispute
            </Link>
          </div>
        ) : null}
      </section>

      {fromReceipt === "1" ? (
        <section
          className="rounded-md border border-border bg-surface p-4"
          data-testid="receipt-inventory-followup"
        >
          <p className="font-medium">Receipt submitted.</p>
          <p className="mt-1 text-sm text-text-secondary">
            Optional later: update household supplies. This does not change who
            owes what.
          </p>
        </section>
      ) : null}

      <section className="space-y-2" data-testid="obligation-breakdown">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">
          Who owes what
        </h2>
        {(obligations ?? []).length === 0 && !(calc && calc.ok && calc.obligations.length) ? (
          <p className="text-sm text-text-secondary">
            No one owes anyone for this purchase.
          </p>
        ) : (
          <ul className="space-y-3">
            {((obligations ?? []).length > 0
              ? (obligations ?? []).map((o) => ({
                  id: o.id,
                  debtor: o.debtor_membership_id,
                  creditor: o.creditor_membership_id,
                  amount: o.current_amount_cents,
                  status: o.status,
                }))
              : calc && calc.ok
                ? calc.obligations.map((o) => ({
                    id: `${o.debtorMembershipId}-${o.creditorMembershipId}`,
                    debtor: o.debtorMembershipId,
                    creditor: o.creditorMembershipId,
                    amount: o.amountCents,
                    status: "unpaid",
                  }))
                : []
            ).map((o) => (
              <li
                key={o.id}
                className="rounded-md border border-border bg-surface p-3 text-sm"
              >
                <p className="font-medium">
                  {label(o.debtor)} owes {label(o.creditor)} {formatMoney(o.amount)}
                </p>
                <p className="mt-1 text-xs text-text-muted">
                  {settlementStatusCopy(o.status).label}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">
          Items
        </h2>
        <ul className="space-y-3">
          {bundle.items.map((item) => (
            <li key={item.id} className="rounded-md border border-border bg-surface p-4 text-sm">
              <div className="flex justify-between font-medium">
                <span>{item.description}</span>
                <span>{formatMoney(item.total_cents)}</span>
              </div>
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
                  <li className="text-text-muted">Not part of the split</li>
                ) : null}
              </ul>
            </li>
          ))}
        </ul>
      </section>

      {bundle.adjustments.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">
            Tax, tip, and fees
          </h2>
          <ul className="space-y-2">
            {bundle.adjustments.map((adj) => (
              <li key={adj.id} className="rounded-md border border-border bg-surface p-4 text-sm">
                <div className="flex justify-between font-medium">
                  <span>
                    {adj.description}{" "}
                    <span className="text-xs font-normal text-text-muted">
                      ({adjustmentTypeLabel(adj.adjustment_type)})
                    </span>
                  </span>
                  <span>{formatMoney(adj.amount_cents)}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">
          Activity
        </h2>
        <CommentThread
          householdId={householdId}
          parentType="expense"
          parentId={expenseId}
          comments={comments}
        />
      </section>

      <DisclosureSection
        title="Advanced"
        description="History, corrections, and extra details"
        testId="expense-advanced"
      >
        <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
          <dt className="text-text-muted">Paid by</dt>
          <dd>{payerLabel}</dd>
          <dt className="text-text-muted">Added by</dt>
          <dd>{label(e.created_by_membership_id)}</dd>
          <dt className="text-text-muted">Confirmed</dt>
          <dd>{e.confirmed_at ? new Date(e.confirmed_at).toLocaleString() : "—"}</dd>
          {e.void_reason ? (
            <>
              <dt className="text-text-muted">Cancelled because</dt>
              <dd>{e.void_reason}</dd>
            </>
          ) : null}
          {e.supersedes_expense_id ? (
            <>
              <dt className="text-text-muted">Replaces</dt>
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
              <dt className="text-text-muted">Replaced by</dt>
              <dd>
                <Link
                  className="underline"
                  href={`/app/${householdId}/money/expenses/${e.superseded_by_expense_id}`}
                >
                  Updated expense
                </Link>
              </dd>
            </>
          ) : null}
        </dl>

        <div>
          <h3 className="text-sm font-semibold">History</h3>
          <ul className="mt-2 space-y-1 text-xs text-text-secondary">
            {(audits ?? []).map((a, i) => (
              <li key={`${a.created_at}-${i}`}>
                {new Date(a.created_at).toLocaleString()} —{" "}
                {formatAuditEventLabel(a.event_type)}
                {a.reason ? `: ${a.reason}` : ""}
              </li>
            ))}
            {(audits ?? []).length === 0 ? <li>No history yet.</li> : null}
          </ul>
        </div>

        {bundle.items.some((item) => item.allocation_mode) ? (
          <p className="text-xs text-text-muted">
            Split details:{" "}
            {[...new Set(bundle.items.map((item) => itemAllocationLabel(item.allocation_mode)))].join(
              "; ",
            )}
          </p>
        ) : null}

        {e.status === "confirmed" ? (
          <div className="space-y-4">
            {can(ctx.roles, "expense.amend") ? (
              <ActionForm
                action={createExpenseAmendmentAction}
                className="space-y-2"
                pendingLabel="Creating correction…"
              >
                <input type="hidden" name="householdId" value={householdId} />
                <input type="hidden" name="expenseId" value={expenseId} />
                <label className="block text-sm">
                  Correct this expense — reason
                  <textarea
                    name="reason"
                    required
                    rows={2}
                    className="mt-1 w-full rounded-md border border-border px-3 py-2"
                    placeholder="What needs to change?"
                  />
                </label>
                <button
                  type="submit"
                  className="rounded-md border border-border bg-surface px-4 py-2 text-sm"
                  data-testid="amend-expense"
                >
                  Start a correction
                </button>
              </ActionForm>
            ) : null}

            {can(ctx.roles, "expense.void") ? (
              <ActionForm
                action={voidExpenseAction}
                className="space-y-2"
                pendingLabel="Cancelling…"
              >
                <input type="hidden" name="householdId" value={householdId} />
                <input type="hidden" name="expenseId" value={expenseId} />
                <label className="block text-sm">
                  Cancel this expense — reason
                  <textarea
                    name="reason"
                    required
                    rows={2}
                    className="mt-1 w-full rounded-md border border-border px-3 py-2"
                    placeholder="Why should this no longer count?"
                  />
                </label>
                <button
                  type="submit"
                  className="rounded-md border border-destructive/40 px-4 py-2 text-sm text-destructive"
                  data-testid="void-expense"
                >
                  Cancel expense
                </button>
              </ActionForm>
            ) : null}
          </div>
        ) : null}
      </DisclosureSection>
    </main>
  );
}
