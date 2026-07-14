import { formatMoney } from "@/lib/expenses/display";
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
    return (
      <section
        className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900"
        role="alert"
        data-testid="reconciliation-error"
      >
        <p className="font-medium">Not ready to confirm</p>
        <p>{calc.message}</p>
        <p className="mt-1 text-xs">
          Declared {formatMoney(declaredTotalCents)}
          {calc.calculatedTotalCents !== undefined
            ? ` · Calculated ${formatMoney(calc.calculatedTotalCents)}`
            : null}
        </p>
      </section>
    );
  }

  return (
    <section
      className="space-y-3 rounded-md border border-line bg-accent-soft/40 p-3"
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
      <p className="text-xs text-emerald-900">Reconciled with declared total.</p>

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

      <h3 className="pt-2 text-sm font-semibold">Obligations</h3>
      {calc.obligations.length === 0 ? (
        <p className="text-sm text-slate-600">No reimbursements (payer covers all).</p>
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
