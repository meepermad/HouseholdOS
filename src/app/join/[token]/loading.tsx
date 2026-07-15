import { Skeleton } from "@/components/ui/skeleton";

export default function JoinLoading() {
  return (
    <div
      className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4"
      aria-busy="true"
      aria-label="Loading invitation"
    >
      <Skeleton className="h-8 w-56" />
      <Skeleton className="mt-4 h-4 w-full" />
      <Skeleton className="mt-2 h-4 w-3/4" />
      <Skeleton className="mt-8 h-12 w-full" />
      <Skeleton className="mt-3 h-12 w-full" />
    </div>
  );
}
