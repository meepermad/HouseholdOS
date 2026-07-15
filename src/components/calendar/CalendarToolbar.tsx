import Link from "next/link";

export type CalendarView = "agenda" | "month" | "week";

export const CALENDAR_VIEWS: readonly CalendarView[] = [
  "agenda",
  "month",
  "week",
];

const VIEW_LABELS: Record<CalendarView, string> = {
  agenda: "Agenda",
  month: "Month",
  week: "Week",
};

function pill(active: boolean): string {
  const base =
    "inline-flex min-h-11 items-center rounded-md px-3 py-1.5 text-sm font-medium";
  return active
    ? `${base} bg-surface-interactive text-primary`
    : `${base} text-text-secondary hover:bg-surface-interactive hover:text-text-primary`;
}

export function CalendarToolbar({
  householdId,
  view,
  heading,
  prevHref,
  nextHref,
  todayHref,
  canCreate,
  hideWeekOnMobile = true,
}: {
  householdId: string;
  view: CalendarView;
  heading: string;
  prevHref: string;
  nextHref: string;
  todayHref: string;
  canCreate: boolean;
  hideWeekOnMobile?: boolean;
}) {
  function viewHref(v: CalendarView): string {
    return `/app/${householdId}/calendar?view=${v}`;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight sm:text-3xl">
          {heading}
        </h1>
        {canCreate ? (
          <Link
            href={`/app/${householdId}/calendar/new`}
            className="inline-flex min-h-11 items-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            New event
          </Link>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div
          className="flex items-center gap-1 rounded-md border border-border bg-surface p-1"
          role="tablist"
          aria-label="Calendar view"
        >
          {CALENDAR_VIEWS.map((v) => (
            <Link
              key={v}
              href={viewHref(v)}
              role="tab"
              aria-selected={view === v}
              className={`${pill(view === v)} ${
                v === "week" && hideWeekOnMobile ? "hidden lg:inline-flex" : ""
              }`}
            >
              {VIEW_LABELS[v]}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-1">
          <Link
            href={prevHref}
            aria-label="Previous"
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-border bg-surface text-sm text-text-secondary hover:bg-surface-interactive"
          >
            <span aria-hidden>‹</span>
          </Link>
          <Link
            href={todayHref}
            className="inline-flex min-h-11 items-center rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-text-secondary hover:bg-surface-interactive"
          >
            Today
          </Link>
          <Link
            href={nextHref}
            aria-label="Next"
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-border bg-surface text-sm text-text-secondary hover:bg-surface-interactive"
          >
            <span aria-hidden>›</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
