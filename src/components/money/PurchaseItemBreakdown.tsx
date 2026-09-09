import type { ReactNode } from "react";
import { formatMoney } from "@/lib/expenses/display";
import type { PurchaseBreakdownLine } from "@/lib/money/purchase-breakdown";

export type PurchaseBreakdownLineView = PurchaseBreakdownLine & {
  action?: ReactNode;
};

export function PurchaseItemBreakdown({
  merchant,
  items,
  adjustments = [],
  testId,
}: {
  merchant?: string | null;
  items: PurchaseBreakdownLineView[];
  adjustments?: PurchaseBreakdownLineView[];
  testId?: string;
}) {
  return (
    <div className="space-y-4" data-testid={testId}>
      {merchant ? <p className="font-medium">{merchant}</p> : null}
      <BreakdownList title="Items" lines={items} empty="No items on this receipt." />
      {adjustments.length > 0 ? (
        <BreakdownList title="Tax, tip, and fees" lines={adjustments} />
      ) : null}
    </div>
  );
}

function BreakdownList({
  title,
  lines,
  empty,
}: {
  title: string;
  lines: PurchaseBreakdownLineView[];
  empty?: string;
}) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-text-muted">
        {title}
      </h3>
      {lines.length === 0 && empty ? (
        <p className="text-sm text-text-secondary">{empty}</p>
      ) : (
        <ul className="space-y-3">
          {lines.map((line) => (
            <li
              key={line.id}
              className="rounded-md border border-border bg-surface p-3 text-sm"
            >
              <div className="flex justify-between gap-3 font-medium">
                <span>{line.name}</span>
                <span className="tabular-nums">{formatMoney(line.totalCents)}</span>
              </div>
              <p className="mt-1 text-xs text-text-secondary">Tagged: {line.tagged}</p>
              {line.shares.length > 0 ? (
                <ul className="mt-2 space-y-0.5 text-xs">
                  {line.shares.map((share) => (
                    <li
                      key={share.membershipId}
                      className="flex justify-between gap-3"
                    >
                      <span>{share.name}</span>
                      <span className="tabular-nums">
                        {formatMoney(share.amountCents)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
              {line.action ? <div className="mt-1">{line.action}</div> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
