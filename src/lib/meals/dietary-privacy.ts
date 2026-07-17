/**
 * Dietary constraints are sensitive. Never infer medical conditions.
 * Organizers see aggregated summaries unless a member chose to share detail.
 */

export type DietaryConstraint = {
  membershipId: string;
  /** Short label, e.g. "no dairy", "vegetarian" */
  label: string;
  /** When true, organizer may see the member's display name with the constraint. */
  shareIdentityWithOrganizer: boolean;
  displayName?: string;
};

export type DietaryProjection = {
  /** Safe shared lines for meal organizers. */
  summaries: string[];
  /** Named details only when members opted in. */
  namedDetails: Array<{ membershipId: string; displayName: string; label: string }>;
};

export function projectDietaryConstraintsForOrganizer(
  constraints: readonly DietaryConstraint[],
): DietaryProjection {
  const anonymousCounts = new Map<string, number>();
  const namedDetails: DietaryProjection["namedDetails"] = [];

  for (const c of constraints) {
    const label = c.label.trim();
    if (!label) continue;
    if (c.shareIdentityWithOrganizer && c.displayName) {
      namedDetails.push({
        membershipId: c.membershipId,
        displayName: c.displayName,
        label,
      });
    } else {
      anonymousCounts.set(label, (anonymousCounts.get(label) ?? 0) + 1);
    }
  }

  const summaries: string[] = [];
  for (const [label, count] of anonymousCounts) {
    if (count === 1) {
      summaries.push(`One attendee requested ${label}.`);
    } else {
      summaries.push(`${count} attendees requested ${label}.`);
    }
  }

  return { summaries, namedDetails };
}

/** Never put medical explanations in notifications or audit bodies. */
export function sanitizeDietaryForNotification(
  projection: DietaryProjection,
): string | null {
  if (projection.summaries.length === 0 && projection.namedDetails.length === 0) {
    return null;
  }
  if (projection.summaries.length > 0) {
    return projection.summaries[0]!;
  }
  return "Dietary preferences apply to this meal.";
}
