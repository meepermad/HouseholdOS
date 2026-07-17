"use client";

import { useState } from "react";
import { ActionForm } from "@/components/action-form";
import { createMaintenanceRequestAction } from "@/app/actions/maintenance";
import {
  EMERGENCY_DISCLAIMER,
  MAINTENANCE_CATEGORIES,
  MAINTENANCE_SEVERITIES,
  SAFETY_HAZARD_FLAGS,
  maintenanceCategoryLabel,
  maintenanceSeverityLabel,
  safetyGuidanceForHazards,
  type SafetyHazardFlag,
} from "@/lib/maintenance";

export function MaintenanceReportForm({
  householdId,
}: {
  householdId: string;
}) {
  const [hazards, setHazards] = useState<SafetyHazardFlag[]>([]);
  const guidance = safetyGuidanceForHazards(hazards);

  function toggleHazard(flag: SafetyHazardFlag) {
    setHazards((prev) =>
      prev.includes(flag) ? prev.filter((h) => h !== flag) : [...prev, flag],
    );
  }

  return (
    <div className="space-y-4">
      {guidance.length > 0 ? (
        <aside
          role="alert"
          className="rounded-md border-2 border-border bg-surface p-4 space-y-3"
        >
          <p className="text-sm font-semibold">{EMERGENCY_DISCLAIMER}</p>
          {guidance.map((g) => (
            <div key={g.hazard} className="space-y-1">
              <h3 className="font-medium">{g.title}</h3>
              <ul className="list-disc pl-5 text-sm text-text-secondary">
                {g.guidance.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          ))}
        </aside>
      ) : null}

      <ActionForm
        action={createMaintenanceRequestAction}
        pendingLabel="Submitting…"
        className="space-y-4"
      >
        <input type="hidden" name="householdId" value={householdId} />
        <label className="block space-y-1">
          <span className="text-sm font-medium">Title</span>
          <input
            name="title"
            required
            className="min-h-11 w-full rounded-md border border-border bg-surface px-3"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">Description</span>
          <textarea
            name="description"
            rows={4}
            className="w-full rounded-md border border-border bg-surface px-3 py-2"
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1">
            <span className="text-sm font-medium">Category</span>
            <select
              name="category"
              defaultValue="other"
              className="min-h-11 w-full rounded-md border border-border bg-surface px-3"
            >
              {MAINTENANCE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {maintenanceCategoryLabel(c)}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium">Severity</span>
            <select
              name="severity"
              defaultValue="normal"
              className="min-h-11 w-full rounded-md border border-border bg-surface px-3"
            >
              {MAINTENANCE_SEVERITIES.map((s) => (
                <option key={s} value={s}>
                  {maintenanceSeverityLabel(s)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Safety conditions</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {SAFETY_HAZARD_FLAGS.map((flag) => (
              <label key={flag} className="flex min-h-11 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="hazardFlags"
                  value={flag}
                  checked={hazards.includes(flag)}
                  onChange={() => toggleHazard(flag)}
                  className="size-4"
                />
                {flag.replaceAll("_", " ")}
              </label>
            ))}
          </div>
        </fieldset>

        <label className="block space-y-1">
          <span className="text-sm font-medium">Immediate mitigation attempted</span>
          <textarea
            name="immediateMitigation"
            rows={2}
            className="w-full rounded-md border border-border bg-surface px-3 py-2"
          />
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" name="stopUse" value="true" className="size-4" />
          Stop using the affected item/area
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="landlordInvolvement"
            value="true"
            className="size-4"
          />
          Landlord / property manager involvement expected
        </label>
        <button
          type="submit"
          className="min-h-11 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground"
        >
          Submit report
        </button>
      </ActionForm>
    </div>
  );
}
