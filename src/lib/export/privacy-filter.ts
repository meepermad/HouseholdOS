/**
 * Privacy filtering for household export archives.
 * This is a backup/export — not a full database restore.
 */

const SECRET_KEY_PATTERNS = [
  /secret/i,
  /token/i,
  /password/i,
  /vapid/i,
  /private_key/i,
  /api_key/i,
  /endpoint/i,
  /p256dh/i,
  /auth_key/i,
  /feed_token/i,
  /refresh_token/i,
];

export type ExportPrivacyContext = {
  /** Whether requester can see personal pantry items belonging to others. */
  canViewOthersPersonalPantry: boolean;
  /** Whether requester can see creator-only recipes they do not own. */
  canViewOthersPrivateRecipes: boolean;
  requesterMembershipId: string;
};

export function isSecretFieldName(key: string): boolean {
  return SECRET_KEY_PATTERNS.some((re) => re.test(key));
}

export function stripSecretFields<T extends Record<string, unknown>>(
  row: T,
): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (isSecretFieldName(key)) continue;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      out[key] = stripSecretFields(value as Record<string, unknown>);
    } else {
      out[key] = value;
    }
  }
  return out as Partial<T>;
}

export function filterPantryForExport(
  items: Array<Record<string, unknown>>,
  ctx: ExportPrivacyContext,
): Array<Record<string, unknown>> {
  return items
    .filter((item) => {
      const visibility = String(item.visibility ?? "household");
      const ownershipMode = String(item.ownership_mode ?? "household");
      const ownerId = String(
        item.owner_membership_id ?? item.created_by_membership_id ?? "",
      );
      const isPersonal =
        visibility === "owner_only" ||
        visibility === "personal" ||
        visibility === "creator_only" ||
        ownershipMode === "personal" ||
        ownershipMode === "temporary";
      if (isPersonal) {
        if (ownerId === ctx.requesterMembershipId) return true;
        return ctx.canViewOthersPersonalPantry;
      }
      return true;
    })
    .map((item) => stripSecretFields(item));
}

export function filterRecipesForExport(
  items: Array<Record<string, unknown>>,
  ctx: ExportPrivacyContext,
): Array<Record<string, unknown>> {
  return items
    .filter((item) => {
      const visibility = String(item.visibility ?? "household");
      const ownerId = String(item.created_by_membership_id ?? "");
      if (visibility === "creator_only" || visibility === "private") {
        if (ownerId === ctx.requesterMembershipId) return true;
        return ctx.canViewOthersPrivateRecipes;
      }
      return true;
    })
    .map((item) => stripSecretFields(item));
}

/** Push subscriptions and feed tokens must never appear in exports. */
export function assertNoPushOrFeedSecrets(payload: unknown): string[] {
  const violations: string[] = [];
  const walk = (node: unknown, path: string) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      node.forEach((v, i) => walk(v, `${path}[${i}]`));
      return;
    }
    for (const [k, v] of Object.entries(node)) {
      const p = path ? `${path}.${k}` : k;
      if (isSecretFieldName(k)) violations.push(p);
      walk(v, p);
    }
  };
  walk(payload, "");
  return violations;
}
