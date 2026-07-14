export const AUDIT_ACTIONS = [
  "household.created",
  "household.updated",
  "household.archived",
  "member.invited",
  "member.joined",
  "member.role_changed",
  "member.removed",
  "member.left",
  "invite.revoked",
  "settings.updated",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export type AuditEventInput = {
  householdId: string;
  actorUserId: string;
  entityType: string;
  entityId: string;
  action: AuditAction;
  beforeState?: Record<string, unknown> | null;
  afterState?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
};

export function buildAuditRow(input: AuditEventInput) {
  return {
    household_id: input.householdId,
    actor_user_id: input.actorUserId,
    entity_type: input.entityType,
    entity_id: input.entityId,
    action: input.action,
    before_state: (input.beforeState ?? null) as import("@/types/database").Json | null,
    after_state: (input.afterState ?? null) as import("@/types/database").Json | null,
    metadata: (input.metadata ?? null) as import("@/types/database").Json | null,
  };
}
