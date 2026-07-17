import { describe, expect, it } from "vitest";
import {
  assertGovernanceLifecycle,
  canTransitionGovernanceStatus,
  isEditableDraftStatus,
  isImmutableVersionStatus,
} from "@/lib/governance/lifecycle";
import {
  approvalsValidForActivation,
  evaluateQuorum,
} from "@/lib/governance/quorum";
import { compareGovernanceVersions } from "@/lib/governance/compare";
import {
  acknowledgmentRequired,
  isAcknowledgmentOverdue,
  viewingIsNotAcknowledgment,
} from "@/lib/governance/acknowledgments";
import { canAdvanceTransition } from "@/lib/governance/transitions";
import { validateGovernanceAttachment } from "@/lib/governance/evidence";
import { can } from "@/lib/permissions";

describe("governance lifecycle", () => {
  it("allows draft → proposed and rejects active → draft", () => {
    expect(canTransitionGovernanceStatus("draft", "proposed")).toBe(true);
    expect(canTransitionGovernanceStatus("active", "draft")).toBe(false);
    expect(() => assertGovernanceLifecycle("active", "draft")).toThrow(
      /Invalid governance lifecycle/,
    );
  });

  it("marks approved/active as immutable and drafts as editable", () => {
    expect(isImmutableVersionStatus("approved")).toBe(true);
    expect(isImmutableVersionStatus("active")).toBe(true);
    expect(isEditableDraftStatus("draft")).toBe(true);
    expect(isEditableDraftStatus("under_review")).toBe(false);
  });
});

describe("governance quorum", () => {
  it("requires unanimous approval and does not treat abstentions as approval", () => {
    const status = evaluateQuorum({
      mode: "unanimous",
      quorum: 2,
      requiredCount: 2,
      approveCount: 1,
      rejectCount: 0,
      abstainCount: 1,
      changesCount: 0,
      pendingCount: 0,
      totalVoters: 2,
    });
    expect(status.can_advance).toBe(false);
    expect(status.reason).toMatch(/abstention/i);
  });

  it("supports simple majority with explicit quorum", () => {
    const status = evaluateQuorum({
      mode: "simple_majority",
      quorum: 2,
      requiredCount: 3,
      approveCount: 2,
      rejectCount: 0,
      abstainCount: 1,
      changesCount: 0,
      pendingCount: 0,
      totalVoters: 3,
    });
    expect(status.can_advance).toBe(true);
  });

  it("blocks on rejection and requested changes", () => {
    expect(
      evaluateQuorum({
        mode: "unanimous",
        quorum: 1,
        requiredCount: 1,
        approveCount: 0,
        rejectCount: 1,
        abstainCount: 0,
        changesCount: 0,
        pendingCount: 0,
        totalVoters: 1,
      }).can_advance,
    ).toBe(false);
    expect(
      evaluateQuorum({
        mode: "simple_majority",
        quorum: 1,
        requiredCount: 2,
        approveCount: 2,
        rejectCount: 0,
        abstainCount: 0,
        changesCount: 1,
        pendingCount: 0,
        totalVoters: 2,
      }).can_advance,
    ).toBe(false);
  });

  it("invalidates prior approvals when version hash differs", () => {
    expect(
      approvalsValidForActivation({
        responseVersionHash: "aaa",
        currentVersionHash: "bbb",
        requestVersionId: "v1",
        currentVersionId: "v1",
      }),
    ).toBe(false);
  });
});

describe("governance compare + acknowledgments", () => {
  it("detects added/removed/changed sections", () => {
    const diff = compareGovernanceVersions(
      {
        title: "A",
        summary: null,
        approvalRules: { mode: "unanimous" },
        acknowledgmentRules: { required: false },
        sections: [{ section_type: "rule", heading: "One", body: "old" }],
      },
      {
        title: "A",
        summary: null,
        approvalRules: { mode: "unanimous" },
        acknowledgmentRules: { required: false },
        sections: [
          { section_type: "rule", heading: "One", body: "new" },
          { section_type: "heading", heading: "Two", body: "" },
        ],
      },
    );
    expect(diff.materialChange).toBe(true);
    expect(diff.sections.some((s) => s.kind === "changed")).toBe(true);
    expect(diff.sections.some((s) => s.kind === "added")).toBe(true);
  });

  it("distinguishes acknowledgment from viewing", () => {
    expect(viewingIsNotAcknowledgment()).toBe(false);
    expect(acknowledgmentRequired({ required: true })).toBe(true);
    expect(
      isAcknowledgmentOverdue({
        status: "pending",
        dueAt: "2000-01-01T00:00:00.000Z",
      }),
    ).toBe(true);
  });
});

describe("transitions + attachments + permissions", () => {
  it("advances transition states safely", () => {
    expect(canAdvanceTransition("draft", "in_progress")).toBe(true);
    expect(canAdvanceTransition("completed", "in_progress")).toBe(false);
  });

  it("validates attachment scope and mime", () => {
    const hid = "11111111-1111-1111-1111-111111111111";
    expect(
      validateGovernanceAttachment({
        mimeType: "application/pdf",
        sizeBytes: 100,
        storagePath: `${hid}/doc/a.pdf`,
        householdId: hid,
      }).ok,
    ).toBe(true);
    expect(
      validateGovernanceAttachment({
        mimeType: "application/pdf",
        sizeBytes: 100,
        storagePath: `other/doc/a.pdf`,
        householdId: hid,
      }).ok,
    ).toBe(false);
  });

  it("grants governance capabilities without financial override", () => {
    expect(can(["member"], "governance.view")).toBe(true);
    expect(can(["member"], "governance.create")).toBe(true);
    expect(can(["financial_coordinator"], "governance.coordinator_override")).toBe(
      false,
    );
    expect(can(["household_coordinator"], "governance.coordinator_override")).toBe(
      true,
    );
  });
});
