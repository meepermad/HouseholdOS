import { AppHeader } from "@/components/shell/app-header";
import { HouseholdNav } from "@/components/household-nav";
import { HouseholdSwitcher } from "@/components/household-switcher";
import { AppBadgeSync } from "@/components/notifications/app-badge-sync";
import { UnauthorizedHouseholdState } from "@/components/unauthorized-household";
import { AppError, logServerError } from "@/lib/errors";
import {
  assertActiveMembership,
  listAuthorizedHouseholdIds,
} from "@/lib/household-context";
import { countUnreadNotifications } from "@/lib/notifications/queries";
import { getNavBadgeCounts } from "@/lib/shell/nav-badges";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function HouseholdLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = await params;

  let ctx;
  try {
    ctx = await assertActiveMembership(householdId);
  } catch (error) {
    if (error instanceof AppError && error.code === "authorization") {
      return <UnauthorizedHouseholdState message={error.publicMessage} />;
    }
    if (error instanceof AppError && error.code === "not_found") {
      notFound();
    }
    if (error instanceof AppError && error.code === "database_failure") {
      logServerError("household_layout", error, { householdId });
      return (
        <UnauthorizedHouseholdState message="HouseholdOS could not verify this household right now. Try again or sign out." />
      );
    }
    throw error;
  }

  const supabase = await createClient();

  const [householdResult, authorized] = await Promise.all([
    supabase
      .from("households")
      .select("id, name, property_nickname, status")
      .eq("id", householdId)
      .maybeSingle(),
    listAuthorizedHouseholdIds(ctx.userId),
  ]);

  const { data: household, error: householdError } = householdResult;

  if (householdError) {
    logServerError("household_layout_query", householdError, { householdId });
    return (
      <UnauthorizedHouseholdState message="HouseholdOS could not load this household. Try again or sign out." />
    );
  }

  if (!household || household.status !== "active") {
    notFound();
  }

  const { data: households } = await supabase
    .from("households")
    .select("id, name")
    .in("id", authorized.length ? authorized : [household.id])
    .eq("status", "active");

  const householdOptions =
    households ?? [{ id: household.id, name: household.name }];

  let unreadCount = 0;
  try {
    unreadCount = await countUnreadNotifications(ctx.userId);
  } catch (error) {
    logServerError("household_layout_unread_count", error, { householdId });
  }

  let badgeCounts = {};
  try {
    badgeCounts = await getNavBadgeCounts(householdId, ctx.membershipId);
  } catch (error) {
    logServerError("household_layout_badge_counts", error, { householdId });
  }

  return (
    <div className="safe-px mx-auto flex min-h-dvh w-full max-w-5xl flex-col lg:flex-row">
      <AppBadgeSync count={unreadCount} />
      <aside className="hidden w-64 shrink-0 border-r border-border bg-navigation lg:flex lg:flex-col">
        <div className="border-b border-border p-4">
          <p className="font-[family-name:var(--font-display)] text-lg text-text-primary">
            HouseholdOS
          </p>
          <p className="mt-1 truncate text-xs text-text-muted">{household.name}</p>
        </div>
        <div className="border-b border-border p-3">
          <HouseholdSwitcher
            householdId={householdId}
            households={householdOptions}
            compact
          />
        </div>
        <HouseholdNav
          householdId={householdId}
          variant="sidebar"
          unreadCount={unreadCount}
          badgeCounts={badgeCounts}
        />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="lg:hidden">
          <AppHeader
            householdName={household.name}
            householdId={householdId}
            households={householdOptions}
            unreadCount={unreadCount}
          />
          <HouseholdNav
            householdId={householdId}
            variant="top"
            unreadCount={unreadCount}
            badgeCounts={badgeCounts}
          />
        </div>
        <div className="hidden border-b border-border lg:block">
          <AppHeader
            householdName={household.name}
            householdId={householdId}
            households={householdOptions}
            unreadCount={unreadCount}
            showBrand
          />
        </div>
        <div className="app-main-pad flex-1 px-4 py-4 md:px-6 md:py-6">
          {children}
        </div>
        <HouseholdNav
          householdId={householdId}
          variant="bottom"
          unreadCount={unreadCount}
          badgeCounts={badgeCounts}
        />
      </div>
    </div>
  );
}
