import { describe, expect, it } from "vitest";
import {
  buildScheduleIdempotencyKey,
  isScheduleCancelled,
} from "@/lib/notifications/scheduled";

describe("scheduled notifications", () => {
  it("builds a stable idempotency key from source + recipient + event + time", () => {
    const at = new Date("2026-07-15T08:00:00.000Z");
    const key = buildScheduleIdempotencyKey(
      "chore",
      "chore-1",
      "user-1",
      "chore.due_soon",
      at,
    );
    expect(key).toBe(
      "chore:chore-1:user-1:chore.due_soon:2026-07-15T08:00:00.000Z",
    );
    expect(
      buildScheduleIdempotencyKey(
        "chore",
        "chore-1",
        "user-1",
        "chore.due_soon",
        "2026-07-15T08:00:00.000Z",
      ),
    ).toBe(key);
  });

  it("treats cancelled-unprocessed rows as non-emitting", () => {
    expect(
      isScheduleCancelled({
        processed_at: null,
        cancelled_at: "2026-07-15T09:00:00Z",
      }),
    ).toBe(true);

    expect(
      isScheduleCancelled({
        processed_at: null,
        cancelled_at: null,
      }),
    ).toBe(false);

    expect(
      isScheduleCancelled({
        processed_at: "2026-07-15T08:05:00Z",
        cancelled_at: "2026-07-15T09:00:00Z",
      }),
    ).toBe(false);
  });
});
