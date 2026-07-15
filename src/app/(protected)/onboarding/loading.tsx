import { Skeleton } from "@/components/ui/skeleton";

export default function OnboardingLoading() {
  return (
    <div
      className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-4 py-8"
      aria-busy="true"
      aria-label="Loading onboarding"
    >
      <Skeleton className="h-8 w-48" />
      <Skeleton className="mt-4 h-4 w-full" />
      <Skeleton className="mt-8 h-11 w-full" />
      <Skeleton className="mt-3 h-11 w-full" />
      <Skeleton className="mt-3 h-11 w-full" />
      <Skeleton className="mt-6 h-12 w-full" />
    </div>
  );
}
