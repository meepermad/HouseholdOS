"use client";

import { useActionState } from "react";
import { updateShoppingIntelSettingsAction } from "@/app/actions/shopping-intel";
import type { ActionResult } from "@/app/actions/auth";

export function ShoppingIntelSettingsForm({
  householdId,
  shopping,
  rediscovery,
}: {
  householdId: string;
  shopping: {
    enabled: boolean;
    includeSupplyForecasts: boolean;
    includeRecurringStaples: boolean;
    includeProposedMeals: boolean;
    includeGuestNeeds: boolean;
    forecastConfidence: string;
    horizonDays: number;
    showPersonalSeparately: boolean;
  };
  rediscovery: {
    enabled: boolean;
    cadence: string;
    minDays: number;
    maxSuggestions: number;
    allowPush: boolean;
    includeGuestFriendly: boolean;
    includeMealPrep: boolean;
  };
}) {
  const [state, action, pending] = useActionState(
    updateShoppingIntelSettingsAction,
    null as ActionResult | null,
  );

  return (
    <form action={action} className="space-y-6" data-testid="shopping-intel-settings">
      <input type="hidden" name="householdId" value={householdId} />

      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold uppercase tracking-wide text-text-muted">
          Shopping recommendations
        </legend>
        <Toggle name="enabled" label="Enable recommended shopping items" defaultChecked={shopping.enabled} />
        <Toggle name="includeSupplyForecasts" label="Include supply forecasts" defaultChecked={shopping.includeSupplyForecasts} />
        <Toggle name="includeRecurringStaples" label="Include recurring staples" defaultChecked={shopping.includeRecurringStaples} />
        <Toggle name="includeProposedMeals" label="Include proposed meal ingredients" defaultChecked={shopping.includeProposedMeals} />
        <Toggle name="includeGuestNeeds" label="Include guest needs" defaultChecked={shopping.includeGuestNeeds} />
        <Toggle name="showPersonalSeparately" label="Show personal suggestions separately" defaultChecked={shopping.showPersonalSeparately} />
        <label className="block text-sm">
          Forecast confidence threshold
          <select
            name="forecastConfidence"
            defaultValue={shopping.forecastConfidence}
            className="mt-1 min-h-11 w-full rounded-md border border-border bg-background px-3"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </label>
        <label className="block text-sm">
          Recommendation horizon (days)
          <input
            type="number"
            name="horizonDays"
            min={1}
            max={60}
            defaultValue={shopping.horizonDays}
            className="mt-1 min-h-11 w-full rounded-md border border-border bg-background px-3"
          />
        </label>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold uppercase tracking-wide text-text-muted">
          Forgotten Favorites
        </legend>
        <Toggle name="rediscoveryEnabled" label="Enable rediscovery" defaultChecked={rediscovery.enabled} />
        <label className="block text-sm">
          Cadence
          <select
            name="rediscoveryCadence"
            defaultValue={rediscovery.cadence}
            className="mt-1 min-h-11 w-full rounded-md border border-border bg-background px-3"
          >
            <option value="off">Off</option>
            <option value="weekly">Once per week</option>
            <option value="every_other_trip">Every other shopping trip</option>
            <option value="monthly">Once per month</option>
            <option value="smart">Smart occasional suggestions</option>
          </select>
        </label>
        <label className="block text-sm">
          Minimum days since preparation
          <input
            type="number"
            name="minDays"
            min={7}
            max={365}
            defaultValue={rediscovery.minDays}
            className="mt-1 min-h-11 w-full rounded-md border border-border bg-background px-3"
          />
        </label>
        <label className="block text-sm">
          Max suggestions per trip
          <input
            type="number"
            name="maxSuggestions"
            min={0}
            max={5}
            defaultValue={rediscovery.maxSuggestions}
            className="mt-1 min-h-11 w-full rounded-md border border-border bg-background px-3"
          />
        </label>
        <Toggle name="allowPush" label="Allow push reminders" defaultChecked={rediscovery.allowPush} />
        <Toggle name="includeGuestFriendly" label="Include guest-friendly favorites" defaultChecked={rediscovery.includeGuestFriendly} />
        <Toggle name="includeMealPrep" label="Include meal-prep favorites" defaultChecked={rediscovery.includeMealPrep} />
      </fieldset>

      <p className="text-xs text-text-muted">
        Forecasted supplies, staples, and forgotten-favorite ingredients stay review-first.
        Accepted-meal ingredient policy remains under Meal settings.
      </p>

      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save settings"}
      </button>
      {state && !state.ok ? (
        <p className="text-xs text-danger" role="alert">
          {state.error}
        </p>
      ) : state?.ok ? (
        <p className="text-xs text-text-secondary">Settings saved.</p>
      ) : null}
    </form>
  );
}

function Toggle({
  name,
  label,
  defaultChecked,
}: {
  name: string;
  label: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="flex min-h-11 items-center gap-2 text-sm">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="size-4"
      />
      {label}
    </label>
  );
}
