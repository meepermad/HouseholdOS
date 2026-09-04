import { householdRoutes } from "@/lib/routes/household";
import { HOUSEHOLD_NAV_ITEMS, QUICK_ADD_ACTIONS } from "@/lib/nav-items";
import { NOTIFICATION_CATALOG } from "@/lib/notifications/catalog";

const SAMPLE_HOUSEHOLD = "11111111-1111-4111-8111-111111111111";
const SAMPLE_ENTITY = "22222222-2222-4222-8222-222222222222";

export type ManifestRoute = {
  id: string;
  href: string;
  source: "nav" | "quick-add" | "notification" | "public" | "money-create";
};

export const PUBLIC_ROUTES = [
  "/",
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/join/paste",
  "/recovery",
] as const;

function expandDeepLink(pattern: string): string {
  return pattern
    .replaceAll("{householdId}", SAMPLE_HOUSEHOLD)
    .replaceAll("{entityId}", SAMPLE_ENTITY);
}

export function buildRouteManifest(): ManifestRoute[] {
  const routes: ManifestRoute[] = PUBLIC_ROUTES.map((href) => ({
    id: href,
    href,
    source: "public" as const,
  }));

  for (const item of HOUSEHOLD_NAV_ITEMS) {
    if (!item.enabled) continue;
    routes.push({
      id: `nav:${item.key}`,
      href: item.href(SAMPLE_HOUSEHOLD),
      source: "nav",
    });
  }

  for (const action of QUICK_ADD_ACTIONS) {
    routes.push({
      id: `quick:${action.key}`,
      href: action.href(SAMPLE_HOUSEHOLD),
      source: "quick-add",
    });
  }

  routes.push({
    id: "money:paste",
    href: householdRoutes.money.receiptPaste(SAMPLE_HOUSEHOLD),
    source: "money-create",
  });

  for (const entry of Object.values(NOTIFICATION_CATALOG)) {
    if (!entry.active || !entry.deepLinkPattern) continue;
    routes.push({
      id: `notify:${entry.eventType}`,
      href: expandDeepLink(entry.deepLinkPattern),
      source: "notification",
    });
  }

  return routes;
}

export function hrefToAppPattern(href: string): string {
  const path = href.split(/[?#]/, 1)[0] ?? href;
  return path
    .replace(SAMPLE_HOUSEHOLD, "[householdId]")
    .replace(SAMPLE_ENTITY, "[id]");
}
