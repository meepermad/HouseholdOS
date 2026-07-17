import Link from "next/link";
import { notFound } from "next/navigation";
import { AppBackButton } from "@/components/app-back-button";
import { HouseHubTabs } from "@/components/house/HouseHubTabs";
import { ActionForm } from "@/components/action-form";
import { RecipeFeedbackPrompt } from "@/components/recipes/RecipeFeedbackPrompt";
import {
  cancelMealPlanAction,
  markMealPreparedAction,
  respondToMealAction,
} from "@/app/actions/meals";
import { assertActiveMembership } from "@/lib/household-context";
import {
  getMealPlan,
  getPendingRecipeFeedbackForMeal,
} from "@/lib/meals/queries";
import { estimateServings } from "@/lib/meals/serving-estimate";

export const dynamic = "force-dynamic";

export default async function MealDetailPage({
  params,
}: {
  params: Promise<{ householdId: string; mealId: string }>;
}) {
  const { householdId, mealId } = await params;
  const ctx = await assertActiveMembership(householdId);
  const detail = await getMealPlan(householdId, mealId);
  if (!detail) notFound();
  const { plan, attendees, ingredients } = detail;
  const pendingFeedback = await getPendingRecipeFeedbackForMeal(
    householdId,
    mealId,
    ctx.membershipId,
  );

  const estimate = estimateServings({
    attendees: attendees.map((a: { attendance_status: string; guest_count: number }) => ({
      rsvpStatus:
        a.attendance_status === "no_response"
          ? "needs_action"
          : (a.attendance_status as "going" | "maybe" | "not_going"),
      guestCount: a.guest_count ?? 0,
    })),
    eventGuestCount: plan.guest_count ?? 0,
    bufferServings: Number(plan.buffer_servings ?? 0),
    desiredLeftoverServings: Number(plan.desired_leftover_servings ?? 0),
    organizerTarget: Number(plan.target_servings),
  });

  const feedbackRecipe = pendingFeedback?.recipes as
    | { id: string; name: string }
    | { id: string; name: string }[]
    | null
    | undefined;
  const feedbackRecipeName = Array.isArray(feedbackRecipe)
    ? feedbackRecipe[0]?.name
    : feedbackRecipe?.name;

  return (
    <main className="space-y-5">
      <AppBackButton fallbackHref={`/app/${householdId}/meals`} />
      <header>
        <h1 className="font-[family-name:var(--font-display)] text-3xl">{plan.title}</h1>
        <p className="mt-1 text-sm text-text-secondary">
          {plan.meal_date} · {String(plan.meal_type).replaceAll("_", " ")} · {plan.status}
        </p>
      </header>
      <HouseHubTabs householdId={householdId} />

      {pendingFeedback ? (
        <RecipeFeedbackPrompt
          householdId={householdId}
          feedbackRequestId={String(pendingFeedback.id)}
          recipeName={feedbackRecipeName}
        />
      ) : null}

      <section className="rounded-md border border-border p-4 space-y-2" aria-labelledby="servings-heading">
        <h2 id="servings-heading" className="font-semibold">Serving estimate</h2>
        <p className="text-sm text-text-secondary">
          Confirmed people: {estimate.confirmedPeople}. Possible additional:{" "}
          {estimate.possibleAdditionalPeople}. Buffer: {estimate.bufferServings}. Recommended
          minimum: {estimate.recommendedMinimum}. Organizer target: {estimate.organizerTarget}.
        </p>
        <p className="text-xs text-text-muted">
          Guests are counted separately from servings. No portion ownership is assigned.
        </p>
      </section>

      {plan.meal_type !== "personal" ? (
        <section className="space-y-2">
          <h2 className="font-semibold">Your attendance</h2>
          <ActionForm action={respondToMealAction} pendingLabel="Updating attendance…" className="flex flex-wrap gap-2">
            <input type="hidden" name="householdId" value={householdId} />
            <input type="hidden" name="mealPlanId" value={mealId} />
            <input type="hidden" name="guestCount" value="0" />
            {(["going", "maybe", "not_going"] as const).map((status) => (
              <button
                key={status}
                type="submit"
                name="status"
                value={status}
                className="min-h-11 rounded-md border border-border px-3 py-2 text-sm font-medium"
              >
                {status.replaceAll("_", " ")}
              </button>
            ))}
          </ActionForm>
        </section>
      ) : null}

      <section className="space-y-2">
        <h2 className="font-semibold">Ingredients</h2>
        <ul className="rounded-md border border-border divide-y divide-border">
          {ingredients.map((ing: Record<string, unknown>) => (
            <li key={String(ing.id)} className="px-4 py-3 text-sm">
              <span className="font-medium">{String(ing.display_name)}</span>
              {ing.scaled_quantity != null ? (
                <span className="text-text-secondary">
                  {" "}
                  · {String(ing.scaled_quantity)} {String(ing.quantity_unit)}
                </span>
              ) : null}
              {ing.pantry_match_status ? (
                <span className="text-text-muted"> · {String(ing.pantry_match_status).replaceAll("_", " ")}</span>
              ) : null}
            </li>
          ))}
          {ingredients.length === 0 ? (
            <li className="px-4 py-3 text-sm text-text-secondary">No ingredient checklist yet.</li>
          ) : null}
        </ul>
      </section>

      <div className="flex flex-wrap gap-2 safe-pb sticky bottom-0 bg-background/95 py-3">
        <Link
          href={`/app/${householdId}/meals/${mealId}/shopping`}
          className="min-h-11 rounded-md border border-border px-3 py-2.5 text-sm font-medium"
        >
          Shopping prep
        </Link>
        <ActionForm action={markMealPreparedAction} pendingLabel="Marking meal prepared…">
          <input type="hidden" name="householdId" value={householdId} />
          <input type="hidden" name="mealPlanId" value={mealId} />
          <input type="hidden" name="createBatch" value="true" />
          <input type="hidden" name="remainingState" value="plenty" />
          <button type="submit" className="min-h-11 rounded-md bg-primary px-3 py-2.5 text-sm font-medium text-primary-foreground">
            Mark prepared
          </button>
        </ActionForm>
        <ActionForm action={cancelMealPlanAction} pendingLabel="Cancelling…">
          <input type="hidden" name="householdId" value={householdId} />
          <input type="hidden" name="mealPlanId" value={mealId} />
          <button type="submit" className="min-h-11 rounded-md border border-border px-3 py-2.5 text-sm">
            Cancel meal
          </button>
        </ActionForm>
      </div>
    </main>
  );
}
