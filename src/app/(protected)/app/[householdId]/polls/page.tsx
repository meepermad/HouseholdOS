import Link from "next/link";
import { assertActiveMembership } from "@/lib/household-context";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/ui/empty-state";
import { humanizeEnum } from "@/lib/presentation";

export const dynamic = "force-dynamic";

export default async function PollsPage({
  params,
}: {
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = await params;
  await assertActiveMembership(householdId);
  const supabase = await createClient();
  const { data: polls } = await supabase
    .from("household_polls")
    .select("id, question, status, created_at, anonymous, allow_multiple")
    .eq("household_id", householdId)
    .order("created_at", { ascending: false })
    .limit(40);

  return (
    <main className="space-y-4" data-testid="polls-list">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-[family-name:var(--font-display)] text-2xl">
          Decisions
        </h1>
        <Link
          href={`/app/${householdId}/polls/new`}
          className="inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
        >
          New poll
        </Link>
      </div>
      {(polls ?? []).length === 0 ? (
        <EmptyState
          variant="section"
          title="No polls yet"
          description="Ask the household a question without changing permissions or finances."
        />
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border bg-surface">
          {(polls ?? []).map((p) => (
            <li key={p.id}>
              <Link
                href={`/app/${householdId}/polls/${p.id}`}
                className="block min-h-11 px-4 py-3 hover:bg-surface-interactive"
              >
                <p className="text-sm font-medium">{p.question}</p>
                <p className="text-xs text-text-muted">
                  {humanizeEnum(p.status)}
                  {p.anonymous ? " · Anonymous" : ""}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
