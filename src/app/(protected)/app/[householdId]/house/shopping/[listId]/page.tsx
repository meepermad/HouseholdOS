import { notFound } from "next/navigation";
import { ShoppingListContent } from "@/components/house/ShoppingListContent";
import { assertActiveMembership } from "@/lib/household-context";
import { getShoppingListWithItems } from "@/lib/house/queries";

export const dynamic = "force-dynamic";

export default async function ShoppingListPage({
  params,
}: {
  params: Promise<{ householdId: string; listId: string }>;
}) {
  const { householdId, listId } = await params;
  await assertActiveMembership(householdId);
  const result = await getShoppingListWithItems(householdId, listId);
  if (!result) notFound();
  return <ShoppingListContent householdId={householdId} listId={listId} />;
}
