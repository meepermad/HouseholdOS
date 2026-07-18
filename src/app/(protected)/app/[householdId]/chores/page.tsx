import Link from "next/link";
import { ChoreBoard } from "@/components/chores/ChoreBoard";
import { assertActiveMembership } from "@/lib/household-context";
import { can } from "@/lib/permissions";
import { listBoardOccurrences } from "@/lib/chores/queries";

export const dynamic = "force-dynamic";
export default async function ChoresPage({ params }: { params: Promise<{ householdId: string }> }) {
  const { householdId } = await params;
  const ctx = await assertActiveMembership(householdId);
  const chores = await listBoardOccurrences(householdId, ctx.membershipId, {
    status: ["scheduled", "in_progress", "blocked", "awaiting_verification", "reopened"],
  });
  const create = can(ctx.roles, "chore.create");
  return (
    <main className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl">
            Chores
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            Upcoming household work and assignments.
          </p>
        </div>
        <nav className="flex flex-wrap items-center gap-2 text-sm">
          {create ? (
            <Link
              className="min-h-11 rounded-md bg-primary px-4 py-2.5 font-semibold text-primary-foreground"
              href={`/app/${householdId}/chores/new`}
            >
              New chore
            </Link>
          ) : null}
          <Link
            className="min-h-11 rounded-md border border-border px-3 py-2.5 text-text-secondary"
            href={`/app/${householdId}/chores/mine`}
          >
            My chores
          </Link>
          <Link
            className="min-h-11 rounded-md border border-border px-3 py-2.5 text-text-secondary"
            href={`/app/${householdId}/chores/rotations`}
          >
            Rotations
          </Link>
          <Link
            className="min-h-11 rounded-md border border-border px-3 py-2.5 text-text-secondary"
            href={`/app/${householdId}/responsibilities`}
          >
            Responsibilities
          </Link>
        </nav>
      </header>
      <ChoreBoard householdId={householdId} chores={chores} canCreate={create} />
    </main>
  );
}
