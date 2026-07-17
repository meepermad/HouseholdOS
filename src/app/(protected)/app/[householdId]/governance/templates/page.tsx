import { ActionForm } from "@/components/action-form";
import { instantiateTemplateAction } from "@/app/actions/governance";
import { listGovernanceTemplates } from "@/lib/governance/queries";
import { LEGAL_COORDINATION_NOTICE } from "@/lib/governance/types";

export default async function GovernanceTemplatesPage({
  params,
}: {
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = await params;
  const templates = await listGovernanceTemplates();
  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6">
      <h1 className="text-2xl font-semibold">Templates</h1>
      <p className="text-sm text-text-secondary">{LEGAL_COORDINATION_NOTICE}</p>
      <p className="text-sm text-text-secondary">
        Templates create editable drafts. They never become active automatically.
      </p>
      <ul className="space-y-3">
        {templates.map((tpl) => (
          <li
            key={tpl.id}
            className="flex flex-wrap items-start justify-between gap-3 rounded-md border border-border p-4"
          >
            <div>
              <p className="font-medium">{tpl.title}</p>
              {tpl.summary ? (
                <p className="mt-1 text-sm text-text-secondary">{tpl.summary}</p>
              ) : null}
            </div>
            <ActionForm action={instantiateTemplateAction}>
              <input type="hidden" name="householdId" value={householdId} />
              <input type="hidden" name="templateId" value={tpl.id} />
              <button
                type="submit"
                className="min-h-11 rounded-md bg-primary px-4 text-sm text-primary-foreground"
              >
                Use template
              </button>
            </ActionForm>
          </li>
        ))}
      </ul>
    </div>
  );
}
