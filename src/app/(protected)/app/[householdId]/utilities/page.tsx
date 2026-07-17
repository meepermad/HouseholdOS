import Link from "next/link";
import { assertActiveMembership } from "@/lib/household-context";
import { createClient } from "@/lib/supabase/server";
import { ActionForm } from "@/components/action-form";
import { createUtilityAction } from "@/app/actions/ux-c";
import { EmptyState } from "@/components/ui/empty-state";
import { CurrencyField } from "@/components/ui/currency-field";
import { Field, Input, Select } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { formatUsdFromCents, toCents } from "@/lib/money";
import { humanizeEnum } from "@/lib/presentation";

export const dynamic = "force-dynamic";

export default async function UtilitiesPage({
  params,
}: {
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = await params;
  await assertActiveMembership(householdId);
  const supabase = await createClient();
  const { data } = await supabase
    .from("household_utilities" as never)
    .select(
      "id, name, category, estimated_amount_cents, payment_status, due_day_of_month",
    )
    .eq("household_id", householdId)
    .order("name");
  const utilities = (data ?? []) as Array<{
    id: string;
    name: string;
    category: string;
    estimated_amount_cents: number | null;
    payment_status: string;
    due_day_of_month: number | null;
  }>;

  return (
    <main className="space-y-6" data-testid="utilities-page">
      <header>
        <h1 className="font-[family-name:var(--font-display)] text-2xl">
          Recurring bills
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          Track rent, utilities, and shared subscriptions. HouseholdOS does not
          store bank credentials or mark external bills paid automatically.
        </p>
      </header>

      {utilities.length === 0 ? (
        <EmptyState
          variant="section"
          title="No recurring bills yet"
          description="Add rent, electricity, internet, or other shared costs."
        />
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border bg-surface">
          {utilities.map((u) => (
            <li key={u.id} className="px-4 py-3 text-sm" data-testid="utility-card">
              <p className="font-medium">{u.name}</p>
              <p className="text-xs text-text-muted">
                {humanizeEnum(u.category)} · {humanizeEnum(u.payment_status)}
                {u.due_day_of_month ? ` · Due day ${u.due_day_of_month}` : ""}
                {u.estimated_amount_cents != null
                  ? ` · ${formatUsdFromCents(toCents(u.estimated_amount_cents))}`
                  : ""}
              </p>
            </li>
          ))}
        </ul>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Add bill</h2>
        <ActionForm
          action={createUtilityAction}
          className="space-y-3"
          pendingLabel="Saving…"
        >
          <input type="hidden" name="householdId" value={householdId} />
          <Field label="Name" required>
            <Input name="name" required placeholder="Internet" />
          </Field>
          <Field label="Category">
            <Select name="category" defaultValue="other">
              {[
                "rent",
                "electricity",
                "internet",
                "water",
                "subscription",
                "other",
              ].map((c) => (
                <option key={c} value={c}>
                  {humanizeEnum(c)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Due day of month">
            <Input
              type="number"
              name="dueDayOfMonth"
              min={1}
              max={28}
              placeholder="1"
            />
          </Field>
          <CurrencyField
            label="Estimated amount"
            name="estimatedAmountCents"
            defaultCents={0}
          />
          <SubmitButton>Add bill</SubmitButton>
        </ActionForm>
      </section>

      <p className="text-center text-xs text-text-muted">
        <Link
          href={`/app/${householdId}/money`}
          className="inline-flex min-h-11 items-center underline-offset-2 hover:underline"
        >
          Open Money
        </Link>
      </p>
    </main>
  );
}
