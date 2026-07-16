import { notFound } from "next/navigation";
import { AppBackButton } from "@/components/app-back-button";
import { ActionForm } from "@/components/action-form";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { ConditionBadge, InventoryStatusBadge } from "@/components/house/ConditionBadge";
import { assertActiveMembership } from "@/lib/household-context";
import { can } from "@/lib/permissions";
import { getInventoryItem } from "@/lib/house/queries";
import { INVENTORY_CATEGORY_LABELS } from "@/lib/house/categories";
import { CONDITION_LABELS } from "@/lib/house/display";
import { OWNERSHIP_MODE_LABELS } from "@/lib/house/ownership";
import { formatQuantityLabel } from "@/lib/house/quantity";
import type { InventoryCondition } from "@/lib/house/types";
import { changeInventoryConditionAction, disposeInventoryItemAction } from "@/app/actions/house";

export const dynamic = "force-dynamic";

export default async function InventoryDetailPage({
  params,
}: {
  params: Promise<{ householdId: string; itemId: string }>;
}) {
  const { householdId, itemId } = await params;
  const ctx = await assertActiveMembership(householdId);
  const result = await getInventoryItem(householdId, itemId);
  if (!result) notFound();
  const { item, conditionEvents } = result;
  const canManage = can(ctx.roles, "resource.manage_own");

  return (
    <main className="space-y-5">
      <AppBackButton fallbackHref={`/app/${householdId}/house/inventory`} />
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl">{item.name}</h1>
          <p className="mt-1 text-sm text-text-secondary">
            {INVENTORY_CATEGORY_LABELS[item.category]} ·{" "}
            {formatQuantityLabel({
              amount: item.quantity,
              unit: item.quantityUnit,
              isApproximate: item.quantityIsApproximate,
            })}
            {item.locationName ? ` · ${item.locationName}` : ""}
          </p>
          <p className="mt-1 text-sm text-text-secondary">
            {OWNERSHIP_MODE_LABELS[item.ownershipMode]}
            {item.ownerLabel ? ` · ${item.ownerLabel}` : ""}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <InventoryStatusBadge status={item.status} />
          <ConditionBadge condition={item.condition} />
        </div>
      </header>
      {item.description ? <p className="text-sm text-text-secondary">{item.description}</p> : null}

      {canManage ? (
        <section className="space-y-3 rounded-md border border-border bg-surface p-4">
          <h2 className="font-semibold">Update condition</h2>
          <ActionForm action={changeInventoryConditionAction} className="space-y-3" pendingLabel="Updating condition…">
            <input type="hidden" name="householdId" value={householdId} />
            <input type="hidden" name="itemId" value={itemId} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="New condition">
                <Select name="newCondition" defaultValue={item.condition}>
                  {(Object.keys(CONDITION_LABELS) as InventoryCondition[]).map((condition) => (
                    <option key={condition} value={condition}>
                      {CONDITION_LABELS[condition]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Reason">
                <Input name="reason" maxLength={500} placeholder="What changed?" />
              </Field>
            </div>
            <SubmitButton variant="secondary">Save condition</SubmitButton>
          </ActionForm>
        </section>
      ) : null}

      <section className="space-y-2">
        <h2 className="font-semibold">Condition history</h2>
        {conditionEvents.length === 0 ? (
          <p className="text-sm text-text-secondary">No condition changes yet.</p>
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border text-sm">
            {conditionEvents.map((event) => (
              <li key={event.id} className="px-4 py-3">
                {CONDITION_LABELS[event.previousCondition]} → {CONDITION_LABELS[event.newCondition]}
                <span className="ml-2 text-text-muted">{new Date(event.createdAt).toLocaleString()}</span>
                {event.reason ? <p className="text-text-secondary">{event.reason}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {canManage && item.status !== "disposed" ? (
        <section className="space-y-3 rounded-md border border-border bg-surface p-4">
          <h2 className="font-semibold">Dispose / move out</h2>
          <ActionForm action={disposeInventoryItemAction} className="space-y-3" pendingLabel="Updating item…">
            <input type="hidden" name="householdId" value={householdId} />
            <input type="hidden" name="itemId" value={itemId} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Outcome">
                <Select name="status" defaultValue="disposed">
                  <option value="disposed">Disposed</option>
                  <option value="donated">Donated</option>
                  <option value="sold">Sold</option>
                  <option value="moved_out">Moved out</option>
                  <option value="returned">Returned</option>
                </Select>
              </Field>
              <Field label="Notes">
                <Textarea name="disposition" rows={1} maxLength={2000} />
              </Field>
            </div>
            <SubmitButton variant="secondary">Confirm</SubmitButton>
          </ActionForm>
        </section>
      ) : null}
    </main>
  );
}
