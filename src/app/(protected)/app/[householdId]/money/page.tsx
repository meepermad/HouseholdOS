import Link from "next/link";
import { Suspense } from "react";
import { assertActiveMembership } from "@/lib/household-context";
import { can } from "@/lib/permissions";
import { getLaunchFeatureReadiness } from "@/lib/launch/feature-readiness";
import { LaunchFeatureUnavailable } from "@/components/launch/LaunchFeatureUnavailable";
import { Skeleton } from "@/components/ui/skeleton";
import { loadMoneyOverview } from "@/lib/money/overview";
import { defaultMonthKey } from "@/lib/money/monthly-summary";
import { MoneyBalanceSummary } from "@/components/money/MoneyBalanceSummary";
import { MoneyPrimaryActions } from "@/components/money/MoneyPrimaryActions";
import { MoneyAttentionQueue } from "@/components/money/MoneyAttentionQueue";
import { MoneyPairwiseBalances } from "@/components/money/MoneyPairwiseBalances";
import { MoneyMonthlySummary } from "@/components/money/MoneyMonthlySummary";
import { MoneyRecentActivity } from "@/components/money/MoneyRecentActivity";
import { MoneyToolsSheet } from "@/components/money/MoneyToolsSheet";

export const dynamic = "force-dynamic";

async function MoneyDashboard({
  householdId,
  membershipId,
  userId,
  roles,
  month,
}: {
  householdId: string;
  membershipId: string;
  userId: string;
  roles: Parameters<typeof loadMoneyOverview>[0]["roles"];
  month: string;
}) {
  const overview = await loadMoneyOverview({
    householdId,
    membershipId,
    userId,
    roles,
    month,
  });

  return (
    <div className="space-y-6 lg:grid lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start lg:gap-8 lg:space-y-0">
      <div className="space-y-6">
        <MoneyBalanceSummary balance={overview.balance} />
        <MoneyPrimaryActions actions={overview.primaryActions} />

        {overview.isSingleMember ? (
          <section
            className="rounded-md border border-border bg-surface px-4 py-3 text-sm"
            data-testid="money-single-member"
          >
            <p>
              Invite your roommates to split shared purchases and track
              reimbursements.
            </p>
            {overview.canInvite ? (
              <Link
                href={`/app/${householdId}/settings`}
                className="mt-2 inline-flex min-h-11 items-center font-semibold text-primary underline-offset-2 hover:underline"
              >
                Invite roommates
              </Link>
            ) : null}
          </section>
        ) : null}

        <MoneyAttentionQueue items={overview.attention} />
        <MoneyPairwiseBalances
          householdId={householdId}
          rows={overview.pairwise}
          settledHiddenCount={overview.settledHiddenCount}
          routedSuggestionAvailable={overview.routedSuggestionAvailable}
          isSingleMember={overview.isSingleMember}
        />
        <MoneyMonthlySummary householdId={householdId} summary={overview.monthly} />
        <MoneyRecentActivity
          householdId={householdId}
          items={overview.activity}
          canCreateExpense={can(roles, "expense.create")}
        />
      </div>

      <aside className="space-y-4 lg:sticky lg:top-4">
        <MoneyToolsSheet tools={overview.tools} />
        <p className="hidden text-xs text-text-muted lg:block">
          Updated {new Date(overview.fetchedAt).toLocaleString()} · overview v
          {overview.version}
        </p>
      </aside>
    </div>
  );
}

export default async function MoneyHubPage({
  params,
  searchParams,
}: {
  params: Promise<{ householdId: string }>;
  searchParams: Promise<{ month?: string }>;
}) {
  const { householdId } = await params;
  const sp = await searchParams;
  const ctx = await assertActiveMembership(householdId);
  const launch = await getLaunchFeatureReadiness();
  const month =
    sp.month && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : defaultMonthKey();

  return (
    <main className="space-y-6" data-testid="money-hub">
      <header className="space-y-2">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight">
          Money
        </h1>
        <p className="text-sm text-text-secondary">
          Track shared purchases, reimbursements, and external payment records.
          HouseholdOS does not move money or verify payment providers.
        </p>
      </header>

      {!launch.receipts && launch.missingMessage ? (
        <LaunchFeatureUnavailable
          title="Receipt capture not ready"
          message={launch.missingMessage}
        />
      ) : null}

      <Suspense
        fallback={
          <div className="space-y-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-12 w-48" />
            <Skeleton className="h-40 w-full" />
          </div>
        }
      >
        <MoneyDashboard
          householdId={householdId}
          membershipId={ctx.membershipId}
          userId={ctx.userId}
          roles={ctx.roles}
          month={month}
        />
      </Suspense>
    </main>
  );
}
