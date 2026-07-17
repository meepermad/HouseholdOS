import { assertActiveMembership } from "@/lib/household-context";
import { listActiveMemberOptions } from "@/lib/expenses/queries";
import { createClient } from "@/lib/supabase/server";
import { OpeningBalanceForm } from "@/components/payments/OpeningBalanceForm";
import { AppBackButton } from "@/components/app-back-button";
import { householdRoutes } from "@/lib/routes/household";

export const dynamic = "force-dynamic";

export default async function NewOpeningBalancePage({
  params,
}: {
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = await params;
  await assertActiveMembership(householdId);
  const [members, supabase] = await Promise.all([
    listActiveMemberOptions(householdId),
    createClient(),
  ]);
  const { data: household } = await supabase
    .from("households")
    .select("currency")
    .eq("id", householdId)
    .maybeSingle();

  return (
    <main className="space-y-6">
      <AppBackButton fallbackHref={householdRoutes.money.openingBalances(householdId)} />
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
        New opening balance
      </h1>
      <OpeningBalanceForm
        householdId={householdId}
        members={members}
        currency={household?.currency ?? "USD"}
      />
    </main>
  );
}
