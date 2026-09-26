import Link from "next/link";
import { formatMoney } from "@/lib/expenses/display";
import {
  SOURCE_KIND_LABEL,
  type BalanceExplanation,
  type ExplanationLine,
} from "@/lib/money/balance-explanation";

function LineList({ lines }: { lines: ExplanationLine[] }) {
  if (lines.length === 0) return null;
  return (
    <ul className="space-y-3">
      {lines.map((line) => (
        <li key={line.id} className="rounded-md border border-border bg-surface px-3 py-3 text-sm">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <Link href={line.href} className="font-medium text-primary underline-offset-2 hover:underline">
              {line.label}
            </Link>
            <span className="tabular-nums">{formatMoney(line.remainingCents)}</span>
          </div>
          <p className="mt-1 text-xs text-text-muted">
            {SOURCE_KIND_LABEL[line.sourceKind]}. {line.sourceNote}
          </p>
          {line.receiptHref ? (
            <Link
              href={line.receiptHref}
              className="mt-1 inline-flex min-h-11 items-center text-xs font-medium text-primary underline-offset-2 hover:underline"
            >
              Original receipt
            </Link>
          ) : null}
          <details className="mt-2">
            <summary className="cursor-pointer text-xs font-medium">How was this calculated?</summary>
            <ul className="mt-2 space-y-1 text-xs text-text-secondary">
              <li>Original amount {formatMoney(line.originalCents)}</li>
              {line.effectiveCents !== line.originalCents ? (
                <li>Current obligation {formatMoney(line.effectiveCents)}</li>
              ) : null}
              {line.itemShares.map((item) => (
                <li key={`${line.id}-${item.description}`}>
                  {item.description}: {formatMoney(item.amountCents)}
                </li>
              ))}
              {line.paidCents > 0 ? <li>Payments applied −{formatMoney(line.paidCents)}</li> : null}
              {line.waivedCents > 0 ? (
                <li>Financial adjustment −{formatMoney(line.waivedCents)}</li>
              ) : null}
              {line.pendingCents > 0 ? (
                <li>Payment reported as sent, not yet received {formatMoney(line.pendingCents)}</li>
              ) : null}
              <li>Remaining {formatMoney(line.remainingCents)}</li>
            </ul>
          </details>
        </li>
      ))}
    </ul>
  );
}

export function BalanceBreakdown({ explanation }: { explanation: BalanceExplanation }) {
  const both =
    explanation.linesYouOwe.length > 0 && explanation.linesTheyOwe.length > 0;
  return (
    <section className="space-y-4" data-testid="balance-breakdown">
      <div className="space-y-1">
        <h2 className="text-sm font-semibold">Original obligations</h2>
        <p className="text-xs text-text-muted">
          These are the balances before they are simplified.
        </p>
      </div>
      {explanation.linesYouOwe.length > 0 ? (
        <div className="space-y-2">
          <h3 className="text-sm font-medium">
            You owe {explanation.counterpartyName} {formatMoney(explanation.youOweCents)}
          </h3>
          <LineList lines={explanation.linesYouOwe} />
        </div>
      ) : null}
      {explanation.linesTheyOwe.length > 0 ? (
        <div className="space-y-2">
          <h3 className="text-sm font-medium">
            {explanation.counterpartyName} owes you {formatMoney(explanation.theyOweYouCents)}
          </h3>
          <LineList lines={explanation.linesTheyOwe} />
        </div>
      ) : null}
      {both ? (
        <div className="rounded-md border border-border bg-surface-secondary px-3 py-3 text-sm" data-testid="net-settlement">
          <p className="font-medium">Suggested net settlement</p>
          <p className="mt-1">{explanation.netSentence}</p>
          <p className="mt-2 text-xs text-text-muted">
            This suggestion adds the original balances together. It is not itself a receipt,
            and a payment of the net amount is not assigned to one purchase unless you choose
            those expenses.
          </p>
        </div>
      ) : (
        <p className="text-sm text-text-secondary" data-testid="net-settlement">
          {explanation.netSentence}
        </p>
      )}
      {explanation.payments.length > 0 ? (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Payments applied</h3>
          <ul className="space-y-1 text-sm">
            {explanation.payments.map((payment) => (
              <li key={payment.id} className="flex justify-between gap-2">
                <Link href={payment.href} className="text-primary underline-offset-2 hover:underline">
                  {payment.label}
                </Link>
                <span className="tabular-nums">−{formatMoney(payment.amountCents)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
