"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/app/actions/auth";
import { assertActiveMembership } from "@/lib/household-context";
import { toPublicErrorMessage } from "@/lib/errors";
import {
  sanitizeCommentBody,
  type CommentParentType,
} from "@/lib/comments/types";
import { createClient } from "@/lib/supabase/server";

export async function addRecordCommentAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const householdId = String(formData.get("householdId") ?? "");
    const parentType = String(formData.get("parentType") ?? "") as CommentParentType;
    const parentId = String(formData.get("parentId") ?? "");
    const body = sanitizeCommentBody(String(formData.get("body") ?? ""));
    if (!body) return { ok: false, error: "Comment cannot be empty." };

    let mentions: string[] = [];
    try {
      const parsed = JSON.parse(String(formData.get("mentions") ?? "[]"));
      if (Array.isArray(parsed)) mentions = parsed.map(String);
    } catch {
      mentions = [];
    }

    await assertActiveMembership(householdId);
    const supabase = await createClient();
    const { error } = await supabase.rpc("add_record_comment", {
      p_household_id: householdId,
      p_parent_type: parentType,
      p_parent_id: parentId,
      p_body: body,
      p_mentioned_membership_ids: mentions,
    });
    if (error) return { ok: false, error: error.message };
    revalidatePath(`/app/${householdId}`);
    return { ok: true, message: "Comment added." };
  } catch (e) {
    return { ok: false, error: toPublicErrorMessage(e) };
  }
}

export async function editRecordCommentAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const householdId = String(formData.get("householdId") ?? "");
    const commentId = String(formData.get("commentId") ?? "");
    const body = sanitizeCommentBody(String(formData.get("body") ?? ""));
    await assertActiveMembership(householdId);
    const supabase = await createClient();
    const { error } = await supabase.rpc("edit_record_comment", {
      p_comment_id: commentId,
      p_body: body,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, message: "Comment updated." };
  } catch (e) {
    return { ok: false, error: toPublicErrorMessage(e) };
  }
}

export async function softDeleteRecordCommentAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const householdId = String(formData.get("householdId") ?? "");
    const commentId = String(formData.get("commentId") ?? "");
    await assertActiveMembership(householdId);
    const supabase = await createClient();
    const { error } = await supabase.rpc("soft_delete_record_comment", {
      p_comment_id: commentId,
    });
    if (error) return { ok: false, error: error.message };
    revalidatePath(`/app/${householdId}`);
    return { ok: true, message: "Comment deleted." };
  } catch (e) {
    return { ok: false, error: toPublicErrorMessage(e) };
  }
}
