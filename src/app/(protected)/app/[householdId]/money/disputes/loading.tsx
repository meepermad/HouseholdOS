import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading disputes">
      <Skeleton className="h-8 w-36" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}
