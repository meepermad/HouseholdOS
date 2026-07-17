import { assertActiveMembership } from "@/lib/household-context";
import { AppBackButton } from "@/components/app-back-button";
import { BarcodeLookupPanel } from "@/components/products/BarcodeLookupPanel";

export const dynamic = "force-dynamic";

export default async function ProductsPage({
  params,
}: {
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = await params;
  await assertActiveMembership(householdId);

  return (
    <main className="space-y-6">
      <AppBackButton fallbackHref={`/app/${householdId}/house`} />
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
        Products
      </h1>
      <BarcodeLookupPanel />
    </main>
  );
}
