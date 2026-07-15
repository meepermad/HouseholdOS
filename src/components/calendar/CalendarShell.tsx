import type { ReactNode } from "react";
import { CalendarToolbar, type CalendarView } from "@/components/calendar/CalendarToolbar";

export function CalendarShell({
  householdId,
  view,
  heading,
  prevHref,
  nextHref,
  todayHref,
  canCreate,
  children,
}: {
  householdId: string;
  view: CalendarView;
  heading: string;
  prevHref: string;
  nextHref: string;
  todayHref: string;
  canCreate: boolean;
  children: ReactNode;
}) {
  return (
    <main className="space-y-5">
      <CalendarToolbar
        householdId={householdId}
        view={view}
        heading={heading}
        prevHref={prevHref}
        nextHref={nextHref}
        todayHref={todayHref}
        canCreate={canCreate}
      />
      <section>{children}</section>
    </main>
  );
}
