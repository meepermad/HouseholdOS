export function EmptyState({
  title,
  description,
  action,
  testId,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
  testId?: string;
}) {
  return (
    <div
      className="rounded-md border border-dashed border-border-strong bg-surface-secondary px-4 py-8 text-center"
      data-testid={testId}
      role="status"
    >
      <h2 className="font-[family-name:var(--font-display)] text-lg text-text-primary">
        {title}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-text-secondary">
        {description}
      </p>
      {action ? <div className="mt-4 flex justify-center gap-2">{action}</div> : null}
    </div>
  );
}
