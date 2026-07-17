export default function Loading() {
  return (
    <main className="space-y-4 p-1" aria-busy="true" aria-live="polite">
      <div className="h-8 w-40 animate-pulse rounded bg-surface-secondary" />
      <div className="h-24 animate-pulse rounded bg-surface-secondary" />
      <div className="h-40 animate-pulse rounded bg-surface-secondary" />
    </main>
  );
}
