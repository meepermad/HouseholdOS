import Link from "next/link";
import { formatMoney } from "@/lib/expenses/display";
import type { PairwiseHubRow } from "@/lib/money/overview";

export function MoneyPairwiseBalances({
  householdId,
  rows,
  settledHiddenCount,
  routedSuggestionAvailable,
  isSingleMember,
}: {
  householdId: string;
  rows: PairwiseHubRow[];
  settledHiddenCount: number;
  routedSuggestionAvailable: boolean;
  isSingleMember: boolean;
}) {
  if (isSingleMember) return null;

  return (
    <section className="space-y-3" data-testid="money-pairwise-balances">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">
        Balances by roommate
      </h2>
      {rows.length === 0 ? (
        <p className="text-sm text-text-secondary">Everyone is settled.</p>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border bg-surface">
          {rows.map((row) => {
            const owesThem = row.youOweCents > 0;
            return (
              <li
                key={row.counterpartyMembershipId}
                className="flex flex-col gap-2 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-sm font-medium">{row.displayName}</p>
                  <p className="text-sm text-text-secondary">
                    {owesThem
                      ? `You owe ${formatMoney(row.youOweCents)}`
                      : `Owes you ${formatMoney(row.theyOweYouCents)}`}
                  </p>
                  {row.pendingOutgoingCents > 0 || row.pendingIncomingCents > 0 ? (
                    <p className="mt-1 text-xs text-text-muted">
                      Pending:{" "}
                      {row.pendingOutgoingCents > 0
                        ? `${formatMoney(row.pendingOutgoingCents)} reported as sent`
                        : null}
                      {row.pendingOutgoingCents > 0 && row.pendingIncomingCents > 0
                        ? " · "
                        : null}
                      {row.pendingIncomingCents > 0
                        ? `${formatMoney(row.pendingIncomingCents)} waiting for your acknowledgment`
                        : null}
                    </p>
                  ) : null}
                  {row.purchases.length > 0 ? (
                    <ul className="mt-2 space-y-1 text-xs text-text-muted">
                      {row.purchases.slice(0, 3).map((purchase) => (
                        <li key={`${purchase.label}-${purchase.amountCents}`}>
                          {purchase.label}
                          {" · "}
                          {formatMoney(purchase.amountCents)}
                        </li>
                      ))}
                      {row.purchases.length > 3 ? (
                        <li>and {row.purchases.length - 3} more</li>
                      ) : null}
                    </ul>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  {owesThem ? (
                    <Link
                      href={`/app/${householdId}/money/payments/new?direction=sent&counterparty=${row.counterpartyMembershipId}`}
                      className="inline-flex min-h-11 items-center rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground"
                    >
                      I sent payment
                    </Link>
                  ) : (
                    <Link
                      href={`/app/${householdId}/money/payments/new?direction=received&counterparty=${row.counterpartyMembershipId}`}
                      className="inline-flex min-h-11 items-center rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground"
                    >
                      Record payment received
                    </Link>
                  )}
                  <Link
                    href={`/app/${householdId}/money/balances#pair-${row.counterpartyMembershipId}`}
                    className="inline-flex min-h-11 items-center rounded-md border border-border px-3 text-sm font-medium"
                  >
                    See breakdown
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {settledHiddenCount > 0 ? (
        <p className="text-xs text-text-muted">
          <Link
            href={`/app/${householdId}/money/balances#settled`}
            className="font-medium text-primary underline-offset-2 hover:underline"
          >
            View settled history
          </Link>
        </p>
      ) : null}
      {routedSuggestionAvailable ? (
        <div
          className="rounded-md border border-border bg-surface px-4 py-3 text-sm"
          data-testid="money-routed-teaser"
        >
          <p>You may be able to reduce two balances with one payment.</p>
          <Link
            href={`/app/${householdId}/money/simplify`}
            className="mt-2 inline-flex min-h-11 items-center font-semibold text-primary underline-offset-2 hover:underline"
          >
            Review suggestion
          </Link>
        </div>
      ) : null}
    </section>
  );
}
