import { formatMoney } from "@/lib/expenses/display";
import type { MemberBalanceSummary } from "@/lib/payments/types";

export function MoneyBalanceSummary({
  balance,
}: {
  balance: MemberBalanceSummary;
}) {
  const netLabel =
    balance.officialNetCents > 0
      ? `Net ${formatMoney(balance.officialNetCents)}. You are owed more than you owe.`
      : balance.officialNetCents < 0
        ? `Net ${formatMoney(balance.officialNetCents)}. You owe more than you are owed.`
        : "Net $0.00. You are settled on confirmed balances.";

  const pendingNote =
    balance.pendingOutgoingCents > 0 || balance.pendingIncomingCents > 0
      ? `Pending payments: ${formatMoney(balance.pendingOutgoingCents)} out, ${formatMoney(balance.pendingIncomingCents)} in (not yet confirmed).`
      : null;

  return (
    <section
      className="rounded-md border border-border bg-surface px-3 py-3"
      data-testid="money-balance-summary"
      aria-label="Balance summary"
    >
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-[0.65rem] uppercase tracking-wide text-text-muted">
            You owe
          </p>
          <p
            className="mt-1 text-sm font-semibold tabular-nums"
            aria-label={`You owe ${formatMoney(balance.officialYouOweCents)} on confirmed balances`}
          >
            {formatMoney(balance.officialYouOweCents)}
          </p>
        </div>
        <div>
          <p className="text-[0.65rem] uppercase tracking-wide text-text-muted">
            You are owed
          </p>
          <p
            className="mt-1 text-sm font-semibold tabular-nums"
            aria-label={`You are owed ${formatMoney(balance.officialYouAreOwedCents)} on confirmed balances`}
          >
            {formatMoney(balance.officialYouAreOwedCents)}
          </p>
        </div>
        <div>
          <p className="text-[0.65rem] uppercase tracking-wide text-text-muted">
            Net
          </p>
          <p
            className="mt-1 text-sm font-semibold tabular-nums"
            aria-label={netLabel}
          >
            {formatMoney(balance.officialNetCents)}
          </p>
        </div>
      </div>
      <p className="mt-2 text-center text-xs text-text-muted">
        Official balances only
        {pendingNote ? (
          <>
            {" · "}
            <span aria-label={pendingNote}>{pendingNote}</span>
          </>
        ) : null}
      </p>
    </section>
  );
}
