import Link from "next/link";
import { assertActiveMembership } from "@/lib/household-context";
import {
  groupSearchDomains,
  searchHousehold,
} from "@/lib/search/household-search";
import { EmptyState } from "@/components/ui/empty-state";
import { humanizeEnum } from "@/lib/presentation";

export const dynamic = "force-dynamic";

export default async function SearchPage({
  params,
  searchParams,
}: {
  params: Promise<{ householdId: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { householdId } = await params;
  const { q = "" } = await searchParams;
  await assertActiveMembership(householdId);
  const grouped = q.trim().length >= 2 ? await searchHousehold(householdId, q) : {};
  const sections = groupSearchDomains(grouped);

  return (
    <main className="space-y-4" data-testid="global-search">
      <h1 className="font-[family-name:var(--font-display)] text-2xl">Search</h1>
      <form className="flex gap-2" action={`/app/${householdId}/search`} method="get">
        <label className="sr-only" htmlFor="search-q">
          Search household
        </label>
        <input
          id="search-q"
          name="q"
          defaultValue={q}
          placeholder="Search chores, supplies, policies…"
          className="min-h-11 flex-1 rounded-md border border-border bg-input-bg px-3 text-sm"
        />
        <button
          type="submit"
          className="min-h-11 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
        >
          Search
        </button>
      </form>

      {q.trim().length > 0 && q.trim().length < 2 ? (
        <p className="text-sm text-text-muted">Enter at least 2 characters.</p>
      ) : null}

      {q.trim().length >= 2 && sections.length === 0 ? (
        <EmptyState
          variant="section"
          title="No matches"
          description="Try another word. Private content you cannot access will never appear."
        />
      ) : null}

      <div className="space-y-5">
        {sections.map(({ domain, hits }) => (
          <section key={domain} className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
              {humanizeEnum(domain)}
            </h2>
            <ul className="divide-y divide-border rounded-md border border-border bg-surface">
              {hits.map((hit) => (
                <li key={`${domain}-${hit.id}`}>
                  <Link
                    href={hit.href}
                    className="block min-h-11 px-4 py-3 hover:bg-surface-interactive"
                  >
                    <p className="text-sm font-medium">{hit.title}</p>
                    {hit.snippet ? (
                      <p className="text-xs text-text-secondary">{hit.snippet}</p>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
}
