import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";

export function CalendarEmptyState({
  householdId,
  canCreate,
  message = "Nothing scheduled in this range.",
}: {
  householdId: string;
  canCreate: boolean;
  message?: string;
}) {
  return (
    <EmptyState
      testId="empty-calendar"
      title="No events yet"
      description={message}
      action={
        canCreate ? (
          <Link
            href={`/app/${householdId}/calendar/new`}
            className="inline-flex min-h-11 items-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            Create first event
          </Link>
        ) : undefined
      }
    />
  );
}
