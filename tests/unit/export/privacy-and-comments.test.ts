import { describe, expect, it } from "vitest";
import {
  assertNoPushOrFeedSecrets,
  filterPantryForExport,
  filterRecipesForExport,
  stripSecretFields,
} from "@/lib/export/privacy-filter";
import { commentNotificationRecipients, canEditComment } from "@/lib/comments/types";

describe("export privacy", () => {
  it("strips secret-looking fields", () => {
    const cleaned = stripSecretFields({
      id: "1",
      name: "House",
      feed_token: "secret",
      vapid_private_key: "x",
    });
    expect(cleaned.name).toBe("House");
    expect(cleaned.feed_token).toBeUndefined();
    expect(cleaned.vapid_private_key).toBeUndefined();
  });

  it("filters personal pantry and private recipes", () => {
    const ctx = {
      canViewOthersPersonalPantry: false,
      canViewOthersPrivateRecipes: false,
      requesterMembershipId: "me",
    };
    const pantry = filterPantryForExport(
      [
        { id: "1", visibility: "personal", owner_membership_id: "other" },
        { id: "2", visibility: "personal", owner_membership_id: "me" },
        { id: "3", visibility: "household" },
      ],
      ctx,
    );
    expect(pantry.map((p) => p.id)).toEqual(["2", "3"]);

    const recipes = filterRecipesForExport(
      [
        { id: "r1", visibility: "creator_only", created_by_membership_id: "other" },
        { id: "r2", visibility: "household" },
      ],
      ctx,
    );
    expect(recipes.map((r) => r.id)).toEqual(["r2"]);
  });

  it("detects push/feed secret paths", () => {
    expect(
      assertNoPushOrFeedSecrets({ ok: true, push_endpoint: "https://x" }).length,
    ).toBeGreaterThan(0);
  });
});

describe("comment recipients", () => {
  it("notifies mentions and participants except author", () => {
    const recipients = commentNotificationRecipients({
      householdActiveMembershipIds: ["a", "b", "c"],
      authorMembershipId: "a",
      mentionedMembershipIds: ["b", "outsider"],
      parentParticipantIds: ["c", "a"],
    });
    expect(recipients.sort()).toEqual(["b", "c"]);
  });

  it("enforces edit window", () => {
    const created = new Date("2026-01-01T00:00:00Z");
    expect(
      canEditComment("a", "a", created, new Date("2026-01-01T00:10:00Z")),
    ).toBe(true);
    expect(
      canEditComment("a", "a", created, new Date("2026-01-01T00:20:00Z")),
    ).toBe(false);
  });
});
