import { ActionForm } from "@/components/action-form";
import { createExpenseDraftAction } from "@/app/actions/expenses";
import { assertActiveMembership } from "@/lib/household-context";
import { listActiveMemberOptions } from "@/lib/expenses/queries";

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
    <main className="space-y-4">
      <h1 className="text-2xl font-semibold">New expense</h1>
      <p className="text-sm text-slate-600">
        Create a draft, then add itemized lines and confirm when reconciled.
      </p>

      <ActionForm action={createExpenseDraftAction} className="space-y-3" pendingLabel="Saving expense…">
        <input type="hidden" name="householdId" value={householdId} />

        <label className="block text-sm">
          Who paid
          <select
            name="payerMembershipId"
            defaultValue={ctx.membershipId}
            className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2"
          >
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          Merchant
          <input
            name="merchant"
            required
            className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2"
          />
        </label>

        <label className="block text-sm">
          Description
          <textarea
            name="description"
            rows={2}
            className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2"
          />
        </label>

        <label className="block text-sm">
          Category
          <select
            name="category"
            className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2"
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
                {c}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          Purchase date
          <input
            type="date"
            name="purchaseDate"
            required
            defaultValue={today}
            className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2"
          />
        </label>

        <label className="block text-sm">
          Receipt total (cents)
          <input
            type="number"
            name="declaredTotalCents"
            min={0}
            required
            defaultValue={0}
            className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2"
          />
        </label>

        <button
          type="submit"
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white"
        >
          Create draft
        </button>
      </ActionForm>
    </main>
  );
}
