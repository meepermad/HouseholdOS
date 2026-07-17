import Link from "next/link";
import { Suspense } from "react";
import { assertActiveMembership } from "@/lib/household-context";
import { formatMoney } from "@/lib/expenses/display";
import { getBalancesForMembership } from "@/lib/expenses/queries";
import { createClient } from "@/lib/supabase/server";
import { can } from "@/lib/permissions";
import { ExpenseStatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { AppBackButton } from "@/components/app-back-button";
import { MoneyActionCenter } from "@/components/payments/action-center";

export const dynamic = "force-dynamic";

async function BalanceCards({
  householdId,
  membershipId,
}: {
  householdId: string;
  membershipId: string;
}) {
  const balances = await getBalancesForMembership(householdId, membershipId);
  return (
    <section
      className="grid grid-cols-3 gap-2 rounded-md border border-border bg-surface px-3 py-3 text-center"
      data-testid="money-balance-summary"
    >
      <div>
        <p className="text-[0.65rem] uppercase tracking-wide text-text-muted">You owe</p>
        <p
          className="mt-1 text-sm font-semibold tabular-nums"
          aria-label={`You owe ${formatMoney(balances.youOwe)}`}
        >
          {formatMoney(balances.youOwe)}
        </p>
      </div>
      <div>
        <p className="text-[0.65rem] uppercase tracking-wide text-text-muted">You are owed</p>
        <p
          className="mt-1 text-sm font-semibold tabular-nums"
          aria-label={`You are owed ${formatMoney(balances.youAreOwed)}`}
        >
          {formatMoney(balances.youAreOwed)}
        </p>
      </div>
      <div>
        <p className="text-[0.65rem] uppercase tracking-wide text-text-muted">Net</p>
        <p
          className="mt-1 text-sm font-semibold tabular-nums"
          aria-label={`Net ${formatMoney(balances.net)}`}
        >
          {formatMoney(balances.net)}
        </p>
      </div>
    </section>
  );
}

async function RecentExpenses({ householdId }: { householdId: string }) {
  const supabase = await createClient();
  const { data: recent } = await supabase
    .from("expenses")
    .select("id, merchant, purchase_date, declared_total_cents, status")
    .eq("household_id", householdId)
    .order("purchase_date", { ascending: false })
    .limit(8);

  if ((recent ?? []).length === 0) {
    return (
      <EmptyState
        testId="empty-expense-list"
        title="No expenses yet"
        description="Shared purchases and reimbursements will show up here once someone creates a draft expense."
        action={
          <Link
            href={`/app/${householdId}/money/expenses/new`}
            className="inline-flex min-h-11 items-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            Create first expense
          </Link>
        }
      />
    );
  }

  return (
    <ul className="divide-y divide-border rounded-md border border-border bg-surface">
      {(recent ?? []).map((e) => (
        <li key={e.id}>
          <Link
            href={`/app/${householdId}/money/expenses/${e.id}`}
            className="flex flex-col gap-2 px-4 py-3.5 text-sm hover:bg-surface-interactive sm:flex-row sm:items-center sm:justify-between"
          >
            <span className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{e.merchant || "Expense"}</span>
              <ExpenseStatusBadge status={e.status} />
            </span>
            <span className="tabular-nums text-text-secondary">
              {formatMoney(e.declared_total_cents)}
              <span className="ml-2 text-xs text-text-muted">{e.purchase_date}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default async function MoneyHubPage({
  params,
}: {
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = await params;
  const ctx = await assertActiveMembership(householdId);

  return (
    <main className="space-y-6">
      <AppBackButton fallbackHref={`/app/${householdId}`} />
      <header className="space-y-2">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight">
          Money
        </h1>
        <p className="text-sm text-text-secondary">
          Track shared purchases, reimbursements, and external payment records. HouseholdOS
          does not move money or verify payment providers.
        </p>
      </header>

      <Suspense
        fallback={
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        }
      >
        <BalanceCards householdId={householdId} membershipId={ctx.membershipId} />
      </Suspense>

      <Suspense fallback={<Skeleton className="h-24 w-full" />}>
        <MoneyActionCenter
          householdId={householdId}
          membershipId={ctx.membershipId}
          userId={ctx.userId}
        />
      </Suspense>

      <div className="flex flex-wrap gap-2">
        {can(ctx.roles, "expense.create") ? (
          <Link
            href={`/app/${householdId}/money/expenses/new`}
            className="inline-flex min-h-11 items-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            New expense
          </Link>
        ) : null}
        {can(ctx.roles, "payment.create") ? (
          <Link
            href={`/app/${householdId}/money/payments/new`}
            className="inline-flex min-h-11 items-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            Record payment
          </Link>
        ) : null}
        <Link
          href={`/app/${householdId}/money/expenses`}
          className="inline-flex min-h-11 items-center rounded-md border border-border bg-secondary px-4 py-2 text-sm text-secondary-foreground"
        >
          All expenses
        </Link>
        <Link
          href={`/app/${householdId}/money/balances`}
          className="inline-flex min-h-11 items-center rounded-md border border-border bg-secondary px-4 py-2 text-sm text-secondary-foreground"
        >
          Balances
        </Link>
        <Link
          href={`/app/${householdId}/money/reimbursements`}
          className="inline-flex min-h-11 items-center rounded-md border border-border bg-secondary px-4 py-2 text-sm text-secondary-foreground"
        >
          Reimbursements
        </Link>
        <Link
          href={`/app/${householdId}/money/payments`}
          className="inline-flex min-h-11 items-center rounded-md border border-border bg-secondary px-4 py-2 text-sm text-secondary-foreground"
        >
          Payments
        </Link>
        <Link
          href={`/app/${householdId}/money/ledger`}
          className="inline-flex min-h-11 items-center rounded-md border border-border bg-secondary px-4 py-2 text-sm text-secondary-foreground"
        >
          Ledger
        </Link>
        <Link
          href={`/app/${householdId}/money/disputes`}
          className="inline-flex min-h-11 items-center rounded-md border border-border bg-secondary px-4 py-2 text-sm text-secondary-foreground"
        >
          Disputes
        </Link>
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">
          Recent
        </h2>
        <Suspense fallback={<Skeleton className="h-40 w-full" />}>
          <RecentExpenses householdId={householdId} />
        </Suspense>
      </section>
    </main>
  );
}
