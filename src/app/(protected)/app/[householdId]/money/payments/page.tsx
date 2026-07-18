import Link from "next/link";
import { assertActiveMembership } from "@/lib/household-context";
import { formatMoney } from "@/lib/expenses/display";
import { listActiveMemberOptions } from "@/lib/expenses/queries";
import { createClient } from "@/lib/supabase/server";
import { PaymentStatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { AppBackButton } from "@/components/app-back-button";
import {
  monthBounds,
  parsePaymentListFilters,
  paymentFiltersHaveValues,
  paymentsListHref,
} from "@/lib/money/list-filters";

export const dynamic = "force-dynamic";

export default async function PaymentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ householdId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { householdId } = await params;
  const filters = parsePaymentListFilters(await searchParams);
  await assertActiveMembership(householdId);
  const supabase = await createClient();
  const members = await listActiveMemberOptions(householdId);
  const label = (id: string) =>
    members.find((m) => m.id === id)?.label ?? id.slice(0, 8);

  let query = supabase
    .from("payments")
    .select(
      "id, total_amount_cents, status, sender_membership_id, recipient_membership_id, submitted_at, confirmed_at, created_at",
    )
    .eq("household_id", householdId)
    .order("created_at", { ascending: false });

  if (filters.pendingConfirmation === "yes") {
    query = query.eq("status", "submitted");
  } else if (filters.pendingConfirmation === "no") {
    query = query.neq("status", "submitted");
  } else if (filters.status) {
    query = query.eq("status", filters.status);
  }

  if (filters.member) {
    query = query.or(
      `sender_membership_id.eq.${filters.member},recipient_membership_id.eq.${filters.member}`,
    );
  }

  if (filters.minCents != null) {
    query = query.gte("total_amount_cents", filters.minCents);
  }
  if (filters.maxCents != null) {
    query = query.lte("total_amount_cents", filters.maxCents);
  }

  if (filters.month) {
    const bounds = monthBounds(filters.month);
    if (bounds) {
      query = query
        .gte("created_at", `${bounds.from}T00:00:00.000Z`)
        .lt("created_at", `${bounds.toExclusive}T00:00:00.000Z`);
    }
  } else {
    if (filters.from) {
      query = query.gte("created_at", `${filters.from}T00:00:00.000Z`);
    }
    if (filters.to) {
      query = query.lte("created_at", `${filters.to}T23:59:59.999Z`);
    }
  }

  const [{ data: payments }, disputeLinks] = await Promise.all([
    query.limit(100),
    filters.disputed
      ? supabase
          .from("reimbursement_disputes")
          .select("payment_id")
          .eq("household_id", householdId)
          .in("status", ["open", "under_review"])
          .not("payment_id", "is", null)
          .limit(200)
      : Promise.resolve({ data: null }),
  ]);

  let rows = payments ?? [];
  if (filters.disputed && disputeLinks.data) {
    const disputed = new Set(
      disputeLinks.data.map((d) => d.payment_id).filter(Boolean) as string[],
    );
    rows =
      filters.disputed === "yes"
        ? rows.filter((p) => disputed.has(p.id))
        : rows.filter((p) => !disputed.has(p.id));
  }

  const hasFilters = paymentFiltersHaveValues(filters);

  return (
    <main className="space-y-6" data-testid="payments-list">
      <AppBackButton fallbackHref={`/app/${householdId}/money`} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
          Payments
        </h1>
        <Link
          href={`/app/${householdId}/money/payments/new`}
          className="inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
        >
          Record payment
        </Link>
      </div>
      <p className="text-sm text-text-secondary">
        HouseholdOS records external payments. It does not move money or verify
        providers. Private payment notes are not shown in this list.
      </p>

      <form
        className="flex flex-wrap gap-2 text-sm"
        data-testid="payment-filters"
        method="get"
      >
        <select
          name="status"
          defaultValue={filters.status ?? ""}
          className="min-h-11 rounded-md border border-border bg-input-bg px-2 py-1"
        >
          <option value="">All statuses</option>
          {[
            "submitted",
            "confirmed",
            "rejected",
            "cancelled",
            "reversed",
          ].map((s) => (
            <option key={s} value={s}>
              {s.replaceAll("_", " ")}
            </option>
          ))}
        </select>
        <select
          name="member"
          defaultValue={filters.member ?? ""}
          className="min-h-11 rounded-md border border-border bg-input-bg px-2 py-1"
        >
          <option value="">All members</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
        <input
          type="month"
          name="month"
          defaultValue={filters.month ?? ""}
          className="min-h-11 rounded-md border border-border bg-input-bg px-2 py-1"
          aria-label="Month"
        />
        <select
          name="pendingConfirmation"
          defaultValue={filters.pendingConfirmation ?? ""}
          className="min-h-11 rounded-md border border-border bg-input-bg px-2 py-1"
        >
          <option value="">Pending: any</option>
          <option value="yes">Awaiting confirmation</option>
          <option value="no">Not pending</option>
        </select>
        <select
          name="disputed"
          defaultValue={filters.disputed ?? ""}
          className="min-h-11 rounded-md border border-border bg-input-bg px-2 py-1"
        >
          <option value="">Dispute: any</option>
          <option value="yes">Disputed</option>
          <option value="no">Not disputed</option>
        </select>
        <button
          type="submit"
          className="min-h-11 rounded-md border border-border bg-secondary px-3 py-1 text-secondary-foreground"
        >
          Filter
        </button>
        {hasFilters ? (
          <Link
            href={paymentsListHref(householdId)}
            className="inline-flex min-h-11 items-center rounded-md border border-border px-3"
          >
            Reset
          </Link>
        ) : null}
      </form>

      {rows.length === 0 ? (
        <EmptyState
          title={hasFilters ? "No matching payments" : "No payments recorded"}
          description={
            hasFilters
              ? "Nothing matches these filters."
              : "When someone records an external payment toward reimbursements, it will appear here."
          }
          action={
            !hasFilters ? (
              <Link
                href={`/app/${householdId}/money/payments/new`}
                className="inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
              >
                Start settle-up
              </Link>
            ) : undefined
          }
        />
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border bg-surface">
          {rows.map((p) => (
            <li key={p.id}>
              <Link
                href={`/app/${householdId}/money/payments/${p.id}`}
                className="flex flex-col gap-2 px-4 py-3.5 text-sm hover:bg-surface-interactive sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="space-y-1">
                  <span className="block font-medium">
                    {label(p.sender_membership_id)} →{" "}
                    {label(p.recipient_membership_id)}
                  </span>
                  <PaymentStatusBadge status={p.status} />
                </span>
                <span className="tabular-nums font-medium">
                  {formatMoney(p.total_amount_cents)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
