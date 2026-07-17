import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { GovernanceStatusBadge } from "@/components/governance/GovernanceStatusBadge";
import { GovernanceVersionCompareView } from "@/components/governance/GovernanceVersionCompareView";
import { GovernanceAcknowledgmentPrompt } from "@/components/governance/GovernanceAcknowledgmentPrompt";

describe("governance components", () => {
  it("renders status badges with plain language", () => {
    render(<GovernanceStatusBadge status="under_review" />);
    expect(screen.getByText("Under review")).toBeTruthy();
  });

  it("renders version comparison material changes", () => {
    render(
      <GovernanceVersionCompareView
        comparison={{
          titleChanged: true,
          summaryChanged: false,
          approvalRulesChanged: false,
          acknowledgmentRulesChanged: false,
          effectiveDatesChanged: false,
          materialChange: true,
          sections: [
            {
              kind: "added",
              position: 0,
              sectionType: "rule",
              heading: "Quiet hours",
            },
          ],
        }}
      />,
    );
    expect(screen.getByText(/Title changed/)).toBeTruthy();
    expect(screen.getByText(/Quiet hours/)).toBeTruthy();
  });

  it("states that viewing is not acknowledgment", () => {
    render(
      <GovernanceAcknowledgmentPrompt
        householdId="11111111-1111-1111-1111-111111111111"
        versionId="22222222-2222-2222-2222-222222222222"
        documentTitle="Quiet hours"
      />,
    );
    expect(
      screen.getByText(/Opening or viewing this page is not acknowledgment/i),
    ).toBeTruthy();
    expect(screen.getByText(/I acknowledge receipt/i)).toBeTruthy();
  });
});
