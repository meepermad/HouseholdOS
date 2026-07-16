/**
 * Household primary navigation config.
 *
 * Growth rules:
 * - Mobile bottom bar shows only `surface: "primary"` items that are enabled
 *   (hard cap: MAX_PRIMARY_NAV). Extra destinations use `surface: "more"`.
 * - Desktop sidebar shows every enabled item (primary + more).
 * - Domains that are not shipped yet stay `enabled: false` so they never appear.
 */

export const MAX_PRIMARY_NAV = 4;

export type NavSurface = "primary" | "more";

export type HouseholdNavItem = {
  key: string;
  label: string;
  /** Short label for the bottom bar (defaults to label). */
  shortLabel?: string;
  /** Compact mark shown above the label on the bottom bar. */
  mark: string;
  href: (householdId: string) => string;
  match: (pathname: string, householdId: string) => boolean;
  /** When false, omitted from all nav surfaces. */
  enabled: boolean;
  surface: NavSurface;
};

export const HOUSEHOLD_NAV_ITEMS: readonly HouseholdNavItem[] = [
  {
    key: "home",
    label: "Home",
    mark: "⌂",
    href: (id) => `/app/${id}`,
    match: (pathname, id) =>
      pathname === `/app/${id}` || pathname === `/app/${id}/`,
    enabled: true,
    surface: "primary",
  },
  {
    key: "calendar",
    label: "Calendar",
    mark: "▦",
    href: (id) => `/app/${id}/calendar`,
    match: (pathname, id) => pathname.startsWith(`/app/${id}/calendar`),
    enabled: true,
    surface: "primary",
  },
  {
    key: "chores",
    label: "Chores",
    mark: "✓",
    href: (id) => `/app/${id}/chores`,
    match: (pathname, id) =>
      pathname.startsWith(`/app/${id}/chores`) ||
      pathname.startsWith(`/app/${id}/responsibilities`),
    enabled: true,
    surface: "primary",
  },
  {
    key: "money",
    label: "Money",
    mark: "$",
    href: (id) => `/app/${id}/money`,
    match: (pathname, id) => pathname.startsWith(`/app/${id}/money`),
    enabled: true,
    surface: "primary",
  },
  {
    key: "settings",
    label: "Settings",
    mark: "⚙",
    href: (id) => `/app/${id}/settings/profile`,
    match: (pathname, id) => pathname.startsWith(`/app/${id}/settings`),
    enabled: true,
    surface: "more",
  },
  {
    key: "inbox",
    label: "Inbox",
    shortLabel: "Inbox",
    mark: "●",
    href: (id) => `/app/${id}/notifications`,
    match: (pathname, id) => pathname.startsWith(`/app/${id}/notifications`),
    enabled: true,
    surface: "more",
  },
  // Future domains — keep disabled until shipped. Prefer surface: "more"
  // once primary slots are full so the bottom bar stays uncrowded.
  {
    key: "house",
    label: "House",
    mark: "▣",
    href: (id) => `/app/${id}/house`,
    match: (pathname, id) => pathname.startsWith(`/app/${id}/house`),
    enabled: true,
    surface: "more",
  },
  {
    key: "records",
    label: "Records",
    mark: "☰",
    href: (id) => `/app/${id}/records`,
    match: (pathname, id) => pathname.startsWith(`/app/${id}/records`),
    enabled: false,
    surface: "more",
  },
] as const;

export function enabledNavItems(): HouseholdNavItem[] {
  return HOUSEHOLD_NAV_ITEMS.filter((item) => item.enabled);
}

/** Bottom bar: enabled primary items, capped for thumb reach. */
export function primaryNavItems(): HouseholdNavItem[] {
  return enabledNavItems()
    .filter((item) => item.surface === "primary")
    .slice(0, MAX_PRIMARY_NAV);
}

/** Sidebar / "More": everything enabled, primary first then more. */
export function sidebarNavItems(): HouseholdNavItem[] {
  const items = enabledNavItems();
  return [
    ...items.filter((i) => i.surface === "primary"),
    ...items.filter((i) => i.surface === "more"),
  ];
}
