import { describe, expect, it } from "vitest";
import {
  countCompleted,
  isSetupReminderVisible,
  nextIncompleteStep,
  progressPercent,
  parseStepsJson,
} from "@/lib/setup/steps";
import {
  PANTRY_TEMPLATES,
  RESPONSIBILITY_TEMPLATES,
  SUPPLY_TEMPLATES,
} from "@/lib/setup/templates";

describe("onboarding progress", () => {
  it("tracks completed steps and reminder visibility", () => {
    const steps = parseStepsJson({
      basics: { status: "completed" },
      invites: { status: "skipped" },
    });
    expect(countCompleted(steps)).toBe(1);
    expect(progressPercent(steps)).toBeGreaterThan(0);
    expect(nextIncompleteStep(steps)).toBe("responsibilities");
    expect(
      isSetupReminderVisible({
        steps,
        dismissedAt: null,
        completedAt: null,
        currentStep: "responsibilities",
      }),
    ).toBe(true);
    expect(
      isSetupReminderVisible({
        steps,
        dismissedAt: "2026-01-01",
        completedAt: null,
        currentStep: null,
      }),
    ).toBe(false);
  });

  it("exposes starter templates", () => {
    expect(RESPONSIBILITY_TEMPLATES.length).toBeGreaterThanOrEqual(8);
    expect(SUPPLY_TEMPLATES.some((t) => t.name === "Toilet paper")).toBe(true);
    expect(PANTRY_TEMPLATES.some((t) => t.name === "Rice")).toBe(true);
  });
});
