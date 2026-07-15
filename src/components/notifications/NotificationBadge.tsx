export function NotificationBadge({
  count,
  className = "",
}: {
  count: number;
  className?: string;
}) {
  if (!count || count <= 0) return null;
  const label = count > 99 ? "99+" : String(count);
  return (
    <span
      className={`inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[0.65rem] font-semibold leading-none text-primary-foreground ${className}`}
      aria-label={`${count} unread notifications`}
    >
      {label}
    </span>
  );
}
