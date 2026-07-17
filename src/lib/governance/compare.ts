import type { GovernanceSectionInput, GovernanceSectionType } from "./types";

export type VersionSnapshot = {
  title: string;
  summary: string | null;
  effectiveAt?: string | null;
  expiresAt?: string | null;
  reviewAt?: string | null;
  approvalRules: Record<string, unknown>;
  acknowledgmentRules: Record<string, unknown>;
  sections: GovernanceSectionInput[];
};

export type SectionDiff = {
  kind: "added" | "removed" | "changed" | "unchanged";
  position: number;
  sectionType: GovernanceSectionType;
  heading?: string | null;
  beforeBody?: string | null;
  afterBody?: string | null;
};

export type VersionComparison = {
  titleChanged: boolean;
  summaryChanged: boolean;
  approvalRulesChanged: boolean;
  acknowledgmentRulesChanged: boolean;
  effectiveDatesChanged: boolean;
  sections: SectionDiff[];
  materialChange: boolean;
};

function sectionKey(s: GovernanceSectionInput, index: number): string {
  return `${s.section_type}:${s.heading ?? ""}:${index}`;
}

export function compareGovernanceVersions(
  before: VersionSnapshot,
  after: VersionSnapshot,
): VersionComparison {
  const titleChanged = before.title.trim() !== after.title.trim();
  const summaryChanged = (before.summary ?? "") !== (after.summary ?? "");
  const approvalRulesChanged =
    JSON.stringify(before.approvalRules) !== JSON.stringify(after.approvalRules);
  const acknowledgmentRulesChanged =
    JSON.stringify(before.acknowledgmentRules) !==
    JSON.stringify(after.acknowledgmentRules);
  const effectiveDatesChanged =
    (before.effectiveAt ?? null) !== (after.effectiveAt ?? null) ||
    (before.expiresAt ?? null) !== (after.expiresAt ?? null) ||
    (before.reviewAt ?? null) !== (after.reviewAt ?? null);

  const max = Math.max(before.sections.length, after.sections.length);
  const sections: SectionDiff[] = [];
  for (let i = 0; i < max; i++) {
    const a = before.sections[i];
    const b = after.sections[i];
    if (!a && b) {
      sections.push({
        kind: "added",
        position: i,
        sectionType: b.section_type,
        heading: b.heading,
        afterBody: b.body,
      });
    } else if (a && !b) {
      sections.push({
        kind: "removed",
        position: i,
        sectionType: a.section_type,
        heading: a.heading,
        beforeBody: a.body,
      });
    } else if (a && b) {
      const changed =
        sectionKey(a, i) !== sectionKey(b, i) ||
        (a.body ?? "") !== (b.body ?? "") ||
        JSON.stringify(a.payload ?? {}) !== JSON.stringify(b.payload ?? {});
      sections.push({
        kind: changed ? "changed" : "unchanged",
        position: i,
        sectionType: b.section_type,
        heading: b.heading,
        beforeBody: a.body,
        afterBody: b.body,
      });
    }
  }

  const materialChange =
    titleChanged ||
    summaryChanged ||
    approvalRulesChanged ||
    acknowledgmentRulesChanged ||
    effectiveDatesChanged ||
    sections.some((s) => s.kind !== "unchanged");

  return {
    titleChanged,
    summaryChanged,
    approvalRulesChanged,
    acknowledgmentRulesChanged,
    effectiveDatesChanged,
    sections,
    materialChange,
  };
}

export function sectionsToPlainText(
  sections: readonly GovernanceSectionInput[],
): string {
  return sections
    .map((s) => {
      const parts: string[] = [];
      if (s.heading) parts.push(s.heading);
      if (s.body) parts.push(s.body);
      return parts.join("\n");
    })
    .filter(Boolean)
    .join("\n\n");
}
