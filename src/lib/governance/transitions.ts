import type { TransitionStatus } from "./types";

const ALLOWED: Record<TransitionStatus, readonly TransitionStatus[]> = {
  draft: ["in_progress", "cancelled"],
  in_progress: ["blocked", "ready_to_complete", "cancelled"],
  blocked: ["in_progress", "cancelled"],
  ready_to_complete: ["completed", "cancelled", "in_progress"],
  completed: [],
  cancelled: [],
};

export function canAdvanceTransition(
  from: TransitionStatus,
  to: TransitionStatus,
): boolean {
  if (from === to) return true;
  return ALLOWED[from]?.includes(to) ?? false;
}

export function assertTransitionAdvance(
  from: TransitionStatus,
  to: TransitionStatus,
): void {
  // Completing must go through the explicit complete action in SQL.
  if (to === "completed" && from !== "ready_to_complete" && from !== "in_progress") {
    throw new Error(`Invalid transition status change: ${from} -> ${to}`);
  }
  if (!canAdvanceTransition(from, to) && to !== "completed") {
    throw new Error(`Invalid transition status change: ${from} -> ${to}`);
  }
}
