"use client";

import { useMemo, useState, useTransition } from "react";
import {
  completeSetupAction,
  updateSetupStepAction,
  applyResponsibilityTemplatesAction,
  applySupplyTemplatesAction,
} from "@/app/actions/setup";
import {
  SETUP_STEPS,
  nextIncompleteStep,
  progressPercent,
  type SetupProgressState,
  type SetupStepKey,
} from "@/lib/setup/steps";
import {
  PANTRY_TEMPLATES,
  RESPONSIBILITY_TEMPLATES,
  SUPPLY_TEMPLATES,
} from "@/lib/setup/templates";

type Props = {
  householdId: string;
  initial: SetupProgressState;
};

export function SetupWizard({ householdId, initial }: Props) {
  const [steps, setSteps] = useState(initial.steps);
  const [current, setCurrent] = useState<SetupStepKey>(
    initial.currentStep ?? nextIncompleteStep(initial.steps),
  );
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const def = useMemo(
    () => SETUP_STEPS.find((s) => s.key === current) ?? SETUP_STEPS[0]!,
    [current],
  );
  const percent = progressPercent(steps);

  function markLocal(step: SetupStepKey, status: "skipped" | "completed") {
    setSteps((prev) => ({
      ...prev,
      [step]: { status, updatedAt: new Date().toISOString() },
    }));
  }

  function skip() {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("householdId", householdId);
      fd.set("step", current);
      fd.set("status", "skipped");
      const res = await updateSetupStepAction(null, fd);
      if (res.ok) {
        markLocal(current, "skipped");
        setCurrent(nextIncompleteStep({ ...steps, [current]: { status: "skipped" } }));
        setMessage("Step skipped. You can finish it later.");
      } else {
        setMessage(res.error ?? "Could not save.");
      }
    });
  }

  function continueLater() {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("householdId", householdId);
      fd.set("step", current);
      fd.set("status", steps[current]?.status ?? "pending");
      await updateSetupStepAction(null, fd);
      setMessage("Progress saved. Return anytime from Settings.");
    });
  }

  function completeStep() {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("householdId", householdId);
      fd.set("step", current);
      fd.set("status", "completed");
      const res = await updateSetupStepAction(null, fd);
      if (res.ok) {
        markLocal(current, "completed");
        if (current === "review") {
          const done = new FormData();
          done.set("householdId", householdId);
          await completeSetupAction(null, done);
          setMessage("Setup complete.");
        } else {
          setCurrent(
            nextIncompleteStep({ ...steps, [current]: { status: "completed" } }),
          );
          setMessage("Saved.");
        }
      } else {
        setMessage(res.error ?? "Could not save.");
      }
    });
  }

  function applyResponsibilities(form: HTMLFormElement) {
    startTransition(async () => {
      const fd = new FormData(form);
      fd.set("householdId", householdId);
      const res = await applyResponsibilityTemplatesAction(null, fd);
      setMessage(res.ok ? res.message ?? "Done." : res.error ?? "Failed.");
      if (res.ok) {
        markLocal("responsibilities", "completed");
        setCurrent("utilities");
      }
    });
  }

  function applySupplies(form: HTMLFormElement) {
    startTransition(async () => {
      const fd = new FormData(form);
      fd.set("householdId", householdId);
      const res = await applySupplyTemplatesAction(null, fd);
      setMessage(res.ok ? res.message ?? "Done." : res.error ?? "Failed.");
      if (res.ok) {
        markLocal("pantry_supplies", "completed");
        setCurrent("property");
      }
    });
  }

  return (
    <div className="space-y-6" data-testid="setup-wizard">
      <div>
        <div className="mb-1 flex items-center justify-between text-xs text-text-muted">
          <span>Progress</span>
          <span>{percent}%</span>
        </div>
        <div
          className="h-2 overflow-hidden rounded-full bg-surface-interactive"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      <section className="space-y-2">
        <h2 className="font-[family-name:var(--font-display)] text-xl text-text-primary">
          {def.title}
        </h2>
        <p className="text-sm text-text-secondary">{def.description}</p>
        <p className="text-sm text-text-muted">Why it matters: {def.whyItMatters}</p>
      </section>

      {current === "responsibilities" ? (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            applyResponsibilities(e.currentTarget);
          }}
        >
          <ul className="space-y-2">
            {RESPONSIBILITY_TEMPLATES.map((t) => (
              <li key={t.key}>
                <label className="flex min-h-11 items-start gap-3 rounded-md border border-border px-3 py-2">
                  <input type="checkbox" name="templateKey" value={t.key} defaultChecked className="mt-1" />
                  <span>
                    <span className="block text-sm font-medium">{t.name}</span>
                    <span className="block text-xs text-text-secondary">{t.description}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <button
            type="submit"
            disabled={pending}
            className="inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
          >
            Add selected
          </button>
        </form>
      ) : null}

      {current === "pantry_supplies" ? (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            applySupplies(e.currentTarget);
          }}
        >
          <p className="text-xs font-semibold uppercase text-text-muted">Supplies</p>
          <ul className="space-y-2">
            {SUPPLY_TEMPLATES.map((t) => (
              <li key={t.key}>
                <label className="flex min-h-11 items-center gap-3 rounded-md border border-border px-3">
                  <input type="checkbox" name="templateKey" value={t.key} defaultChecked />
                  <span className="text-sm">{t.name}</span>
                </label>
              </li>
            ))}
          </ul>
          <p className="text-xs font-semibold uppercase text-text-muted">Pantry</p>
          <ul className="space-y-2">
            {PANTRY_TEMPLATES.map((t) => (
              <li key={t.key}>
                <label className="flex min-h-11 items-center gap-3 rounded-md border border-border px-3">
                  <input type="checkbox" name="templateKey" value={t.key} defaultChecked />
                  <span className="text-sm">{t.name}</span>
                </label>
              </li>
            ))}
          </ul>
          <button
            type="submit"
            disabled={pending}
            className="inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
          >
            Add selected
          </button>
        </form>
      ) : null}

      {current === "notifications" ? (
        <p className="text-sm text-text-secondary">
          Open{" "}
          <a
            className="underline"
            href={`/app/${householdId}/settings/notifications`}
          >
            notification settings
          </a>{" "}
          to enable push on this device, then mark this step complete.
        </p>
      ) : null}

      {current === "guests" ? (
        <p className="text-sm text-text-secondary">
          Use{" "}
          <a className="underline" href={`/app/${householdId}/guests/new`}>
            guest notices
          </a>{" "}
          for overnight guests, parking, and quiet hours.
        </p>
      ) : null}

      {current === "invites" ? (
        <p className="text-sm text-text-secondary">
          Invite roommates from{" "}
          <a className="underline" href={`/app/${householdId}/settings/members`}>
            Members
          </a>
          . You do not need four people to finish setup.
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2 pb-[env(safe-area-inset-bottom)]">
        <button
          type="button"
          disabled={pending}
          onClick={completeStep}
          className="inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
          data-testid="setup-complete-step"
        >
          {current === "review" ? "Finish setup" : "Mark complete"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={skip}
          className="inline-flex min-h-11 items-center rounded-md border border-border px-4 text-sm"
          data-testid="setup-skip-step"
        >
          Skip
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={continueLater}
          className="inline-flex min-h-11 items-center rounded-md border border-border px-4 text-sm"
        >
          Save and continue later
        </button>
      </div>

      {message ? (
        <p className="text-sm text-text-secondary" role="status">
          {message}
        </p>
      ) : null}

      <nav aria-label="Setup steps" className="flex flex-wrap gap-1">
        {SETUP_STEPS.map((s) => {
          const status = steps[s.key]?.status;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => setCurrent(s.key)}
              className={`rounded px-2 py-1 text-xs ${
                s.key === current
                  ? "bg-primary text-primary-foreground"
                  : status === "completed"
                    ? "bg-surface-interactive text-text-primary"
                    : "text-text-muted"
              }`}
            >
              {s.title}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
