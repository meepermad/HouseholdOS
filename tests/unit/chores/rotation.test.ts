import { describe, expect, it } from "vitest";
import {
  assignForOccurrence,
  filterEligibleMembers,
  previewRotationAssignments,
} from "@/lib/chores/rotation";

const members = ["member-a", "member-b", "member-c"] as const;

function assignments(
  strategy: "fixed" | "round_robin" | "balanced" | "manual_sequence",
  extra: Partial<Parameters<typeof previewRotationAssignments>[0]> = {},
) {
  return previewRotationAssignments({
    strategy,
    orderedEligibleMemberIds: members,
    occurrences: [0, 1, 2, 3].map((occurrenceIndex) => ({
      occurrenceIndex,
    })),
    ...extra,
  }).map((assignment) => assignment.membershipId);
}

describe("chore rotation", () => {
  it("keeps fixed rotation on the first eligible or designated member", () => {
    expect(assignments("fixed")).toEqual([
      "member-a",
      "member-a",
      "member-a",
      "member-a",
    ]);
    expect(assignments("fixed", { startMembershipId: "member-c" })).toEqual([
      "member-c",
      "member-c",
      "member-c",
      "member-c",
    ]);
  });

  it("cycles round-robin assignments in stable order", () => {
    expect(assignments("round_robin")).toEqual([
      "member-a",
      "member-b",
      "member-c",
      "member-a",
    ]);
    expect(
      assignments("round_robin", { startMembershipId: "member-b" }),
    ).toEqual(["member-b", "member-c", "member-a", "member-b"]);
  });

  it("cycles an explicit manual sequence", () => {
    expect(
      assignments("manual_sequence", {
        orderedEligibleMemberIds: ["member-c", "member-a", "member-b"],
      }),
    ).toEqual(["member-c", "member-a", "member-b", "member-c"]);
  });

  it("balances workload and breaks ties by stable member order", () => {
    expect(
      assignments("balanced", {
        recentAssignmentCounts: {
          "member-a": 3,
          "member-b": 1,
          "member-c": 1,
        },
      }),
    ).toEqual(["member-b", "member-c", "member-b", "member-c"]);
  });

  it("applies temporary exclusions only through their end time", () => {
    const exclusion = {
      membershipId: "member-b",
      until: "2026-07-20T00:00:00.000Z",
    };
    expect(
      filterEligibleMembers(members, {
        exclusions: [exclusion],
        at: "2026-07-19T00:00:00.000Z",
      }),
    ).toEqual(["member-a", "member-c"]);
    expect(
      filterEligibleMembers(members, {
        exclusions: [exclusion],
        at: "2026-07-21T00:00:00.000Z",
      }),
    ).toEqual(members);
  });

  it("removes former members and duplicate IDs while preserving order", () => {
    expect(
      filterEligibleMembers(
        ["member-b", "member-a", "member-b", "member-c"],
        { removedMemberIds: new Set(["member-a"]) },
      ),
    ).toEqual(["member-b", "member-c"]);
  });

  it("returns null future assignments while rotation is paused", () => {
    expect(assignments("round_robin", { paused: true })).toEqual([
      null,
      null,
      null,
      null,
    ]);
  });

  it("uses one-occurrence overrides without changing later sequence", () => {
    expect(
      assignments("round_robin", {
        overrides: new Map([[1, "member-c"]]),
      }),
    ).toEqual(["member-a", "member-c", "member-c", "member-a"]);
  });

  it("does not advance or reset the sequence for a skipped occurrence", () => {
    expect(
      assignments("round_robin", {
        overrides: { 1: null },
      }),
    ).toEqual(["member-a", null, "member-c", "member-a"]);
  });

  it("uses stable input order to resolve balanced ties", () => {
    const result = assignForOccurrence({
      strategy: "balanced",
      orderedEligibleMemberIds: ["member-c", "member-a", "member-b"],
      occurrenceIndex: 8,
      recentAssignmentCounts: {
        "member-a": 2,
        "member-b": 2,
        "member-c": 2,
      },
    });
    expect(result.membershipId).toBe("member-c");
  });

  it("preserves completed history after household membership changes", () => {
    const result = previewRotationAssignments({
      strategy: "round_robin",
      orderedEligibleMemberIds: ["member-a", "member-c"],
      removedMemberIds: ["member-b"],
      completedAssignments: new Map([
        [0, "member-a"],
        [1, "member-b"],
      ]),
      occurrences: [
        { occurrenceIndex: 0 },
        { occurrenceIndex: 1 },
        { occurrenceIndex: 2 },
      ],
    });
    expect(result.map((entry) => entry.membershipId)).toEqual([
      "member-a",
      "member-b",
      "member-a",
    ]);
  });

  it("preserves completed assignments even while paused", () => {
    const result = assignForOccurrence({
      strategy: "fixed",
      orderedEligibleMemberIds: members,
      occurrenceIndex: 4,
      paused: true,
      completedAssignments: { 4: "member-b" },
    });
    expect(result.membershipId).toBe("member-b");
  });

  it("rejects invalid occurrence indices", () => {
    expect(() =>
      assignForOccurrence({
        strategy: "fixed",
        orderedEligibleMemberIds: members,
        occurrenceIndex: -1,
      }),
    ).toThrow(RangeError);
  });
});
