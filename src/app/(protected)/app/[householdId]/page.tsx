import Link from "next/link";
import { assertActiveMembership } from "@/lib/household-context";
import { formatUsdFromCents, toCents } from "@/lib/money";
import { FINANCE_COPY } from "@/lib/presentation";
import { loadHomeActionCenter } from "@/lib/home/action-center";
import { QUICK_ADD_ACTIONS } from "@/lib/nav-items";
import { EmptyState } from "@/components/ui/empty-state";
import { can } from "@/lib/permissions";
import { SetupReminderCard } from "@/components/setup/SetupReminderCard";
import { loadSetupReminder } from "@/lib/setup/queries";

export const dynamic = "force-dynamic";

export default async function HouseholdHomePage({
  params,
}: {
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = await params;
  const ctx = await assertActiveMembership(householdId);
  const data = await loadHomeActionCenter({
    householdId,
    membershipId: ctx.membershipId,
    userId: ctx.userId,
  });
  const setupReminder = await loadSetupReminder(householdId);

  const net = data.money.youAreOwedCents - data.money.youOweCents;

  return (
    <main className="app-page-accent space-y-6" data-testid="home-action-center">
      <section>
        <h1 className="font-[family-name:var(--font-display)] text-2xl text-text-primary md:text-3xl">
          Home
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          What needs attention in your household today.
        </p>
      </section>

      {setupReminder ? (
        <SetupReminderCard householdId={householdId} progress={setupReminder} />
      ) : null}

      <section className="space-y-2" aria-labelledby="needs-attention-heading">
        <h2
          id="needs-attention-heading"
          className="text-sm font-semibold uppercase tracking-wide text-text-muted"
        >
          Needs your attention
        </h2>
        {data.attention.length === 0 ? (
          <EmptyState
            variant="section"
            title="You are caught up"
            description="Nothing needs your action right now."
            testId="home-attention-empty"
          />
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-md border border-border bg-surface">
            {data.attention.map((item) => (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className="block min-h-11 px-4 py-3 hover:bg-surface-interactive"
                >
                  <p className="text-sm font-medium text-text-primary">
                    {item.title}
                    {item.urgency === "high" ? (
                      <span className="ml-2 text-xs font-semibold text-destructive">
                        Urgent
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-0.5 text-xs text-text-secondary">
                    {item.detail}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2" aria-labelledby="today-heading">
        <h2
          id="today-heading"
          className="text-sm font-semibold uppercase tracking-wide text-text-muted"
        >
          Today
        </h2>
        {data.today.length === 0 ? (
          <EmptyState
            variant="inline"
            title="Nothing scheduled for today."
            testId="home-today-empty"
          />
        ) : (
          <ul className="space-y-1">
            {data.today.map((item) => (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className="flex min-h-11 items-center rounded-md px-2 text-sm text-text-primary hover:bg-surface-interactive"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2" aria-labelledby="money-heading">
        <div className="flex items-center justify-between">
          <h2
            id="money-heading"
            className="text-sm font-semibold uppercase tracking-wide text-text-muted"
          >
            Money
          </h2>
          <Link
            href={`/app/${householdId}/money`}
            className="inline-flex min-h-11 items-center text-sm text-primary underline-offset-2 hover:underline"
          >
            See all
          </Link>
        </div>
        <div
          className="grid grid-cols-3 gap-2 rounded-md border border-border bg-surface px-3 py-3 text-center"
          data-testid="home-money-summary"
        >
          <div>
            <p className="text-[0.65rem] uppercase tracking-wide text-text-muted">
              {FINANCE_COPY.youOwe}
            </p>
            <p className="mt-1 text-sm font-semibold">
              {formatUsdFromCents(toCents(data.money.youOweCents))}
            </p>
          </div>
          <div>
            <p className="text-[0.65rem] uppercase tracking-wide text-text-muted">
              {FINANCE_COPY.youAreOwed}
            </p>
            <p className="mt-1 text-sm font-semibold">
              {formatUsdFromCents(toCents(data.money.youAreOwedCents))}
            </p>
          </div>
          <div>
            <p className="text-[0.65rem] uppercase tracking-wide text-text-muted">
              {FINANCE_COPY.net}
            </p>
            <p className="mt-1 text-sm font-semibold">
              {formatUsdFromCents(toCents(net))}
            </p>
          </div>
        </div>
        {data.money.awaitingConfirmation > 0 ? (
          <p className="text-xs text-text-secondary">
            {data.money.awaitingConfirmation} payment
            {data.money.awaitingConfirmation === 1 ? "" : "s"} awaiting
            confirmation
          </p>
        ) : null}
      </section>

      {data.houseExceptions.length > 0 ? (
        <section className="space-y-2" aria-labelledby="house-heading">
          <h2
            id="house-heading"
            className="text-sm font-semibold uppercase tracking-wide text-text-muted"
          >
            House summary
          </h2>
          <ul className="space-y-1">
            {data.houseExceptions.map((item) => (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className="flex min-h-11 items-center rounded-md px-2 text-sm text-text-primary hover:bg-surface-interactive"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {data.upcoming.length > 0 ? (
        <section className="space-y-2" aria-labelledby="upcoming-heading">
          <h2
            id="upcoming-heading"
            className="text-sm font-semibold uppercase tracking-wide text-text-muted"
          >
            Upcoming
          </h2>
          <ul className="space-y-1">
            {data.upcoming.map((item) => (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className="flex min-h-11 items-center rounded-md px-2 text-sm text-text-primary hover:bg-surface-interactive"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="space-y-2" aria-labelledby="quick-actions-heading">
        <h2
          id="quick-actions-heading"
          className="text-sm font-semibold uppercase tracking-wide text-text-muted"
        >
          Quick actions
        </h2>
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {QUICK_ADD_ACTIONS.map((action) => (
            <li key={action.key}>
              <Link
                href={action.href(householdId)}
                className="flex min-h-11 items-center justify-center rounded-md border border-border bg-surface px-2 text-center text-sm font-medium text-text-primary hover:bg-surface-interactive"
                data-testid={`home-quick-${action.key}`}
              >
                {action.label}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {can(ctx.roles, "member.invite") || can(ctx.roles, "household.update") ? (
        <p className="text-center text-xs text-text-muted">
          <Link
            href={`/app/${householdId}/settings/household`}
            className="inline-flex min-h-11 items-center underline-offset-2 hover:underline"
          >
            Household settings
          </Link>
          {" · "}
          <Link
            href={`/app/${householdId}/settings/members`}
            className="inline-flex min-h-11 items-center underline-offset-2 hover:underline"
          >
            Members
          </Link>
        </p>
      ) : null}
    </main>
  );
}
