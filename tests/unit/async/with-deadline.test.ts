import { describe, expect, it, vi } from "vitest";
import {
  deadlineMessage,
  withDeadline,
} from "@/lib/async/with-deadline";
import { AppError } from "@/lib/errors";

describe("withDeadline", () => {
  it("resolves when the promise settles before the deadline", async () => {
    await expect(
      withDeadline(Promise.resolve("ok"), { ms: 1_000, stage: "home" }),
    ).resolves.toBe("ok");
  });

  it("rejects with AppError when the deadline elapses", async () => {
    vi.useFakeTimers();
    const pending = withDeadline(
      new Promise<string>(() => {
        /* never settles */
      }),
      { ms: 50, stage: "home" },
    );
    const assertion = expect(pending).rejects.toMatchObject({
      name: "AppError",
      code: "database_failure",
      publicMessage: deadlineMessage("home"),
    });
    await vi.advanceTimersByTimeAsync(50);
    await assertion;
    vi.useRealTimers();
  });

  it("clears the timer when the promise wins", async () => {
    vi.useFakeTimers();
    const pending = withDeadline(
      Promise.resolve(42),
      { ms: 5_000, stage: "profile" },
    );
    await expect(pending).resolves.toBe(42);
    await vi.advanceTimersByTimeAsync(5_000);
    vi.useRealTimers();
  });

  it("uses stage-specific timeout copy", () => {
    expect(deadlineMessage("profile")).toMatch(/Profile setup timed out/i);
    expect(deadlineMessage("household_shell")).toMatch(/Household shell timed out/i);
    const err = new AppError("database_failure", deadlineMessage("app"));
    expect(err.publicMessage).toMatch(/Application timed out/i);
  });
});
