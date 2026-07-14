import { buildAuditRow, type AuditInsert } from "@/lib/tokens";

export { buildAuditRow, type AuditInsert };

/** @deprecated Prefer buildAuditRow with eventType */
export function buildAuditRowCompat(input: {
  householdId: string;
  actorUserId: string;
  entityType: string;
  entityId: string;
  action: string;
  beforeState?: AuditInsert["before_state"];
  afterState?: AuditInsert["after_state"];
  metadata?: AuditInsert["after_state"];
}): AuditInsert {
  return buildAuditRow({
    householdId: input.householdId,
    actorUserId: input.actorUserId,
    entityType: input.entityType,
    entityId: input.entityId,
    eventType: input.action,
    beforeState: input.beforeState,
    afterState: input.afterState ?? input.metadata,
  });
}
