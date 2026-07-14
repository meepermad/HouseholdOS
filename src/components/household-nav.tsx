import Link from "next/link";

const ITEMS = [
  {
    key: "home",
    label: "Home",
    href: (id: string) => `/app/${id}`,
    enabled: true as boolean,
  },
  {
    key: "money",
    label: "Money",
    href: (id: string) => `/app/${id}/money`,
    enabled: true as boolean,
  },
  { key: "tasks", label: "Tasks", href: () => "#", enabled: false as boolean },
  { key: "house", label: "House", href: () => "#", enabled: false as boolean },
  {
    key: "records",
    label: "Records",
    href: () => "#",
    enabled: false as boolean,
  },
] as const;

export function HouseholdNav({ householdId }: { householdId: string }) {
  return (
    <nav
      aria-label="Primary"
      className="flex gap-1 overflow-x-auto border-b border-line px-2 py-2 text-sm"
    >
      {ITEMS.map((item) =>
        item.enabled ? (
          <Link
            key={item.key}
            href={item.href(householdId)}
            className="whitespace-nowrap rounded-md px-3 py-2 hover:bg-black/5"
          >
            {item.label}
          </Link>
        ) : (
          <span
            key={item.key}
            className="whitespace-nowrap rounded-md px-3 py-2 text-slate-400"
            title="Coming in a later phase"
          >
            {item.label}
          </span>
        ),
      )}
      <Link
        href={`/app/${householdId}/settings/members`}
        className="ml-auto whitespace-nowrap rounded-md px-3 py-2 hover:bg-black/5"
      >
        Settings
      </Link>
    </nav>
  );
}
