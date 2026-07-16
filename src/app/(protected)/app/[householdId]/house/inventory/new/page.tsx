import { redirect } from "next/navigation";
import { AppBackButton } from "@/components/app-back-button";
import { InventoryForm } from "@/components/house/InventoryForm";
import { assertActiveMembership } from "@/lib/household-context";
import { can } from "@/lib/permissions";
import { listActiveMemberOptions } from "@/lib/expenses/queries";
import { listLocations } from "@/lib/house/queries";

export const dynamic = "force-dynamic";

export default async function NewInventoryPage({
  params,
}: {
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = await params;
  const ctx = await assertActiveMembership(householdId);
  if (!can(ctx.roles, "resource.create")) {
    redirect(`/app/${householdId}/house/inventory`);
  }
  const [members, locations] = await Promise.all([
    listActiveMemberOptions(householdId),
    listLocations(householdId),
  ]);
  return (
    <main className="mx-auto max-w-lg space-y-5">
      <AppBackButton fallbackHref={`/app/${householdId}/house/inventory`} />
      <h1 className="font-[family-name:var(--font-display)] text-3xl">Add inventory</h1>
      <InventoryForm householdId={householdId} members={members} locations={locations} />
    </main>
  );
}
