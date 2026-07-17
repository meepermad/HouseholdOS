export type CommentParentType =
  | "expense"
  | "payment_dispute"
  | "chore"
  | "maintenance_request"
  | "poll"
  | "governance_document"
  | "meal_request"
  | "shopping_list";

export const COMMENT_EDIT_WINDOW_MS = 15 * 60 * 1000;
export const COMMENT_MAX_LENGTH = 4000;

export type CommentAuthor = {
  membershipId: string;
};

export type CommentRecipientInput = {
  householdActiveMembershipIds: string[];
  authorMembershipId: string;
  mentionedMembershipIds: string[];
  parentParticipantIds?: string[];
};

/**
 * Who should receive a privacy-safe "new comment" notification.
 * Author is excluded. Mentions limited to active members.
 */
export function commentNotificationRecipients(
  input: CommentRecipientInput,
): string[] {
  const active = new Set(input.householdActiveMembershipIds);
  const recipients = new Set<string>();

  for (const id of input.mentionedMembershipIds) {
    if (active.has(id) && id !== input.authorMembershipId) {
      recipients.add(id);
    }
  }

  for (const id of input.parentParticipantIds ?? []) {
    if (active.has(id) && id !== input.authorMembershipId) {
      recipients.add(id);
    }
  }

  return [...recipients];
}

export function canEditComment(
  authorMembershipId: string,
  actorMembershipId: string,
  createdAt: Date,
  now: Date = new Date(),
): boolean {
  if (authorMembershipId !== actorMembershipId) return false;
  return now.getTime() - createdAt.getTime() <= COMMENT_EDIT_WINDOW_MS;
}

export function sanitizeCommentBody(body: string): string {
  return body.trim().slice(0, COMMENT_MAX_LENGTH);
}
