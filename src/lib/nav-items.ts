import { householdRoutes, isCalendarPath } from "@/lib/routes/household";

/**
 * Nav icon keys mapped to Lucide icon names for a single icon family.
 * Components resolve these via `navIcon()`.
 */
export type NavIconKey =
  | "home"
  | "calendar"
  | "chores"
  | "money"
  | "settings"
  | "inbox"
  | "house"
  | "maintenance"
  | "governance"
  | "more"
  | "profile"
  | "add"
  | "search";

export type MoreNavSection = "household" | "communication" | "account";

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

export type NavBadgeKey =
  | "inbox"
  | "chores"
  | "money"
  | "maintenance"
  | null;

export type HouseholdNavItem = {
  key: string;
  label: string;
  /** Short label for the bottom bar (defaults to label). */
  shortLabel?: string;
  icon: NavIconKey;
  href: (householdId: string) => string;
  match: (pathname: string, householdId: string) => boolean;
  /** When false, omitted from all nav surfaces. */
  enabled: boolean;
  surface: NavSurface;
  moreSection?: MoreNavSection;
  /** Which badge count to show (zeros are hidden). */
  badge?: NavBadgeKey;
};

export const HOUSEHOLD_NAV_ITEMS: readonly HouseholdNavItem[] = [
  {
    key: "home",
    label: "Home",
    icon: "home",
    href: (id) => householdRoutes.home(id),
    match: (pathname, id) =>
      pathname === `/app/${id}` || pathname === `/app/${id}/`,
    enabled: true,
    surface: "primary",
  },
  {
    key: "calendar",
    label: "Calendar",
    icon: "calendar",
    href: (id) => householdRoutes.calendar.agenda(id),
    match: (pathname, id) => isCalendarPath(pathname, id),
    enabled: true,
    surface: "primary",
  },
  {
    key: "chores",
    label: "Chores",
    icon: "chores",
    href: (id) => householdRoutes.chores.index(id),
    match: (pathname, id) =>
      pathname.startsWith(`/app/${id}/chores`) ||
      pathname.startsWith(`/app/${id}/responsibilities`),
    enabled: true,
    surface: "primary",
    badge: "chores",
  },
  {
    key: "money",
    label: "Money",
    icon: "money",
    href: (id) => householdRoutes.money.index(id),
    match: (pathname, id) => pathname.startsWith(`/app/${id}/money`),
    enabled: true,
    surface: "primary",
    badge: "money",
  },
  {
    key: "ops",
    label: "Roommate ops",
    icon: "house",
    href: (id) => householdRoutes.ops(id),
    match: (pathname, id) => pathname.startsWith(`/app/${id}/ops`),
    enabled: true,
    surface: "more",
    moreSection: "household",
  },
  {
    key: "products",
    label: "Products",
    icon: "search",
    href: (id) => householdRoutes.products(id),
    match: (pathname, id) => pathname.startsWith(`/app/${id}/products`),
    enabled: true,
    surface: "more",
    moreSection: "household",
  },
  {
    key: "house",
    label: "House",
    icon: "house",
    href: (id) => householdRoutes.house.index(id),
    match: (pathname, id) =>
      pathname.startsWith(`/app/${id}/house`) ||
      pathname.startsWith(`/app/${id}/meals`) ||
      pathname.startsWith(`/app/${id}/recipes`) ||
      pathname.startsWith(`/app/${id}/meal-prep`),
    enabled: true,
    surface: "more",
    moreSection: "household",
  },
  {
    key: "maintenance",
    label: "Maintenance",
    icon: "maintenance",
    href: (id) => householdRoutes.maintenance.index(id),
    match: (pathname, id) => pathname.startsWith(`/app/${id}/maintenance`),
    enabled: true,
    surface: "more",
    moreSection: "household",
    badge: "maintenance",
  },
  {
    key: "governance",
    label: "Governance",
    icon: "governance",
    href: (id) => householdRoutes.governance.index(id),
    match: (pathname, id) =>
      pathname.startsWith(`/app/${id}/governance`) ||
      pathname.startsWith(`/app/${id}/settings/governance`),
    enabled: true,
    surface: "more",
    moreSection: "household",
  },
  {
    key: "search",
    label: "Search",
    icon: "search",
    href: (id) => householdRoutes.search(id),
    match: (pathname, id) => pathname.startsWith(`/app/${id}/search`),
    enabled: true,
    surface: "more",
    moreSection: "communication",
  },
  {
    key: "polls",
    label: "Decisions",
    icon: "governance",
    href: (id) => householdRoutes.polls.index(id),
    match: (pathname, id) => pathname.startsWith(`/app/${id}/polls`),
    enabled: true,
    surface: "more",
    moreSection: "household",
  },
  {
    key: "utilities",
    label: "Bills",
    icon: "money",
    href: (id) => householdRoutes.utilities(id),
    match: (pathname, id) => pathname.startsWith(`/app/${id}/utilities`),
    enabled: true,
    surface: "more",
    moreSection: "household",
  },
  {
    key: "emergency",
    label: "Emergency card",
    icon: "maintenance",
    href: (id) => householdRoutes.emergency(id),
    match: (pathname, id) => pathname.startsWith(`/app/${id}/emergency`),
    enabled: true,
    surface: "more",
    moreSection: "household",
  },
  {
    key: "guests",
    label: "Guest notices",
    icon: "calendar",
    href: (id) => householdRoutes.guestsNew(id),
    match: (pathname, id) => pathname.startsWith(`/app/${id}/guests`),
    enabled: true,
    surface: "more",
    moreSection: "household",
  },
  {
    key: "away",
    label: "Away status",
    icon: "profile",
    href: (id) => householdRoutes.away(id),
    match: (pathname, id) => pathname.startsWith(`/app/${id}/away`),
    enabled: true,
    surface: "more",
    moreSection: "account",
  },
  {
    key: "review",
    label: "Weekly review",
    icon: "home",
    href: (id) => householdRoutes.review(id),
    match: (pathname, id) => pathname.startsWith(`/app/${id}/review`),
    enabled: true,
    surface: "more",
    moreSection: "household",
  },
  {
    key: "inbox",
    label: "Inbox",
    shortLabel: "Inbox",
    icon: "inbox",
    href: (id) => householdRoutes.notifications(id),
    match: (pathname, id) => pathname.startsWith(`/app/${id}/notifications`),
    enabled: true,
    surface: "more",
    moreSection: "communication",
    badge: "inbox",
  },
  {
    key: "settings",
    label: "Settings",
    icon: "settings",
    href: (id) => householdRoutes.settings.index(id),
    match: (pathname, id) => pathname.startsWith(`/app/${id}/settings`),
    enabled: true,
    surface: "more",
    moreSection: "account",
  },
  {
    key: "profile",
    label: "Profile",
    icon: "profile",
    href: (id) => householdRoutes.settings.profile(id),
    match: (pathname, id) =>
      pathname === `/app/${id}/settings/profile` ||
      pathname === `/app/${id}/settings/profile/`,
    enabled: true,
    surface: "more",
    moreSection: "account",
  },
] as const;

export const MORE_SECTION_LABELS: Record<MoreNavSection, string> = {
  household: "Household",
  communication: "Communication",
  account: "Account",
};

export const MORE_SECTION_ORDER: MoreNavSection[] = [
  "household",
  "communication",
  "account",
];

export function enabledNavItems(): HouseholdNavItem[] {
  return HOUSEHOLD_NAV_ITEMS.filter((item) => item.enabled);
}

/** Bottom bar: enabled primary items, capped for thumb reach. */
export function primaryNavItems(): HouseholdNavItem[] {
  return enabledNavItems()
    .filter((item) => item.surface === "primary")
    .slice(0, MAX_PRIMARY_NAV);
}

/** Destinations that live outside the primary bottom bar. */
export function moreNavItems(): HouseholdNavItem[] {
  return enabledNavItems().filter((item) => item.surface === "more");
}

export function moreNavBySection(): {
  section: MoreNavSection;
  label: string;
  items: HouseholdNavItem[];
}[] {
  const more = moreNavItems();
  return MORE_SECTION_ORDER.map((section) => ({
    section,
    label: MORE_SECTION_LABELS[section],
    items: more.filter((item) => item.moreSection === section),
  })).filter((group) => group.items.length > 0);
}

/** Sidebar / "More": everything enabled, primary first then more. */
export function sidebarNavItems(): HouseholdNavItem[] {
  const items = enabledNavItems();
  return [
    ...items.filter((i) => i.surface === "primary"),
    ...items.filter((i) => i.surface === "more"),
  ];
}

/** Quick-add destinations deep-link into existing create workflows. */
export type QuickAddAction = {
  key: string;
  label: string;
  href: (householdId: string) => string;
};

export const QUICK_ADD_ACTIONS: readonly QuickAddAction[] = [
  {
    key: "receipt",
    label: "Scan receipt",
    href: (id) => householdRoutes.money.receiptNew(id),
  },
  {
    key: "expense",
    label: "Add expense",
    href: (id) => householdRoutes.money.expensesNew(id),
  },
  {
    key: "shopping",
    label: "Add shopping item",
    href: (id) => householdRoutes.house.shopping(id),
  },
  {
    key: "meal",
    label: "Request meal",
    href: (id) => householdRoutes.meals.new(id),
  },
  {
    key: "chore",
    label: "Create chore",
    href: (id) => householdRoutes.chores.new(id),
  },
  {
    key: "event",
    label: "Create event",
    href: (id) => householdRoutes.calendar.new(id),
  },
  {
    key: "maintenance",
    label: "Report issue",
    href: (id) => householdRoutes.maintenance.new(id),
  },
  {
    key: "guest",
    label: "Add guest notice",
    href: (id) => householdRoutes.guestsNew(id),
  },
  {
    key: "decision",
    label: "Start household decision",
    href: (id) => householdRoutes.polls.new(id),
  },
] as const;
