import { redirect } from "next/navigation";

export default async function RecipeEditPage({
  params,
}: {
  params: Promise<{ householdId: string; recipeId: string }>;
}) {
  const { householdId, recipeId } = await params;
  redirect(`/app/${householdId}/recipes/${recipeId}`);
}
