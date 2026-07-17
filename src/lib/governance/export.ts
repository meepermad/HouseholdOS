import { LEGAL_COORDINATION_NOTICE, type GovernanceSectionInput } from "./types";
import { sectionsToPlainText } from "./compare";

export type ExportDocument = {
  id: string;
  householdId: string;
  title: string;
  summary: string | null;
  status: string;
  documentClass: string;
  versionNumber: number;
  contentHash: string;
  effectiveAt: string | null;
  sections: GovernanceSectionInput[];
  events?: Array<{ type: string; at: string; body?: string | null }>;
};

export function exportGovernanceJson(doc: ExportDocument): string {
  return JSON.stringify(
    {
      format: "householdos.governance.v1",
      notice: LEGAL_COORDINATION_NOTICE,
      exportedAt: new Date().toISOString(),
      document: doc,
    },
    null,
    2,
  );
}

export function exportGovernancePrintableHtml(doc: ExportDocument): string {
  const sections = doc.sections
    .map((s) => {
      const heading = s.heading
        ? `<h2>${escapeHtml(s.heading)}</h2>`
        : "";
      const body = s.body ? `<p>${escapeHtml(s.body).replace(/\n/g, "<br/>")}</p>` : "";
      return `<section>${heading}${body}</section>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>${escapeHtml(doc.title)}</title>
<style>
  body { font-family: Georgia, "Times New Roman", serif; max-width: 44rem; margin: 2rem auto; color: #1a1a1a; line-height: 1.5; }
  h1 { font-size: 1.75rem; }
  .meta { color: #555; font-size: 0.9rem; margin-bottom: 1.5rem; }
  .notice { border-left: 3px solid #888; padding-left: 0.75rem; color: #444; margin: 1.5rem 0; }
  section { margin: 1.25rem 0; }
  @media print { body { margin: 0; } }
</style>
</head>
<body>
  <h1>${escapeHtml(doc.title)}</h1>
  <div class="meta">Version ${doc.versionNumber} · ${escapeHtml(doc.status)} · ${escapeHtml(doc.documentClass)}</div>
  ${doc.summary ? `<p>${escapeHtml(doc.summary)}</p>` : ""}
  <p class="notice">${escapeHtml(LEGAL_COORDINATION_NOTICE)}</p>
  ${sections}
  <pre style="white-space:pre-wrap;font-size:0.85rem;color:#666;margin-top:2rem;">${escapeHtml(sectionsToPlainText(doc.sections))}</pre>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
