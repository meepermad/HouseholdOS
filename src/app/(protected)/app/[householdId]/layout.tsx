import { ShellHeader } from "@/components/shell-header";
import { HouseholdNav } from "@/components/household-nav";
import { HouseholdSwitcher } from "@/components/household-switcher";
import { UnauthorizedHouseholdState } from "@/components/unauthorized-household";
import { AppError, logServerError } from "@/lib/errors";
import {
  assertActiveMembership,
  listAuthorizedHouseholdIds,
} from "@/lib/household-context";
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
  const { data: household, error: householdError } = await supabase
    .from("households")
    .select("id, name, property_nickname, status")
    .eq("id", householdId)
    .maybeSingle();

  if (householdError) {
    logServerError("household_layout_query", householdError, { householdId });
    return (
      <UnauthorizedHouseholdState message="HouseholdOS could not load this household. Try again or sign out." />
    );
  }

  if (!household || household.status !== "active") {
    notFound();
  }

  const authorized = await listAuthorizedHouseholdIds(ctx.userId);
  const { data: households } = await supabase
    .from("households")
    .select("id, name")
    .in("id", authorized)
    .eq("status", "active");

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col">
      <ShellHeader householdName={household.name} />
      <HouseholdSwitcher
        householdId={householdId}
        households={households ?? [{ id: household.id, name: household.name }]}
      />
      <HouseholdNav householdId={householdId} />
      <div className="flex-1 px-4 py-6">{children}</div>
    </div>
  );
}
