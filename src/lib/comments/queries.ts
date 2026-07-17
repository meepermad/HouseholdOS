import "server-only";

import { createClient } from "@/lib/supabase/server";
import { listActiveMemberOptions } from "@/lib/expenses/queries";
import { canEditComment, type CommentParentType } from "@/lib/comments/types";
import type { CommentView } from "@/components/comments/CommentThread";

export async function listRecordComments(params: {
  householdId: string;
  parentType: CommentParentType;
  parentId: string;
  actorMembershipId: string;
}): Promise<CommentView[]> {
  const supabase = await createClient();
  const [{ data, error }, members] = await Promise.all([
    supabase
      .from("record_comments")
      .select("id, body, created_at, author_membership_id")
      .eq("household_id", params.householdId)
      .eq("parent_type", params.parentType)
      .eq("parent_id", params.parentId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .limit(100),
    listActiveMemberOptions(params.householdId),
  ]);
  if (error) throw error;

  const label = (id: string) =>
    members.find((m) => m.id === id)?.label ?? id.slice(0, 8);

  return (data ?? []).map((row) => ({
    id: row.id,
    body: row.body,
    authorLabel: label(row.author_membership_id),
    createdAt: row.created_at,
    canEdit: canEditComment(
      row.author_membership_id,
      params.actorMembershipId,
      new Date(row.created_at),
    ),
  }));
}
