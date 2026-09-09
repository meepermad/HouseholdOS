import Link from "next/link";
import {
  obligationPurchaseLabel,
  type ObligationPurchaseSource,
} from "@/lib/payments/obligation-source";

export function ObligationSourceLinks({
  householdId,
  source,
}: {
  householdId: string;
  source: ObligationPurchaseSource;
}) {
  return (
    <div className="space-y-1" data-testid="obligation-source">
      <p className="text-sm text-text-secondary">{obligationPurchaseLabel(source)}</p>
      {source.receiptId || source.expenseId ? (
        <p className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
          {source.receiptId ? (
            <Link
              href={`/app/${householdId}/money/receipts/${source.receiptId}`}
              className="font-medium text-primary underline-offset-2 hover:underline"
            >
              Receipt
            </Link>
          ) : null}
          {source.expenseId ? (
            <Link
              href={`/app/${householdId}/money/expenses/${source.expenseId}`}
              className="font-medium text-primary underline-offset-2 hover:underline"
            >
              Expense
            </Link>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
