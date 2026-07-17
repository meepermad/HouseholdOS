export function LaunchFeatureUnavailable({
  title = "Feature not ready",
  message,
}: {
  title?: string;
  message: string;
}) {
  return (
    <div className="rounded-lg border border-amber-700/40 bg-amber-950/20 p-4 text-sm text-amber-100">
      <p className="font-medium text-amber-50">{title}</p>
      <p className="mt-1 text-amber-100/90">{message}</p>
      <p className="mt-2 text-xs text-amber-200/70">
        Coordinators: apply the pending launch migrations, regenerate database
        types, and redeploy before enabling these controls.
      </p>
    </div>
  );
}
