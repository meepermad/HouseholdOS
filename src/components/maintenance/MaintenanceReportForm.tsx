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
import { humanizeEnum } from "@/lib/presentation";

type Step = 1 | 2 | 3;
type DangerAnswer = "yes" | "no" | "unsure" | null;

export function MaintenanceReportForm({
  householdId,
}: {
  householdId: string;
}) {
  const [step, setStep] = useState<Step>(1);
  const [danger, setDanger] = useState<DangerAnswer>(null);
  const [hazards, setHazards] = useState<SafetyHazardFlag[]>([]);
  const guidance = safetyGuidanceForHazards(hazards);
  const showChecklist = danger === "yes" || danger === "unsure";

  function toggleHazard(flag: SafetyHazardFlag) {
    setHazards((prev) =>
      prev.includes(flag) ? prev.filter((h) => h !== flag) : [...prev, flag],
    );
  }

  return (
    <div className="space-y-4" data-testid="maintenance-report-form">
      <p className="text-sm text-text-muted" aria-live="polite">
        Step {step} of 3
      </p>

      {(guidance.length > 0 || danger === "yes" || danger === "unsure") && step >= 2 ? (
        <aside
          role="alert"
          className="space-y-3 rounded-md border-2 border-border bg-surface p-4"
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
        pendingLabel="Reporting issue…"
        className="space-y-4"
      >
        <input type="hidden" name="householdId" value={householdId} />

        <div className={step === 1 ? "space-y-4" : "hidden"}>
          <h2 className="text-sm font-semibold">What happened?</h2>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Title</span>
            <input
              name="title"
              required
              className="min-h-11 w-full rounded-md border border-border bg-surface px-3"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Description</span>
            <textarea
              name="description"
              rows={4}
              className="w-full rounded-md border border-border bg-surface px-3 py-2"
            />
          </label>
          <label className="block space-y-1.5">
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
          <p className="text-xs text-text-muted">
            You can add photos on the request page after submitting.
          </p>
          <button
            type="button"
            className="min-h-11 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
            onClick={() => setStep(2)}
          >
            Continue
          </button>
        </div>

        <div className={step === 2 ? "space-y-4" : "hidden"}>
          <h2 className="text-sm font-semibold">Safety check</h2>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">
              Could this issue be immediately dangerous?
            </legend>
            {(
              [
                ["yes", "Yes"],
                ["no", "No"],
                ["unsure", "Unsure"],
              ] as const
            ).map(([value, label]) => (
              <label
                key={value}
                className="flex min-h-11 items-center gap-2 text-sm"
              >
                <input
                  type="radio"
                  name="dangerAnswer"
                  value={value}
                  checked={danger === value}
                  onChange={() => setDanger(value)}
                />
                {label}
              </label>
            ))}
          </fieldset>

          {showChecklist ? (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Safety conditions</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {SAFETY_HAZARD_FLAGS.map((flag) => (
                  <label
                    key={flag}
                    className="flex min-h-11 items-center gap-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      name="hazardFlags"
                      value={flag}
                      checked={hazards.includes(flag)}
                      onChange={() => toggleHazard(flag)}
                      className="size-4"
                    />
                    {humanizeEnum(flag)}
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="min-h-11 rounded-md border border-border px-4 text-sm"
              onClick={() => setStep(1)}
            >
              Back
            </button>
            <button
              type="button"
              className="min-h-11 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              disabled={!danger}
              onClick={() => setStep(3)}
            >
              Continue
            </button>
          </div>
        </div>

        <div className={step === 3 ? "space-y-4" : "hidden"}>
          <h2 className="text-sm font-semibold">Follow-up</h2>
          <label className="block space-y-1.5">
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
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">
              Immediate mitigation attempted
            </span>
            <textarea
              name="immediateMitigation"
              rows={2}
              className="w-full rounded-md border border-border bg-surface px-3 py-2"
            />
          </label>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" name="stopUse" value="true" className="size-4" />
            Stop using the affected item or area
          </label>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="landlordInvolvement"
              value="true"
              className="size-4"
            />
            Landlord involvement expected
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="min-h-11 rounded-md border border-border px-4 text-sm"
              onClick={() => setStep(2)}
            >
              Back
            </button>
            <button
              type="submit"
              className="min-h-11 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
            >
              Submit report
            </button>
          </div>
        </div>
      </ActionForm>
    </div>
  );
}
