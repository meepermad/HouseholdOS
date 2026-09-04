import Link from "next/link";

export function ResourceGone({
  title = "This item is no longer available.",
  href,
  actionLabel,
}: {
  title?: string;
  href: string;
  actionLabel: string;
}) {
  return (
    <div className="space-y-3" data-testid="resource-gone">
      <p className="text-sm text-text-secondary">{title}</p>
      <Link
        href={href}
        className="inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
      >
        {actionLabel}
      </Link>
    </div>
  );
}
