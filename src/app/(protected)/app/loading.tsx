import { Skeleton } from "@/components/ui/skeleton";

export default function AppIndexLoading() {
  return (
    <div
      className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-4 py-8"
      aria-busy="true"
      aria-label="Loading household"
    >
      <Skeleton className="h-8 w-48" />
      <Skeleton className="mt-4 h-4 w-full" />
      <Skeleton className="mt-2 h-4 w-2/3" />
    </div>
  );
}
