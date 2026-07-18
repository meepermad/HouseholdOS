import Link from "next/link";
import { formatMoney } from "@/lib/expenses/display";
import type { CategoryBucket } from "@/lib/money/monthly-summary";

/** Compact CSS horizontal bars — no chart library. */
export function MoneyCategoryBars({
  categories,
  categoryHref,
}: {
  categories: CategoryBucket[];
  categoryHref: (category: string) => string;
}) {
  if (categories.length === 0) return null;
  const max = Math.max(...categories.map((c) => c.confirmedCents), 1);
  return (
    <ul className="space-y-2" data-testid="money-category-bars" aria-label="Category spending">
      {categories.slice(0, 6).map((c) => {
        const pct = Math.round((c.confirmedCents / max) * 100);
        return (
          <li key={c.category}>
            <Link
              href={categoryHref(c.category === "uncategorized" ? "other" : c.category)}
              className="block rounded-md py-1 hover:bg-surface-interactive"
            >
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span>{c.label}</span>
                <span className="tabular-nums text-text-secondary">
                  {formatMoney(c.confirmedCents)}
                </span>
              </div>
              <div
                className="mt-1 h-2 overflow-hidden rounded-sm bg-border/60"
                role="img"
                aria-label={`${c.label}: ${formatMoney(c.confirmedCents)}, ${pct} percent of largest category`}
              >
                <div
                  className="h-full rounded-sm bg-primary"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function ConfirmedPendingMeter({
  confirmedCents,
  pendingCents,
}: {
  confirmedCents: number;
  pendingCents: number;
}) {
  const total = confirmedCents + pendingCents;
  if (total <= 0) return null;
  const confirmedPct = Math.round((confirmedCents / total) * 100);
  return (
    <div className="space-y-1" data-testid="money-confirmed-pending-meter">
      <div
        className="flex h-2 overflow-hidden rounded-sm bg-border/60"
        role="img"
        aria-label={`Confirmed ${formatMoney(confirmedCents)}, pending ${formatMoney(pendingCents)}`}
      >
        <div
          className="h-full bg-primary"
          style={{ width: `${confirmedPct}%` }}
          title="Confirmed"
        />
        <div
          className="h-full bg-border"
          style={{ width: `${100 - confirmedPct}%` }}
          title="Pending"
        />
      </div>
      <p className="text-xs text-text-muted">
        Confirmed {formatMoney(confirmedCents)} · Pending{" "}
        {formatMoney(pendingCents)}
      </p>
    </div>
  );
}
