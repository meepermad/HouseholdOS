import { Skeleton } from "@/components/ui/skeleton";

export function CalendarLoadingSkeleton({
  variant = "agenda",
}: {
  variant?: "agenda" | "month";
}) {
  if (variant === "month") {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="Loading calendar">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-9 w-48" />
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 35 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" aria-label="" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading calendar">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-9 w-48" />
      </div>
      {Array.from({ length: 3 }).map((_, day) => (
        <div key={day} className="space-y-2">
          <Skeleton className="h-5 w-32" aria-label="" />
          <Skeleton className="h-14 w-full" aria-label="" />
          <Skeleton className="h-14 w-full" aria-label="" />
        </div>
      ))}
    </div>
  );
}
