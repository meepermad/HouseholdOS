import Link from "next/link";
import { formatMoney } from "@/lib/expenses/display";
import type { AttentionItem } from "@/lib/money/attention";

export function MoneyAttentionQueue({ items }: { items: AttentionItem[] }) {
  if (items.length === 0) return null;
  return (
    <section className="space-y-3" data-testid="money-attention-queue">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">
        Needs your attention
      </h2>
      <ul className="divide-y divide-border rounded-md border border-border bg-surface">
        {items.map((item) => (
          <li key={item.id} className="px-4 py-3.5">
            <p className="text-sm font-medium">{item.title}</p>
            <p className="mt-1 text-sm text-text-secondary">{item.body}</p>
            {item.amountCents != null ? (
              <p className="mt-1 text-xs tabular-nums text-text-muted">
                {formatMoney(item.amountCents)}
                {item.memberLabel ? ` · ${item.memberLabel}` : null}
              </p>
            ) : null}
            <Link
              href={item.href}
              className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-primary underline-offset-2 hover:underline"
            >
              {item.ctaLabel}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
