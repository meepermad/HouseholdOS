import Link from "next/link";
import { AppBackButton } from "@/components/app-back-button";
import { HouseHubTabs } from "@/components/house/HouseHubTabs";
import { assertActiveMembership } from "@/lib/household-context";
import { listMealPlansForWeek } from "@/lib/meals/queries";

export const dynamic = "force-dynamic";

function weekBounds(d = new Date()) {
  const day = d.getDay();
  const start = new Date(d);
  start.setDate(d.getDate() - day);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const iso = (x: Date) => x.toISOString().slice(0, 10);
  return { start: iso(start), end: iso(end) };
}

export default async function MealsPage({
  params,
}: {
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = await params;
  await assertActiveMembership(householdId);
  const { start, end } = weekBounds();
  const meals = await listMealPlansForWeek(householdId, start, end);
  const byDate = new Map<string, typeof meals>();
  for (const m of meals) {
    const list = byDate.get(m.mealDate) ?? [];
    list.push(m);
    byDate.set(m.mealDate, list);
  }
  const days: string[] = [];
  const cursor = new Date(start + "T12:00:00");
  for (let i = 0; i < 7; i++) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 1);
  }

  return (
    <main className="space-y-5">
      <AppBackButton fallbackHref={`/app/${householdId}/house`} />
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl">Meals</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Shared meals, personal plans, and open cooking — about two or three times a week is enough.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/app/${householdId}/meals/week`} className="min-h-11 rounded-md border border-border px-3 py-2.5 text-sm font-medium">
            Week board
          </Link>
          <Link href={`/app/${householdId}/meals/new`} className="min-h-11 rounded-md bg-primary px-3 py-2.5 text-sm font-medium text-primary-foreground">
            Plan meal
          </Link>
        </div>
      </header>
      <HouseHubTabs householdId={householdId} />

      <div className="space-y-4 lg:hidden">
        {days.map((date) => {
          const items = byDate.get(date) ?? [];
          return (
            <section key={date} className="space-y-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">
                {date}
              </h2>
              {items.length === 0 ? (
                <p className="rounded-md border border-dashed border-border-strong px-4 py-3 text-sm text-text-secondary">
                  No shared meal planned
                </p>
              ) : (
                <ul className="space-y-2">
                  {items.map((m) => (
                    <li key={m.id}>
                      <Link
                        href={`/app/${householdId}/meals/${m.id}`}
                        className="block min-h-11 rounded-md border border-border bg-surface px-4 py-3.5 hover:bg-surface-interactive"
                      >
                        <span className="font-medium">{m.title}</span>
                        <span className="text-text-secondary">
                          {" "}
                          · {m.mealType.replaceAll("_", " ")} · {m.targetServings} servings
                          {m.guestCount > 0 ? ` · ${m.guestCount} guests` : ""}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>

      <div className="hidden gap-3 lg:grid lg:grid-cols-7">
        {days.map((date) => {
          const items = byDate.get(date) ?? [];
          return (
            <section key={date} className="min-h-40 rounded-md border border-border p-3">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
                {date.slice(5)}
              </h2>
              {items.length === 0 ? (
                <p className="text-xs text-text-secondary">No shared meal</p>
              ) : (
                <ul className="space-y-2">
                  {items.map((m) => (
                    <li key={m.id}>
                      <Link
                        href={`/app/${householdId}/meals/${m.id}`}
                        className="block rounded-md bg-surface-secondary px-2 py-2 text-sm hover:bg-surface-interactive"
                      >
                        {m.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </main>
  );
}
