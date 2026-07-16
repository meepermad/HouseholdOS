import type { ChoreOccurrenceView } from "@/lib/chores/queries";
import { ChoreBoard } from "./ChoreBoard";

export function MyChoresList({ householdId, chores }: { householdId: string; chores: ChoreOccurrenceView[] }) {
  return <ChoreBoard householdId={householdId} chores={chores} />;
}
