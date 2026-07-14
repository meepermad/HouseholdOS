import Link from "next/link";
import { ShellHeader } from "@/components/shell-header";
import { HouseholdNav } from "@/components/household-nav";
import { HouseholdSwitcher } from "@/components/household-switcher";
import { AppError } from "@/lib/errors";
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
      return (
        <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5">
          <h1 className="text-xl font-semibold">Unauthorized</h1>
          <p className="mt-2 text-sm text-slate-600">{error.publicMessage}</p>
          <Link href="/app" className="mt-4 underline">
            Back to your households
          </Link>
        </main>
      );
    }
    if (error instanceof AppError && error.code === "not_found") {
      notFound();
    }
    throw error;
  }

  const supabase = await createClient();
  const { data: household } = await supabase
    .from("households")
    .select("id, name, property_nickname, status")
    .eq("id", householdId)
    .maybeSingle();

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
