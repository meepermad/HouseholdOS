import Link from "next/link";
import { assertActiveMembership } from "@/lib/household-context";
import { buildWeeklyReview } from "@/lib/home/weekly-review";
import { EmptyState } from "@/components/ui/empty-state";

export const dynamic = "force-dynamic";

export default async function WeeklyReviewPage({
  params,
}: {
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = await params;
  await assertActiveMembership(householdId);
  const review = await buildWeeklyReview(householdId);

  return (
    <main className="space-y-6" data-testid="weekly-review">
      <header>
        <h1 className="font-[family-name:var(--font-display)] text-2xl">
          Weekly household review
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          A meeting-friendly overview from household records. No rankings or
          scores.
        </p>
      </header>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">
          Last week
        </h2>
        {review.lastWeek.length === 0 ? (
          <EmptyState variant="inline" title="No activity to summarize yet." />
        ) : (
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {review.lastWeek.map((line, index) => (
              <li key={`last-${index}`}>
                {line.href ? (
                  <Link href={line.href} className="underline-offset-2 hover:underline">
                    {line.text}
                  </Link>
                ) : (
                  line.text
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">
          Next week
        </h2>
        {review.nextWeek.length === 0 ? (
          <EmptyState variant="inline" title="Nothing upcoming on the radar." />
        ) : (
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {review.nextWeek.map((line, index) => (
              <li key={`next-${index}`}>
                {line.href ? (
                  <Link href={line.href} className="underline-offset-2 hover:underline">
                    {line.text}
                  </Link>
                ) : (
                  line.text
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">
          Needs discussion
        </h2>
        {review.needsDiscussion.length === 0 ? (
          <EmptyState
            variant="inline"
            title="No open discussion items right now."
          />
        ) : (
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {review.needsDiscussion.map((line, index) => (
              <li key={`need-${index}`}>
                {line.href ? (
                  <Link href={line.href} className="underline-offset-2 hover:underline">
                    {line.text}
                  </Link>
                ) : (
                  line.text
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
