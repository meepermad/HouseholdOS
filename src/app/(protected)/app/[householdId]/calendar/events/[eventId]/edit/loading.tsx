import { Skeleton } from "@/components/ui/skeleton";

export default function EditCalendarEventLoading() {
  return (
    <div
      className="mx-auto max-w-2xl space-y-5"
      aria-busy="true"
      aria-label="Loading event form"
    >
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-11 w-full" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
      </div>
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-11 w-32" />
    </div>
  );
}
