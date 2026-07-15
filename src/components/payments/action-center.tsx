import Link from "next/link";
import { formatMoney } from "@/lib/expenses/display";
import { listActionCenterItems } from "@/lib/payments/queries";
import { ActionForm } from "@/components/action-form";
import { markNotificationReadAction } from "@/app/actions/notifications";

export async function MoneyActionCenter({
  householdId,
  membershipId,
  userId,
}: {
  householdId: string;
  membershipId: string;
  userId: string;
}) {
  const items = await listActionCenterItems(householdId, membershipId, userId);
  const hasAnything =
    items.awaitingConfirm.length > 0 ||
    items.notifications.length > 0 ||
    items.openDisputes.length > 0 ||
    items.refundsOwed.length > 0;

  if (!hasAnything) return null;

  return (
    <section className="space-y-3" data-testid="action-center">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">
        Needs attention
      </h2>
      <ul className="divide-y divide-border rounded-md border border-border bg-surface">
        {items.awaitingConfirm.map((p) => (
          <li key={p.id}>
            <Link
              href={`/app/${householdId}/money/payments/${p.id}`}
              className="block px-4 py-3.5 text-sm hover:bg-surface-interactive"
            >
              Incoming payment awaiting confirmation ·{" "}
              {formatMoney(p.total_amount_cents)} ({p.external_method.replaceAll("_", " ")})
            </Link>
          </li>
        ))}
        {items.refundsOwed.map((r) => (
          <li key={r.obligation_id}>
            <Link
              href={`/app/${householdId}/money/reimbursements/${r.obligation_id}`}
              className="block px-4 py-3.5 text-sm hover:bg-surface-interactive"
            >
              Refund obligation owed ·{" "}
              {formatMoney(r.official_outstanding_cents ?? 0)}
            </Link>
          </li>
        ))}
        {items.openDisputes.map((d) => (
          <li key={d.id}>
            <Link
              href={`/app/${householdId}/money/disputes/${d.id}`}
              className="block px-4 py-3.5 text-sm hover:bg-surface-interactive"
            >
              Open dispute · {d.dispute_type.replaceAll("_", " ")}
            </Link>
          </li>
        ))}
        {items.notifications.map((n) => (
          <li key={n.id} className="px-4 py-3.5 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-medium">{n.title}</p>
                <p className="text-text-secondary">{n.body}</p>
                {n.action_href ? (
                  <Link href={n.action_href} className="mt-1 inline-block underline">
                    Open
                  </Link>
                ) : null}
              </div>
              <ActionForm action={markNotificationReadAction}>
                <input type="hidden" name="householdId" value={householdId} />
                <input type="hidden" name="notificationId" value={n.id} />
                <button
                  type="submit"
                  className="min-h-11 rounded-md border border-border px-3 text-xs font-medium"
                >
                  Mark read
                </button>
              </ActionForm>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
