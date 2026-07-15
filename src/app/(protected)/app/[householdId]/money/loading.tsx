import { Skeleton } from "@/components/ui/skeleton";

export default function MoneyLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading money">
      <Skeleton className="h-9 w-32" />
      <Skeleton className="h-4 w-72 max-w-full" />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-11 w-28" />
        <Skeleton className="h-11 w-28" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
      </div>
    </div>
  );
}
