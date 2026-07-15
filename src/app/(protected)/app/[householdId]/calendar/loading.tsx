import { CalendarLoadingSkeleton } from "@/components/calendar/CalendarLoadingSkeleton";

export default function CalendarLoading() {
  return (
    <div className="space-y-4">
      <CalendarLoadingSkeleton variant="agenda" />
    </div>
  );
}
