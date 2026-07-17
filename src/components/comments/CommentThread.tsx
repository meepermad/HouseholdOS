"use client";

import { useState, useTransition } from "react";
import { addRecordCommentAction } from "@/app/actions/comments";
import type { CommentParentType } from "@/lib/comments/types";

export type CommentView = {
  id: string;
  body: string;
  authorLabel: string;
  createdAt: string;
  canEdit: boolean;
};

type Props = {
  householdId: string;
  parentType: CommentParentType;
  parentId: string;
  comments: CommentView[];
};

export function CommentThread({
  householdId,
  parentType,
  parentId,
  comments: initial,
}: Props) {
  const [comments, setComments] = useState(initial);
  const [body, setBody] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <section className="space-y-3" data-testid="comment-thread" aria-label="Comments">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">
        Comments
      </h2>
      <ul className="space-y-2">
        {comments.length === 0 ? (
          <li className="text-sm text-text-secondary">No comments yet.</li>
        ) : (
          comments.map((c) => (
            <li key={c.id} className="rounded-md border border-border px-3 py-2 text-sm">
              <p className="text-xs text-text-muted">
                {c.authorLabel} · {new Date(c.createdAt).toLocaleString()}
              </p>
              <p className="mt-1 text-text-primary whitespace-pre-wrap">{c.body}</p>
            </li>
          ))
        )}
      </ul>
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          const text = body.trim();
          if (!text) return;
          startTransition(async () => {
            const fd = new FormData();
            fd.set("householdId", householdId);
            fd.set("parentType", parentType);
            fd.set("parentId", parentId);
            fd.set("body", text);
            fd.set("mentions", "[]");
            const res = await addRecordCommentAction(null, fd);
            if (res.ok) {
              setComments((prev) => [
                ...prev,
                {
                  id: crypto.randomUUID(),
                  body: text,
                  authorLabel: "You",
                  createdAt: new Date().toISOString(),
                  canEdit: true,
                },
              ]);
              setBody("");
              setMessage("Comment added.");
            } else {
              setMessage(res.error ?? "Could not add comment.");
            }
          });
        }}
      >
        <label className="block text-sm">
          Add a comment
          <textarea
            className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
            rows={3}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={4000}
            data-testid="comment-body"
          />
        </label>
        <button
          type="submit"
          disabled={pending || !body.trim()}
          className="inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
          data-testid="comment-submit"
        >
          Post comment
        </button>
      </form>
      {message ? (
        <p className="text-sm text-text-secondary" role="status">
          {message}
        </p>
      ) : null}
    </section>
  );
}
