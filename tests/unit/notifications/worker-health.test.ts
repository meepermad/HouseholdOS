import { describe, expect, it } from "vitest";
import {
  classifyWorkerHealth,
  type WorkerHealthInput,
} from "@/lib/notifications/worker-health";

const now = "2026-07-19T12:00:00.000Z";

function healthy(
  overrides: Partial<WorkerHealthInput> = {},
): WorkerHealthInput {
  return {
    workerConfigured: true,
    deliveryEnabled: true,
    lastSuccessfulAt: "2026-07-19T11:55:00.000Z",
    oldestDueScheduledReminderAt: null,
    horizonsNeedingExtensionCount: 0,
    lastHorizonExtensionAt: "2026-07-19T11:00:00.000Z",
    deadLetterCount: 0,
    now,
    ...overrides,
  };
}

describe("classifyWorkerHealth", () => {
  it("reports Healthy when no threshold is exceeded", () => {
    expect(classifyWorkerHealth(healthy())).toBe("Healthy");
  });

  it("reports Delayed after ten minutes without success", () => {
    expect(
      classifyWorkerHealth(
        healthy({ lastSuccessfulAt: "2026-07-19T11:49:59.000Z" }),
      ),
    ).toBe("Delayed");
    expect(classifyWorkerHealth(healthy({ lastSuccessfulAt: null }))).toBe(
      "Delayed",
    );
  });

  it("reports Worker not configured first", () => {
    expect(
      classifyWorkerHealth(
        healthy({
          workerConfigured: false,
          deliveryEnabled: false,
          deadLetterCount: 2,
        }),
      ),
    ).toBe("Worker not configured");
  });

  it("reports Delivery disabled before queue conditions", () => {
    expect(
      classifyWorkerHealth(
        healthy({
          deliveryEnabled: false,
          deadLetterCount: 2,
          horizonsNeedingExtensionCount: 3,
        }),
      ),
    ).toBe("Delivery disabled");
  });

  it("reports dead-letter rows before stale horizons and backlog", () => {
    expect(
      classifyWorkerHealth(
        healthy({
          deadLetterCount: 1,
          horizonsNeedingExtensionCount: 2,
          lastHorizonExtensionAt: null,
          oldestDueScheduledReminderAt: "2026-07-19T11:00:00.000Z",
        }),
      ),
    ).toBe("Dead-letter attention needed");
  });

  it("reports stale calendar horizons after two hours or when never extended", () => {
    expect(
      classifyWorkerHealth(
        healthy({
          horizonsNeedingExtensionCount: 1,
          lastHorizonExtensionAt: "2026-07-19T09:59:59.000Z",
        }),
      ),
    ).toBe("Calendar horizon stale");
    expect(
      classifyWorkerHealth(
        healthy({
          horizonsNeedingExtensionCount: 1,
          lastHorizonExtensionAt: null,
        }),
      ),
    ).toBe("Calendar horizon stale");
  });

  it("reports a reminder backlog after fifteen minutes overdue", () => {
    expect(
      classifyWorkerHealth(
        healthy({
          oldestDueScheduledReminderAt: "2026-07-19T11:44:59.000Z",
          lastSuccessfulAt: "2026-07-19T11:00:00.000Z",
        }),
      ),
    ).toBe("Reminder backlog");
  });
});
