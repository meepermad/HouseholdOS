/**
 * Privacy-safe preference aggregation for organizers and explanations.
 * Never identify which attendee submitted a negative rating unless they opted in.
 */

import type {
  MemberPreferenceInput,
  PreferenceFitSummary,
  PreferenceScope,
  PreferenceSignal,
} from "./types";

export type PreferenceAggregate = {
  attendingCount: number;
  considered: MemberPreferenceInput[];
  signalCounts: Record<PreferenceSignal, number>;
  favoriteCount: number;
  dislikeCount: number;
  makeAgainCount: number;
  unknownCount: number;
  preferenceFit: PreferenceFitSummary;
  /** Anonymized explanation lines (no membership ids). */
  explanationLines: string[];
  /** Named lines only when shareIdentityWithOrganizer is true. */
  namedLines: string[];
  /** Soft numeric preference contribution before mode weights. */
  preferenceScore: number;
  strongDislikePenaltyUnits: number;
  favoriteBonusUnits: number;
  hasConflict: boolean;
};

function emptyCounts(): Record<PreferenceSignal, number> {
  return {
    favorite: 0,
    would_make_again: 0,
    okay: 0,
    would_not_choose_again: 0,
    have_not_tried: 0,
  };
}

/**
 * Select which member preferences participate in scoring.
 * Non-attendees are ignored unless preferenceScope is household
 * (open meal / explicit household-wide mode).
 */
export function selectRelevantPreferences(
  preferences: readonly MemberPreferenceInput[],
  scope: PreferenceScope,
): MemberPreferenceInput[] {
  if (scope === "household") {
    return [...preferences];
  }
  return preferences.filter((p) => p.isAttending);
}

export function aggregatePreferences(
  preferences: readonly MemberPreferenceInput[],
  scope: PreferenceScope,
): PreferenceAggregate {
  const considered = selectRelevantPreferences(preferences, scope);
  const signalCounts = emptyCounts();
  let favoriteCount = 0;
  let preferenceScore = 0;
  let strongDislikePenaltyUnits = 0;
  let favoriteBonusUnits = 0;

  for (const p of considered) {
    const signal =
      p.isFavorite && p.signal === "have_not_tried" ? "favorite" : p.signal;
    signalCounts[signal] += 1;
    if (p.isFavorite || signal === "favorite") {
      favoriteCount += 1;
      favoriteBonusUnits += 1;
    }
    switch (signal) {
      case "favorite":
        preferenceScore += 18;
        break;
      case "would_make_again":
        preferenceScore += 12;
        break;
      case "okay":
        preferenceScore += 2;
        break;
      case "would_not_choose_again":
        preferenceScore -= 20;
        strongDislikePenaltyUnits += 1;
        break;
      case "have_not_tried":
      default:
        break;
    }
  }

  const dislikeCount = signalCounts.would_not_choose_again;
  const makeAgainCount =
    signalCounts.would_make_again + signalCounts.favorite;
  const unknownCount = signalCounts.have_not_tried;
  const hasConflict = favoriteCount > 0 && dislikeCount > 0;

  const preferenceFit = resolvePreferenceFit({
    consideredCount: considered.length,
    favoriteCount,
    makeAgainCount,
    dislikeCount,
    okayCount: signalCounts.okay,
    unknownCount,
    hasConflict,
  });

  const explanationLines = buildAnonymousExplanations({
    makeAgainCount,
    dislikeCount,
    favoriteCount,
    okayCount: signalCounts.okay,
    unknownCount,
    hasConflict,
  });

  const namedLines: string[] = [];
  for (const p of considered) {
    if (
      p.shareIdentityWithOrganizer &&
      p.displayName &&
      (p.signal === "would_not_choose_again" || p.signal === "favorite")
    ) {
      namedLines.push(
        `${p.displayName} marked this “${formatSignal(p.signal)}.”`,
      );
    }
  }

  return {
    attendingCount: preferences.filter((p) => p.isAttending).length,
    considered,
    signalCounts,
    favoriteCount,
    dislikeCount,
    makeAgainCount,
    unknownCount,
    preferenceFit,
    explanationLines,
    namedLines,
    preferenceScore,
    strongDislikePenaltyUnits,
    favoriteBonusUnits,
    hasConflict,
  };
}

function formatSignal(signal: PreferenceSignal): string {
  switch (signal) {
    case "favorite":
      return "favorite";
    case "would_make_again":
      return "would make again";
    case "okay":
      return "okay";
    case "would_not_choose_again":
      return "would not choose again";
    case "have_not_tried":
      return "have not tried";
  }
}

function resolvePreferenceFit(input: {
  consideredCount: number;
  favoriteCount: number;
  makeAgainCount: number;
  dislikeCount: number;
  okayCount: number;
  unknownCount: number;
  hasConflict: boolean;
}): PreferenceFitSummary {
  if (input.consideredCount === 0) return "unknown";
  if (input.hasConflict) return "conflict";
  if (input.dislikeCount > 0 && input.makeAgainCount === 0) {
    return input.dislikeCount >= 2 ? "negative" : "mixed";
  }
  if (input.dislikeCount > 0 && input.makeAgainCount > 0) return "mixed";
  if (input.favoriteCount > 0 || input.makeAgainCount >= 2) return "strong";
  if (input.makeAgainCount === 1 || input.okayCount > 0) return "positive";
  if (input.unknownCount === input.consideredCount) return "unknown";
  return "neutral";
}

function buildAnonymousExplanations(input: {
  makeAgainCount: number;
  dislikeCount: number;
  favoriteCount: number;
  okayCount: number;
  unknownCount: number;
  hasConflict: boolean;
}): string[] {
  const lines: string[] = [];
  if (input.favoriteCount > 0) {
    lines.push(
      input.favoriteCount === 1
        ? "One attending member marked it as a favorite"
        : `${input.favoriteCount} attending members marked it as a favorite`,
    );
  }
  if (input.makeAgainCount > 0 && input.favoriteCount === 0) {
    lines.push(
      input.makeAgainCount === 1
        ? "One attending member marked it “would make again”"
        : `${input.makeAgainCount} attending members marked it “would make again”`,
    );
  }
  if (input.dislikeCount > 0) {
    lines.push(
      input.dislikeCount === 1
        ? "One attending member marked this “would not choose again.”"
        : `${input.dislikeCount} attending members marked this “would not choose again.”`,
    );
  }
  if (input.hasConflict) {
    lines.push("Preference fit: Mixed (conflicting attendee feedback)");
  } else if (input.makeAgainCount > 0 && input.dislikeCount === 0) {
    // positive already covered
  } else if (input.okayCount > 0 && input.makeAgainCount === 0) {
    lines.push("Attending members rated it okay");
  }
  return lines;
}

/**
 * Strip any accidental identity from explanation/warning payloads before
 * persisting or returning to organizers who did not receive opt-in shares.
 */
export function projectPrivatePreferenceExplanations(
  aggregate: PreferenceAggregate,
  includeNamedOptIns = false,
): { reasons: string[]; warnings: string[]; preferenceFit: PreferenceFitSummary } {
  const reasons = [...aggregate.explanationLines];
  const warnings: string[] = [];
  if (aggregate.dislikeCount > 0) {
    warnings.push(
      aggregate.dislikeCount === 1
        ? "One attending member marked this “would not choose again.”"
        : `${aggregate.dislikeCount} attending members marked this “would not choose again.”`,
    );
  }
  if (aggregate.hasConflict) {
    warnings.push("Preference fit: Mixed");
  }
  if (includeNamedOptIns) {
    reasons.push(...aggregate.namedLines);
  }
  // Ensure no raw membership ids leaked into lines
  const scrub = (s: string) =>
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(s)
      ? "An attending member shared preference feedback."
      : s;
  return {
    reasons: reasons.map(scrub),
    warnings: warnings.map(scrub),
    preferenceFit: aggregate.preferenceFit,
  };
}
