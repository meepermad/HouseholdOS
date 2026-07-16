import { AppBackButton } from "@/components/app-back-button";
import { ResponsibilityList } from "@/components/chores/ResponsibilityList";
import { ActionForm } from "@/components/action-form";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { createResponsibilityAreaAction } from "@/app/actions/responsibilities";
import { assertActiveMembership } from "@/lib/household-context";
import { listResponsibilityAreas } from "@/lib/chores/queries";
import { CHORE_CATEGORIES, CHORE_CATEGORY_LABELS } from "@/lib/chores/categories";
export const dynamic = "force-dynamic";
export default async function ResponsibilitiesPage({ params }: { params: Promise<{ householdId: string }> }) {
  const { householdId } = await params; await assertActiveMembership(householdId);
  const areas = await listResponsibilityAreas(householdId);
  return <main className="space-y-5"><AppBackButton fallbackHref={`/app/${householdId}/chores`} /><h1 className="font-[family-name:var(--font-display)] text-3xl">Responsibilities</h1><ResponsibilityList householdId={householdId} areas={areas} /><details className="rounded-md border border-border bg-surface p-4"><summary className="min-h-11 cursor-pointer font-semibold">Create responsibility area</summary><ActionForm action={createResponsibilityAreaAction} className="mt-4 space-y-3"><input type="hidden" name="householdId" value={householdId} /><Field label="Name"><Input name="name" required /></Field><Field label="Category"><Select name="category">{CHORE_CATEGORIES.map((c) => <option key={c} value={c}>{CHORE_CATEGORY_LABELS[c]}</option>)}</Select></Field><Field label="Start date"><Input name="startDate" type="date" required defaultValue={new Date().toISOString().slice(0,10)} /></Field><Field label="Description"><Textarea name="description" rows={2} /></Field><Field label="Handoff expectations"><Textarea name="handoffExpectations" rows={2} /></Field><SubmitButton>Create area</SubmitButton></ActionForm></details></main>;
}
