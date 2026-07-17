import { ActionForm } from "@/components/action-form";
import { createExpenseDraftAction } from "@/app/actions/expenses";
import { assertActiveMembership } from "@/lib/household-context";
import { listActiveMemberOptions } from "@/lib/expenses/queries";
import { CurrencyField } from "@/components/ui/currency-field";
import { humanizeEnum } from "@/lib/presentation";
import { DisclosureSection } from "@/components/ui/disclosure-section";

export const dynamic = "force-dynamic";

export default async function NewExpensePage({
  params,
}: {
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = await params;
  const ctx = await assertActiveMembership(householdId);
  const members = await listActiveMemberOptions(householdId);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <main className="app-form-route space-y-4">
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
        New expense
      </h1>
      <p className="text-sm text-text-secondary">
        Add a shared purchase. You can attach a receipt photo next, or enter
        details manually.
      </p>

      <ActionForm
        action={createExpenseDraftAction}
        className="space-y-4"
        pendingLabel="Saving expense…"
      >
        <input type="hidden" name="householdId" value={householdId} />

        <CurrencyField
          label="Receipt total"
          name="declaredTotalCents"
          defaultCents={0}
          required
          hint="Enter dollars and cents. HouseholdOS stores the amount as cents."
        />

        <label className="block text-sm font-medium text-text-primary">
          Who paid
          <select
            name="payerMembershipId"
            defaultValue={ctx.membershipId}
            className="mt-1.5 w-full min-h-11 rounded-md border border-border bg-input-bg px-3 py-2 text-sm"
          >
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm font-medium text-text-primary">
          Merchant
          <input
            name="merchant"
            required
            className="mt-1.5 w-full min-h-11 rounded-md border border-border bg-input-bg px-3 py-2 text-sm"
          />
        </label>

        <label className="block text-sm font-medium text-text-primary">
          Purchase date
          <input
            type="date"
            name="purchaseDate"
            required
            defaultValue={today}
            className="mt-1.5 w-full min-h-11 rounded-md border border-border bg-input-bg px-3 py-2 text-sm"
          />
        </label>

        <DisclosureSection title="More details" description="Category and notes">
          <label className="block text-sm font-medium text-text-primary">
            Description
            <textarea
              name="description"
              rows={2}
              className="mt-1.5 w-full rounded-md border border-border bg-input-bg px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm font-medium text-text-primary">
            Category
            <select
              name="category"
              className="mt-1.5 w-full min-h-11 rounded-md border border-border bg-input-bg px-3 py-2 text-sm"
            >
              <option value="">Uncategorized</option>
              {[
                "groceries",
                "household",
                "utilities",
                "dining",
                "transport",
                "health",
                "other",
              ].map((c) => (
                <option key={c} value={c}>
                  {humanizeEnum(c)}
                </option>
              ))}
            </select>
          </label>
        </DisclosureSection>

        <button
          type="submit"
          className="min-h-11 w-full rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground sm:w-auto"
        >
          Create draft
        </button>
      </ActionForm>
    </main>
  );
}
