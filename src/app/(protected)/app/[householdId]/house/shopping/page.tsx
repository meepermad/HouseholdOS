import { redirect } from "next/navigation";
import { assertActiveMembership } from "@/lib/household-context";
import { ensureAndGetDefaultShoppingList } from "@/lib/house/queries";

export const dynamic = "force-dynamic";

export default async function ShoppingPage({
  params,
}: {
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = await params;
  await assertActiveMembership(householdId);
  const listId = await ensureAndGetDefaultShoppingList(householdId);
  redirect(`/app/${householdId}/house/shopping/${listId}`);
}
