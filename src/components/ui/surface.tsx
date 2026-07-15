import type { HTMLAttributes, ReactNode } from "react";

export function Surface({
  children,
  className = "",
  elevated = false,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  elevated?: boolean;
}) {
  return (
    <div
      className={`rounded-md border border-border ${
        elevated ? "bg-surface-elevated" : "bg-surface"
      } p-4 sm:p-5 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
