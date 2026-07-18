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
                        ? `${formatMoney(row.pendingOutgoingCents)} awaiting their confirmation`
                        : null}
                      {row.pendingOutgoingCents > 0 && row.pendingIncomingCents > 0
                        ? " · "
                        : null}
                      {row.pendingIncomingCents > 0
                        ? `${formatMoney(row.pendingIncomingCents)} awaiting yours`
                        : null}
                    </p>
                  ) : null}
                </div>
                {owesThem ? (
                  <Link
                    href={`/app/${householdId}/money/payments/new`}
                    className="inline-flex min-h-11 items-center rounded-md border border-border px-3 text-sm font-medium"
                  >
                    Record payment
                  </Link>
                ) : (
                  <Link
                    href={`/app/${householdId}/money/balances`}
                    className="inline-flex min-h-11 items-center rounded-md border border-border px-3 text-sm font-medium"
                  >
                    View details
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {settledHiddenCount > 0 ? (
        <p className="text-xs text-text-muted">Everyone else is settled</p>
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
