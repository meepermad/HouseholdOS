import Link from "next/link";
import { notFound } from "next/navigation";
import { assertActiveMembership } from "@/lib/household-context";
import { formatMoney } from "@/lib/expenses/display";
import { listActiveMemberOptions } from "@/lib/expenses/queries";
import { getObligationBalance } from "@/lib/payments/queries";
import { SettlementStatusBadge } from "@/components/ui/status-badge";
import { AppBackButton } from "@/components/app-back-button";
import { ActionForm } from "@/components/action-form";
import { createWaiverAction, openDisputeAction } from "@/app/actions/payments";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ObligationDetailPage({
  params,
}: {
  params: Promise<{ householdId: string; obligationId: string }>;
}) {
  const { householdId, obligationId } = await params;
  const ctx = await assertActiveMembership(householdId);
  const [balance, members] = await Promise.all([
    getObligationBalance(householdId, obligationId),
    listActiveMemberOptions(householdId),
  ]);
  if (!balance) notFound();

  const label = (id: string) =>
    members.find((m) => m.id === id)?.label ?? id.slice(0, 8);
  const supabase = await createClient();

  const [{ data: allocations }, { data: waivers }, { data: audits }] =
    await Promise.all([
      supabase
        .from("payment_allocations")
        .select(
          "id, amount_cents, payment_id, created_at, payments(status, external_method, submitted_at, confirmed_at)",
        )
        .eq("obligation_id", obligationId)
        .eq("household_id", householdId)
        .order("created_at", { ascending: true }),
      supabase
        .from("reimbursement_waivers")
        .select("id, amount_cents, reason, status, created_at, created_by_membership_id")
        .eq("obligation_id", obligationId)
        .eq("household_id", householdId)
        .order("created_at", { ascending: true }),
      supabase
        .from("audit_events")
        .select("id, event_type, created_at, reason, after_state")
        .eq("household_id", householdId)
        .eq("entity_id", obligationId)
        .order("created_at", { ascending: false })
        .limit(30),
    ]);

  const isCreditor = ctx.membershipId === balance.creditor_membership_id;

  return (
    <main className="space-y-6">
      <AppBackButton fallbackHref={`/app/${householdId}/money/reimbursements`} />
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
            Obligation
          </h1>
          <SettlementStatusBadge status={balance.settlement_state} />
        </div>
        <p className="text-sm text-text-secondary">
          {label(balance.debtor_membership_id)} owes{" "}
          {label(balance.creditor_membership_id)}
          {balance.obligation_kind === "refund" ? " (refund)" : ""}
        </p>
        <Link
          href={`/app/${householdId}/money/expenses/${balance.expense_id}`}
          className="text-sm underline"
        >
          Source expense
        </Link>
      </header>

      <section
        className="grid grid-cols-1 gap-3 sm:grid-cols-2"
        data-testid="obligation-breakdown"
      >
        <Metric label="Original" value={formatMoney(balance.original_amount_cents)} />
        <Metric label="Effective" value={formatMoney(balance.effective_amount_cents)} />
        <Metric label="Confirmed paid" value={formatMoney(balance.confirmed_paid_cents)} />
        <Metric label="Pending payment" value={formatMoney(balance.pending_payment_cents)} />
        <Metric label="Waived" value={formatMoney(balance.waived_cents)} />
        <Metric
          label="Official outstanding"
          value={formatMoney(balance.official_outstanding_cents)}
        />
        <Metric
          label="Projected outstanding"
          value={formatMoney(balance.projected_outstanding_cents)}
        />
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">
          Payments
        </h2>
        <ul className="divide-y divide-border rounded-md border border-border bg-surface text-sm">
          {(allocations ?? []).map((a) => {
            const p = a.payments as {
              status: string;
              external_method: string;
            } | null;
            return (
              <li key={a.id} className="flex justify-between gap-2 px-4 py-3">
                <Link
                  href={`/app/${householdId}/money/payments/${a.payment_id}`}
                  className="underline"
                >
                  {p?.status ?? "payment"} · {p?.external_method?.replaceAll("_", " ")}
                </Link>
                <span className="tabular-nums">{formatMoney(a.amount_cents)}</span>
              </li>
            );
          })}
          {(allocations ?? []).length === 0 ? (
            <li className="px-4 py-3 text-text-secondary">No payments yet.</li>
          ) : null}
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">
          Waivers
        </h2>
        <ul className="divide-y divide-border rounded-md border border-border bg-surface text-sm">
          {(waivers ?? []).map((w) => (
            <li key={w.id} className="px-4 py-3">
              {formatMoney(w.amount_cents)} · {w.status} · {w.reason}
            </li>
          ))}
          {(waivers ?? []).length === 0 ? (
            <li className="px-4 py-3 text-text-secondary">No waivers.</li>
          ) : null}
        </ul>
      </section>

      {isCreditor && balance.official_outstanding_cents > 0 ? (
        <ActionForm action={createWaiverAction} pendingLabel="Creating waiver…">
          <input type="hidden" name="householdId" value={householdId} />
          <input type="hidden" name="obligationId" value={obligationId} />
          <h2 className="text-sm font-semibold">Create waiver</h2>
          <label className="mt-2 block text-sm" htmlFor="waiver-amount">
            Amount (cents)
          </label>
          <input
            id="waiver-amount"
            name="amountCents"
            type="number"
            min={1}
            max={balance.official_outstanding_cents}
            required
            className="mt-1 min-h-11 w-full rounded-md border border-border bg-surface px-3"
            data-testid="waiver-amount"
          />
          <label className="mt-2 block text-sm" htmlFor="waiver-reason">
            Reason
          </label>
          <textarea
            id="waiver-reason"
            name="reason"
            required
            className="mt-1 min-h-20 w-full rounded-md border border-border bg-surface px-3 py-2"
          />
          <button
            type="submit"
            className="mt-2 inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
          >
            Waive amount
          </button>
        </ActionForm>
      ) : null}

      <ActionForm action={openDisputeAction} pendingLabel="Opening dispute…">
        <input type="hidden" name="householdId" value={householdId} />
        <input type="hidden" name="obligationId" value={obligationId} />
        <input type="hidden" name="disputeType" value="obligation_amount" />
        <label className="block text-sm font-medium" htmlFor="obl-dispute">
          Open dispute
        </label>
        <textarea
          id="obl-dispute"
          name="reason"
          required
          className="mt-1 min-h-20 w-full rounded-md border border-border bg-surface px-3 py-2"
        />
        <button
          type="submit"
          className="mt-2 inline-flex min-h-11 items-center rounded-md border border-border px-4 text-sm font-semibold"
        >
          Open dispute
        </button>
      </ActionForm>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">
          Timeline
        </h2>
        <ul className="space-y-2 text-sm">
          {(audits ?? []).map((a) => (
            <li key={a.id} className="rounded-md border border-border bg-surface px-3 py-2">
              <p className="font-medium">{a.event_type}</p>
              <p className="text-xs text-text-muted">
                {new Date(a.created_at).toLocaleString()}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-surface p-3">
      <p className="text-xs text-text-muted">{label}</p>
      <p className="mt-1 font-semibold tabular-nums">{value}</p>
    </div>
  );
}
