import { Skeleton } from "@/components/ui/skeleton";

export default function BalancesLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading balances">
      <Skeleton className="h-8 w-36" />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
    </div>
  );
}
