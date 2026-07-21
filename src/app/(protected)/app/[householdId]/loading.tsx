import { Skeleton } from "@/components/ui/skeleton";
import { LoadingStuckRecovery } from "@/components/loading-stuck-recovery";

export default function HouseholdLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading household dashboard">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-4 w-40" />
      <div className="space-y-3">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-20 w-full" />
      </div>
      <div className="space-y-3">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
      <div className="space-y-3">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
      <LoadingStuckRecovery />
    </div>
  );
}
