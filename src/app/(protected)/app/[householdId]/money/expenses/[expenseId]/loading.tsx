import { Skeleton } from "@/components/ui/skeleton";

export default function ExpenseDetailLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading expense">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-5 w-32" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-11 w-36" />
    </div>
  );
}
