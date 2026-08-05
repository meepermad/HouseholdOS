import { assertActiveMembership } from "@/lib/household-context";
import { AppBackButton } from "@/components/app-back-button";
import { BarcodeLookupPanel } from "@/components/products/BarcodeLookupPanel";
import {
  MaturityBadge,
  MaturityNote,
} from "@/components/ui/maturity-badge";
import { featureMaturity } from "@/lib/launch/feature-maturity";

export const dynamic = "force-dynamic";

export default async function ProductsPage({
  params,
}: {
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = await params;
  await assertActiveMembership(householdId);
  const maturity = featureMaturity("productLookup");

  return (
    <main className="space-y-6">
      <AppBackButton fallbackHref={`/app/${householdId}/house`} />
      <header className="space-y-1">
        <h1 className="flex flex-wrap items-center gap-2 font-[family-name:var(--font-display)] text-2xl font-semibold">
          Products
          <MaturityBadge status={maturity.status} />
        </h1>
        <MaturityNote note={maturity.note} />
      </header>
      <BarcodeLookupPanel />
    </main>
  );
}
