import Link from "next/link";
import { formatMoney } from "@/lib/expenses/display";
import type { MonthlyFinancialSummary } from "@/lib/money/monthly-summary";
import { shiftMonth } from "@/lib/money/list-filters";
import {
  ConfirmedPendingMeter,
  MoneyCategoryBars,
} from "@/components/money/MoneyCategoryBars";

export function MoneyMonthlySummary({
  householdId,
  summary,
}: {
  householdId: string;
  summary: MonthlyFinancialSummary;
}) {
  if (!summary.hasUsefulData) return null;

  const prev = shiftMonth(summary.month, -1);
  const next = shiftMonth(summary.month, 1);
  const delta =
    summary.priorSharedPurchasesConfirmedCents != null
      ? summary.sharedPurchasesConfirmedCents -
        summary.priorSharedPurchasesConfirmedCents
      : null;

  return (
    <section className="space-y-3" data-testid="money-monthly-summary">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">
          This month
        </h2>
        <nav className="flex items-center gap-2 text-sm" aria-label="Month navigation">
          <Link
            href={`/app/${householdId}/money?month=${prev}`}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-border px-2"
          >
            <span className="sr-only">Previous month</span>
            <span aria-hidden>‹</span>
          </Link>
          <span className="min-w-[8rem] text-center font-medium">
            {summary.monthLabel}
          </span>
          <Link
            href={`/app/${householdId}/money?month=${next}`}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-border px-2"
          >
            <span className="sr-only">Next month</span>
            <span aria-hidden>›</span>
          </Link>
        </nav>
      </div>

      <div className="space-y-2 rounded-md border border-border bg-surface px-4 py-3 text-sm">
        <SummaryRow
          label="Shared purchases"
          value={summary.sharedPurchasesConfirmedCents}
          href={summary.deepLinks.sharedPurchases}
        />
        {summary.yourAllocatedShareCents > 0 ? (
          <SummaryRow
            label="Your allocated share"
            value={summary.yourAllocatedShareCents}
          />
        ) : null}
        <SummaryRow
          label="Confirmed reimbursements"
          value={summary.confirmedReimbursementsCents}
        />
        <SummaryRow
          label="Pending confirmation"
          value={summary.pendingPaymentConfirmationCents}
          href={summary.deepLinks.pendingPayments}
        />
        {summary.sharedPurchasesPendingCents > 0 ? (
          <SummaryRow
            label="Pending expenses"
            value={summary.sharedPurchasesPendingCents}
            href={summary.deepLinks.pendingExpenses}
          />
        ) : null}
        {summary.recurringBillsCents > 0 ? (
          <SummaryRow label="Recurring bills" value={summary.recurringBillsCents} />
        ) : null}
        {summary.disputedCents > 0 ? (
          <SummaryRow
            label="Disputed"
            value={summary.disputedCents}
            href={summary.deepLinks.disputed}
          />
        ) : null}
      </div>

      <ConfirmedPendingMeter
        confirmedCents={summary.sharedPurchasesConfirmedCents}
        pendingCents={
          summary.sharedPurchasesPendingCents +
          summary.pendingPaymentConfirmationCents
        }
      />

      {delta != null && summary.priorSharedPurchasesConfirmedCents != null ? (
        <p className="text-xs text-text-muted" data-testid="money-month-delta">
          Shared household spending{" "}
          {delta === 0
            ? "is unchanged from the previous period."
            : delta > 0
              ? `increased by ${formatMoney(delta)} versus the previous period.`
              : `decreased by ${formatMoney(Math.abs(delta))} versus the previous period.`}
        </p>
      ) : null}

      <MoneyCategoryBars
        categories={summary.categories}
        categoryHref={summary.deepLinks.category}
      />
    </section>
  );
}

function SummaryRow({
  label,
  value,
  href,
}: {
  label: string;
  value: number;
  href?: string;
}) {
  const amount = (
    <span className="tabular-nums font-medium">{formatMoney(value)}</span>
  );
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-text-secondary">{label}</span>
      {href ? (
        <Link href={href} className="text-primary underline-offset-2 hover:underline">
          {amount}
        </Link>
      ) : (
        amount
      )}
    </div>
  );
}
