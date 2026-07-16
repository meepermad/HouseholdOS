import { describe, expect, it } from "vitest";
import {
  canTransitionChoreDefinition,
  canTransitionChoreOccurrence,
  canTransitionResponsibilityArea,
  canTransitionResponsibilityTransfer,
} from "@/lib/chores/lifecycle";

describe("chore lifecycle transitions", () => {
  it("allows definition pause and resume", () => {
    expect(canTransitionChoreDefinition("active", "paused")).toBe(true);
    expect(canTransitionChoreDefinition("paused", "active")).toBe(true);
    expect(canTransitionChoreDefinition("ended", "active")).toBe(false);
  });

  it("supports completion with and without verification", () => {
    expect(canTransitionChoreOccurrence("scheduled", "completed")).toBe(true);
    expect(
      canTransitionChoreOccurrence("scheduled", "awaiting_verification"),
    ).toBe(true);
    expect(
      canTransitionChoreOccurrence("awaiting_verification", "verified"),
    ).toBe(true);
  });

  it("allows reopen from completed or verified", () => {
    expect(canTransitionChoreOccurrence("completed", "reopened")).toBe(true);
    expect(canTransitionChoreOccurrence("verified", "reopened")).toBe(true);
    expect(canTransitionChoreOccurrence("skipped", "reopened")).toBe(false);
  });

  it("supports blocked and skip paths", () => {
    expect(canTransitionChoreOccurrence("in_progress", "blocked")).toBe(true);
    expect(canTransitionChoreOccurrence("blocked", "scheduled")).toBe(true);
    expect(canTransitionChoreOccurrence("scheduled", "skipped")).toBe(true);
  });

  it("validates responsibility area and transfer transitions", () => {
    expect(canTransitionResponsibilityArea("active", "handoff_pending")).toBe(
      true,
    );
    expect(canTransitionResponsibilityTransfer("pending", "accepted")).toBe(
      true,
    );
    expect(canTransitionResponsibilityTransfer("accepted", "declined")).toBe(
      false,
    );
  });
});
