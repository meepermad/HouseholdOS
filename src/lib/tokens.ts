import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { Json } from "@/types/database";

export function generateInviteToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function isInvitationExpired(expiresAt: string | Date, now = new Date()): boolean {
  const expiry = typeof expiresAt === "string" ? new Date(expiresAt) : expiresAt;
  return expiry.getTime() <= now.getTime();
}

export function invitationExpiresAt(ttlHours: number, now = new Date()): Date {
  return new Date(now.getTime() + ttlHours * 60 * 60 * 1000);
}

export type AuditInsert = {
  household_id: string | null;
  actor_user_id: string | null;
  entity_type: string;
  entity_id: string;
  event_type: string;
  before_state?: Json | null;
  after_state?: Json | null;
  reason?: string | null;
  correlation_id?: string | null;
};

export function buildAuditRow(input: {
  householdId?: string | null;
  actorUserId?: string | null;
  entityType: string;
  entityId: string;
  eventType: string;
  beforeState?: Json | null;
  afterState?: Json | null;
  reason?: string | null;
  correlationId?: string | null;
}): AuditInsert {
  // Never accept secrets in audit payloads — callers must redact.
  return {
    household_id: input.householdId ?? null,
    actor_user_id: input.actorUserId ?? null,
    entity_type: input.entityType,
    entity_id: input.entityId,
    event_type: input.eventType,
    before_state: input.beforeState ?? null,
    after_state: input.afterState ?? null,
    reason: input.reason ?? null,
    correlation_id: input.correlationId ?? randomUUID(),
  };
}

/** Legacy alias used by older call sites during migration. */
export function buildAuditRowLegacy(input: {
  householdId: string;
  actorUserId: string;
  entityType: string;
  entityId: string;
  action: string;
  beforeState?: Json | null;
  afterState?: Json | null;
  metadata?: Json | null;
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
