import { renderCalendarViewPage } from "@/app/(protected)/app/[householdId]/calendar/calendar-view";

export const dynamic = "force-dynamic";

export default async function CalendarDayPage({
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
    view: "day",
    dateParam: date,
  });
}
