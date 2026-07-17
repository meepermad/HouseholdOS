"use client";

import { useState, useTransition } from "react";
import { ActionForm } from "@/components/action-form";
import { saveGovernanceDraftAction } from "@/app/actions/governance";
import {
  GOVERNANCE_SECTION_TYPES,
  GOVERNANCE_VISIBILITIES,
  type GovernanceSectionInput,
  type GovernanceSectionType,
  type GovernanceVisibility,
} from "@/lib/governance/types";

type Props = {
  householdId: string;
  documentId: string;
  initialTitle: string;
  initialSummary: string | null;
  initialVisibility: GovernanceVisibility;
  initialSections: GovernanceSectionInput[];
};

export function GovernanceDocumentEditor({
  householdId,
  documentId,
  initialTitle,
  initialSummary,
  initialVisibility,
  initialSections,
}: Props) {
  const [title, setTitle] = useState(initialTitle);
  const [summary, setSummary] = useState(initialSummary ?? "");
  const [visibility, setVisibility] = useState(initialVisibility);
  const [sections, setSections] = useState<GovernanceSectionInput[]>(
    initialSections.length
      ? initialSections
      : [{ section_type: "freeform", heading: "", body: "" }],
  );
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function updateSection(index: number, patch: Partial<GovernanceSectionInput>) {
    setSections((prev) =>
      prev.map((s, i) => (i === index ? { ...s, ...patch } : s)),
    );
  }

  function moveSection(index: number, dir: -1 | 1) {
    setSections((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      const tmp = next[index]!;
      next[index] = next[target]!;
      next[target] = tmp;
      return next;
    });
  }

  function autosave() {
    const fd = new FormData();
    fd.set("householdId", householdId);
    fd.set("documentId", documentId);
    fd.set("title", title);
    fd.set("summary", summary);
    fd.set("visibility", visibility);
    fd.set("sectionsJson", JSON.stringify(sections));
    startTransition(async () => {
      const result = await saveGovernanceDraftAction(null, fd);
      if (result?.ok) setSavedAt(new Date().toLocaleTimeString());
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-text-secondary">
          {pending
            ? "Saving draft…"
            : savedAt
              ? `Draft saved at ${savedAt}`
              : "Autosave drafts only — proposing or activating is a separate action."}
        </p>
        <button
          type="button"
          onClick={autosave}
          className="min-h-11 rounded-md border border-border px-4 text-sm"
        >
          Save draft
        </button>
      </div>

      <label className="block space-y-1">
        <span className="text-sm font-medium">Title</span>
        <input
          className="min-h-11 w-full rounded-md border border-border bg-surface px-3"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={autosave}
        />
      </label>

      <label className="block space-y-1">
        <span className="text-sm font-medium">Summary</span>
        <textarea
          className="min-h-24 w-full rounded-md border border-border bg-surface px-3 py-2"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          onBlur={autosave}
        />
      </label>

      <label className="block space-y-1">
        <span className="text-sm font-medium">Draft visibility</span>
        <select
          className="min-h-11 w-full rounded-md border border-border bg-surface px-3"
          value={visibility}
          onChange={(e) => {
            setVisibility(e.target.value as GovernanceVisibility);
            queueMicrotask(autosave);
          }}
        >
          {GOVERNANCE_VISIBILITIES.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </label>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Sections</h2>
          <button
            type="button"
            className="min-h-11 rounded-md border border-border px-3 text-sm"
            onClick={() =>
              setSections((prev) => [
                ...prev,
                { section_type: "rule", heading: "", body: "" },
              ])
            }
          >
            Add section
          </button>
        </div>
        {sections.map((section, index) => (
          <div
            key={index}
            className="space-y-2 rounded-md border border-border p-3"
          >
            <div className="flex flex-wrap gap-2">
              <select
                className="min-h-11 rounded-md border border-border bg-surface px-2 text-sm"
                value={section.section_type}
                onChange={(e) =>
                  updateSection(index, {
                    section_type: e.target.value as GovernanceSectionType,
                  })
                }
              >
                {GOVERNANCE_SECTION_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="min-h-11 px-2 text-sm"
                onClick={() => moveSection(index, -1)}
              >
                Up
              </button>
              <button
                type="button"
                className="min-h-11 px-2 text-sm"
                onClick={() => moveSection(index, 1)}
              >
                Down
              </button>
              <button
                type="button"
                className="min-h-11 px-2 text-sm text-red-700"
                onClick={() =>
                  setSections((prev) => prev.filter((_, i) => i !== index))
                }
              >
                Remove
              </button>
            </div>
            <input
              className="min-h-11 w-full rounded-md border border-border bg-surface px-3"
              placeholder="Heading"
              value={section.heading ?? ""}
              onChange={(e) => updateSection(index, { heading: e.target.value })}
              onBlur={autosave}
            />
            <textarea
              className="min-h-28 w-full rounded-md border border-border bg-surface px-3 py-2"
              placeholder="Body"
              value={section.body ?? ""}
              onChange={(e) => updateSection(index, { body: e.target.value })}
              onBlur={autosave}
            />
          </div>
        ))}
      </div>

      <section className="space-y-2 rounded-md border border-dashed border-border p-4">
        <h2 className="text-lg font-semibold">Preview</h2>
        <h3 className="text-xl font-medium">{title || "Untitled"}</h3>
        {summary ? <p className="text-sm text-text-secondary">{summary}</p> : null}
        {sections.map((s, i) => (
          <div key={i} className="space-y-1">
            {s.heading ? <h4 className="font-medium">{s.heading}</h4> : null}
            {s.body ? (
              <p className="whitespace-pre-wrap text-sm">{s.body}</p>
            ) : null}
          </div>
        ))}
      </section>

      <ActionForm
        action={saveGovernanceDraftAction}
        className="hidden"
        aria-hidden
      >
        <input type="hidden" name="householdId" value={householdId} />
        <input type="hidden" name="documentId" value={documentId} />
      </ActionForm>
    </div>
  );
}
