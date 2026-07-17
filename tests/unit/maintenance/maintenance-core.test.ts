import { describe, expect, it } from "vitest";
import {
  EMERGENCY_DISCLAIMER,
  assertMaintenanceTransition,
  canTransitionMaintenanceStatus,
  detectDuplicateMaintenanceIssues,
  isOpenMaintenanceStatus,
  redactEvidencePathForNotification,
  safetyGuidanceForHazard,
  shouldCancelObsoleteReminders,
  shouldForceEmergencyGuidanceSeverity,
  validateMaintenanceEvidence,
} from "@/lib/maintenance";

describe("maintenance lifecycle", () => {
  it("allows reported → triaged", () => {
    expect(canTransitionMaintenanceStatus("reported", "triaged")).toBe(true);
  });
  it("rejects resolved → in_progress", () => {
    expect(canTransitionMaintenanceStatus("resolved", "in_progress")).toBe(
      false,
    );
  });
  it("allows resolved → reopened", () => {
    expect(canTransitionMaintenanceStatus("resolved", "reopened")).toBe(true);
  });
  it("allows closed → reopened", () => {
    expect(canTransitionMaintenanceStatus("closed", "reopened")).toBe(true);
  });
  it("rejects cancelled → assigned", () => {
    expect(canTransitionMaintenanceStatus("cancelled", "assigned")).toBe(false);
  });
  it("assert throws on invalid transition", () => {
    expect(() =>
      assertMaintenanceTransition("cancelled", "reported"),
    ).toThrow(/Invalid maintenance transition/);
  });
  it("open status helper", () => {
    expect(isOpenMaintenanceStatus("assigned")).toBe(true);
    expect(isOpenMaintenanceStatus("closed")).toBe(false);
  });
  it("cancels reminders on resolve/cancel", () => {
    expect(shouldCancelObsoleteReminders("resolved")).toBe(true);
    expect(shouldCancelObsoleteReminders("cancelled")).toBe(true);
    expect(shouldCancelObsoleteReminders("in_progress")).toBe(false);
  });
});

describe("safety triage", () => {
  it("gas odor recommends emergency services without claiming contact", () => {
    const g = safetyGuidanceForHazard("gas_odor");
    expect(g.recommendEmergencyServices).toBe(true);
    expect(g.didContactEmergencyServices).toBe(false);
    expect(g.guidance.join(" ")).toMatch(/emergency/i);
  });
  it("water leak does not claim emergency contact", () => {
    const g = safetyGuidanceForHazard("water_actively_leaking");
    expect(g.didContactEmergencyServices).toBe(false);
  });
  it("forces emergency guidance severity for CO", () => {
    expect(
      shouldForceEmergencyGuidanceSeverity(
        ["carbon_monoxide_alarm"],
        "normal",
      ),
    ).toBe(true);
  });
  it("exposes disclaimer", () => {
    expect(EMERGENCY_DISCLAIMER).toMatch(/does not contact emergency/i);
  });
});

describe("duplicate detection", () => {
  const base = {
    id: "1",
    title: "Kitchen sink leak",
    category: "plumbing" as const,
    status: "assigned" as const,
    locationId: "loc1",
    inventoryItemId: null,
    createdAt: "2026-07-10T00:00:00Z",
  };

  it("detects possible open duplicate", () => {
    const r = detectDuplicateMaintenanceIssues(
      {
        title: "Sink is leaking in kitchen",
        category: "plumbing",
        locationId: "loc1",
        inventoryItemId: null,
        now: new Date("2026-07-17T00:00:00Z"),
      },
      [base],
    );
    expect(r.outcome).toBe("possible_open_duplicate");
  });

  it("detects possible recurring after resolve", () => {
    const r = detectDuplicateMaintenanceIssues(
      {
        title: "Kitchen sink leak",
        category: "plumbing",
        locationId: "loc1",
        inventoryItemId: null,
        now: new Date("2026-07-17T00:00:00Z"),
      },
      [
        {
          ...base,
          status: "resolved",
          resolvedAt: "2026-07-01T00:00:00Z",
        },
      ],
    );
    expect(r.outcome).toBe("possible_recurring");
  });

  it("returns none when unrelated", () => {
    const r = detectDuplicateMaintenanceIssues(
      {
        title: "WiFi router offline",
        category: "internet_technology",
        locationId: "loc2",
        inventoryItemId: null,
      },
      [base],
    );
    expect(r.outcome).toBe("none");
  });
});

describe("evidence validation", () => {
  it("accepts jpeg", () => {
    const r = validateMaintenanceEvidence({
      mimeType: "image/jpeg",
      fileName: "leak.jpg",
      sizeBytes: 1024,
      existingCount: 0,
    });
    expect(r.ok).toBe(true);
  });
  it("accepts pdf", () => {
    const r = validateMaintenanceEvidence({
      mimeType: "application/pdf",
      fileName: "invoice.pdf",
      sizeBytes: 2048,
      existingCount: 1,
    });
    expect(r.ok).toBe(true);
  });
  it("rejects exe", () => {
    const r = validateMaintenanceEvidence({
      mimeType: "image/png",
      fileName: "payload.exe",
      sizeBytes: 100,
      existingCount: 0,
    });
    expect(r.ok).toBe(false);
  });
  it("rejects oversize", () => {
    const r = validateMaintenanceEvidence({
      mimeType: "image/png",
      fileName: "big.png",
      sizeBytes: 20 * 1024 * 1024,
      existingCount: 0,
    });
    expect(r.ok).toBe(false);
  });
  it("rejects count overflow", () => {
    const r = validateMaintenanceEvidence({
      mimeType: "image/png",
      fileName: "x.png",
      sizeBytes: 100,
      existingCount: 12,
    });
    expect(r.ok).toBe(false);
  });
  it("rejects mime/extension mismatch", () => {
    const r = validateMaintenanceEvidence({
      mimeType: "image/jpeg",
      fileName: "x.png",
      sizeBytes: 100,
      existingCount: 0,
    });
    expect(r.ok).toBe(false);
  });
  it("redacts storage paths from notifications", () => {
    expect(redactEvidencePathForNotification("hh/req/file.jpg")).toBeNull();
  });
});
