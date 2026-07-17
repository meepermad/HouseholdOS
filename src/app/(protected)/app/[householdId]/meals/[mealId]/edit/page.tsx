import { redirect } from "next/navigation";

export default async function MealEditPage({
  params,
}: {
  params: Promise<{ householdId: string; mealId: string }>;
}) {
  const { householdId, mealId } = await params;
  redirect(`/app/${householdId}/meals/${mealId}`);
}
