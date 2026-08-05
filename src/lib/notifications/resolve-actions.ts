import "server-only";

import { logServerError } from "@/lib/errors";

/** Entity types used by `notification_events.entity_type`. */
export type ResolvableEntityType =
  | "payment"
  | "expense"
  | "reimbursement_dispute"
  | "reimbursement_obligation"
  | "chore_occurrence"
  | "maintenance_request";

/**
 * Clears the caller's unread action-oriented notifications for one entity after
 * they complete the underlying action, so the inbox stops asking for something
 * that is already done.
 *
 * Best-effort by design: a failure here must never fail the domain mutation
 * that already committed.
 */
export async function resolveActionNotifications(
  entityType: ResolvableEntityType,
  entityId: string,
): Promise<void> {
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).rpc(
      "resolve_action_notifications",
      { p_entity_type: entityType, p_entity_id: entityId },
    );
    if (error) {
      logServerError("resolveActionNotifications", error, {
        entityType,
        entityId,
      });
    }
  } catch (error) {
    logServerError("resolveActionNotifications", error, {
      entityType,
      entityId,
    });
  }
}
