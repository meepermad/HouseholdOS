import { Skeleton } from "@/components/ui/skeleton";

export default function NotificationsLoading() {
  return (
    <div
      className="mx-auto max-w-2xl space-y-6"
      aria-busy="true"
      aria-label="Loading notifications"
    >
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-4 w-64" />
      <div className="flex gap-2">
        <Skeleton className="h-11 w-16" />
        <Skeleton className="h-11 w-20" />
      </div>
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}
