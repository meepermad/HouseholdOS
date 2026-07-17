import Link from "next/link";

export type CalendarView = "agenda" | "day" | "month" | "week";

export const CALENDAR_VIEWS: readonly CalendarView[] = [
  "agenda",
  "day",
  "week",
  "month",
];

const VIEW_LABELS: Record<CalendarView, string> = {
  agenda: "Agenda",
  day: "Day",
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

export function calendarViewPath(
  householdId: string,
  view: CalendarView,
  date?: string,
): string {
  const base = `/app/${householdId}/calendar/${view}`;
  return date ? `${base}?date=${date}` : base;
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
  date,
}: {
  householdId: string;
  view: CalendarView;
  heading: string;
  prevHref: string;
  nextHref: string;
  todayHref: string;
  canCreate: boolean;
  hideWeekOnMobile?: boolean;
  date?: string;
}) {
  function viewHref(v: CalendarView): string {
    return calendarViewPath(householdId, v, date);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight sm:text-3xl">
          {heading}
        </h1>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/app/${householdId}/calendar/invitations`}
            className="inline-flex min-h-11 items-center rounded-md border border-border px-3 py-2 text-sm font-medium text-text-secondary hover:bg-surface-interactive"
          >
            Invitations
          </Link>
          <Link
            href={`/app/${householdId}/calendar/availability`}
            className="inline-flex min-h-11 items-center rounded-md border border-border px-3 py-2 text-sm font-medium text-text-secondary hover:bg-surface-interactive"
          >
            Find time
          </Link>
          {canCreate ? (
            <Link
              href={`/app/${householdId}/calendar/new`}
              className="inline-flex min-h-11 items-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
            >
              New event
            </Link>
          ) : null}
        </div>
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
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-border text-text-secondary hover:bg-surface-interactive"
            aria-label="Previous"
          >
            ‹
          </Link>
          <Link
            href={todayHref}
            className="inline-flex min-h-11 items-center rounded-md border border-border px-3 text-sm font-medium text-text-secondary hover:bg-surface-interactive"
          >
            Today
          </Link>
          <Link
            href={nextHref}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-border text-text-secondary hover:bg-surface-interactive"
            aria-label="Next"
          >
            ›
          </Link>
        </div>
      </div>
    </div>
  );
}
