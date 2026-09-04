import { formatMoney } from "@/lib/expenses/display";
import { describeReconciliation } from "@/lib/expenses/reconciliation-guidance";
import type { CalculateExpenseResult, CalculateExpenseFailure } from "@/lib/expenses";
import type { MemberOption } from "@/lib/expenses/display";

export function ReconciliationSummary({
  calc,
  members,
  declaredTotalCents,
}: {
  calc: CalculateExpenseResult | CalculateExpenseFailure;
  members: MemberOption[];
  declaredTotalCents: number;
}) {
  const label = (id: string) =>
    members.find((m) => m.id === id)?.label ?? id.slice(0, 8);

  if (!calc.ok) {
    const guidance = describeReconciliation({
      code: calc.code,
      message: calc.message,
      declaredTotalCents,
      calculatedTotalCents: calc.calculatedTotalCents,
    });
    return (
      <section
        className="space-y-2 rounded-md border border-destructive bg-destructive-soft p-3 text-sm text-destructive"
        role="alert"
        data-testid="reconciliation-error"
      >
        <p className="font-medium">{guidance.title}</p>
        <p>{guidance.explanation}</p>
        {guidance.differenceCents !== null ? (
          <p data-testid="reconciliation-difference">
            {guidance.differenceCents > 0
              ? `${formatMoney(guidance.differenceCents)} of the receipt total is not accounted for.`
              : `The lines add up to ${formatMoney(-guidance.differenceCents)} more than the receipt total.`}
          </p>
        ) : null}
        {guidance.options.length > 0 ? (
          <ul
            className="list-disc space-y-1 pl-5 text-text-secondary"
            data-testid="reconciliation-options"
          >
            {guidance.options.map((option) => (
              <li key={option}>{option}</li>
            ))}
          </ul>
        ) : null}
        <p className="text-xs text-text-secondary">
          Declared {formatMoney(declaredTotalCents)}
          {calc.calculatedTotalCents !== undefined
            ? ` · Lines add up to ${formatMoney(calc.calculatedTotalCents)}`
            : null}
        </p>
      </section>
    );
  }

  return (
    <section
      className="space-y-3 rounded-md border border-border bg-accent-soft/40 p-3"
      data-testid="reconciliation-summary"
    >
      <div className="flex justify-between text-sm">
        <span>Subtotal</span>
        <span>{formatMoney(calc.itemSubtotalCents)}</span>
      </div>
      <div className="flex justify-between text-sm">
        <span>Adjustments</span>
        <span>{formatMoney(calc.adjustmentsNetCents)}</span>
      </div>
      <div className="flex justify-between font-medium">
        <span>Total</span>
        <span>{formatMoney(calc.calculatedTotalCents)}</span>
      </div>
      <p className="text-xs text-success">Reconciled with declared total.</p>

      <h3 className="pt-2 text-sm font-semibold">Each member&apos;s share</h3>
      <ul className="space-y-1 text-sm">
        {calc.memberShares
          .filter((m) => m.totalShareCents !== 0)
          .map((m) => (
            <li key={m.membershipId} className="flex justify-between">
              <span>{label(m.membershipId)}</span>
              <span>{formatMoney(m.totalShareCents)}</span>
            </li>
          ))}
      </ul>

      <h3 className="pt-2 text-sm font-semibold">Who owes whom</h3>
      {calc.obligations.length === 0 ? (
        <p className="text-sm text-text-secondary">No one owes anyone — the payer covers this.</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {calc.obligations.map((o) => (
            <li key={`${o.debtorMembershipId}-${o.creditorMembershipId}`}>
              {label(o.debtorMembershipId)} owes {label(o.creditorMembershipId)}{" "}
              {formatMoney(o.amountCents)}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
