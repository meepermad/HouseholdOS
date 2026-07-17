"use client";

import Link from "next/link";
import { useState } from "react";
import { Ellipsis, Plus } from "lucide-react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import {
  householdRoutes,
  type CalendarViewSlug,
} from "@/lib/routes/household";

export type CalendarView = CalendarViewSlug;

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

export function calendarViewPath(
  householdId: string,
  view: CalendarView,
  date?: string,
): string {
  return householdRoutes.calendar.view(householdId, view, date);
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
  const [menuOpen, setMenuOpen] = useState(false);

  function viewHref(v: CalendarView): string {
    return calendarViewPath(householdId, v, date);
  }

  return (
    <div className="space-y-3" data-testid="calendar-toolbar">
      <div className="flex items-center justify-between gap-2">
        <h1 className="min-w-0 truncate font-[family-name:var(--font-display)] text-xl font-semibold tracking-tight sm:text-2xl">
          {VIEW_LABELS[view]}
        </h1>
        <div className="flex shrink-0 items-center gap-1">
          {canCreate ? (
            <Link
              href={householdRoutes.calendar.new(householdId)}
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md bg-primary text-primary-foreground"
              aria-label="New event"
              data-testid="calendar-new-event"
            >
              <Plus className="h-5 w-5" aria-hidden />
            </Link>
          ) : null}
          <button
            type="button"
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-border text-text-secondary hover:bg-surface-interactive"
            aria-label="Calendar options"
            aria-expanded={menuOpen}
            data-testid="calendar-overflow"
            onClick={() => setMenuOpen(true)}
          >
            <Ellipsis className="h-5 w-5" aria-hidden />
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-text-secondary">{heading}</p>
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

      {/* Desktop segmented views; mobile uses overflow menu */}
      <div
        className="hidden items-center gap-1 rounded-md border border-border bg-surface p-1 sm:flex"
        role="tablist"
        aria-label="Calendar view"
      >
        {CALENDAR_VIEWS.map((v) => (
          <Link
            key={v}
            href={viewHref(v)}
            role="tab"
            aria-selected={view === v}
            className={`inline-flex min-h-11 items-center rounded-md px-3 py-1.5 text-sm font-medium ${
              view === v
                ? "bg-surface-interactive text-primary"
                : "text-text-secondary hover:bg-surface-interactive"
            } ${v === "week" && hideWeekOnMobile ? "hidden lg:inline-flex" : ""}`}
          >
            {VIEW_LABELS[v]}
          </Link>
        ))}
      </div>

      <BottomSheet
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        title="Calendar options"
        testId="calendar-overflow-sheet"
      >
        <nav className="flex flex-col gap-1">
          <Link
            href={householdRoutes.calendar.invitations(householdId)}
            className="flex min-h-11 items-center rounded-md px-2 text-sm hover:bg-surface-interactive"
            onClick={() => setMenuOpen(false)}
          >
            Invitations
          </Link>
          <Link
            href={householdRoutes.calendar.availability(householdId)}
            className="flex min-h-11 items-center rounded-md px-2 text-sm hover:bg-surface-interactive"
            onClick={() => setMenuOpen(false)}
          >
            Find a time
          </Link>
          <Link
            href={householdRoutes.settings.calendar(householdId)}
            className="flex min-h-11 items-center rounded-md px-2 text-sm hover:bg-surface-interactive"
            onClick={() => setMenuOpen(false)}
          >
            Calendar settings
          </Link>
          <p className="mt-2 px-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
            Change view
          </p>
          {CALENDAR_VIEWS.filter(
            (v) => !(v === "week" && hideWeekOnMobile),
          ).map((v) => (
            <Link
              key={v}
              href={viewHref(v)}
              className={`flex min-h-11 items-center rounded-md px-2 text-sm hover:bg-surface-interactive ${
                view === v ? "font-semibold text-primary" : ""
              }`}
              onClick={() => setMenuOpen(false)}
            >
              {VIEW_LABELS[v]}
            </Link>
          ))}
        </nav>
      </BottomSheet>
    </div>
  );
}
