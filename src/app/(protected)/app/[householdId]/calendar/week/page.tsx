import { renderCalendarViewPage } from "@/app/(protected)/app/[householdId]/calendar/calendar-view";

export const dynamic = "force-dynamic";

export default async function CalendarWeekPage({
  params,
  searchParams,
}: {
  params: Promise<{ householdId: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const { householdId } = await params;
  const { date } = await searchParams;
  return renderCalendarViewPage({
    householdId,
    view: "week",
    dateParam: date,
  });
}
