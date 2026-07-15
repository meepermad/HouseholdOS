import { Skeleton } from "@/components/ui/skeleton";

export default function NotificationSettingsLoading() {
  return (
    <div
      className="mx-auto max-w-2xl space-y-8"
      aria-busy="true"
      aria-label="Loading notification settings"
    >
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-72" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-56 w-full" />
    </div>
  );
}
