import { notFound } from "next/navigation";
import { assertActiveMembership } from "@/lib/household-context";
import { createClient } from "@/lib/supabase/server";
import { ActionForm } from "@/components/action-form";
import { votePollAction } from "@/app/actions/ux-c";
import { SubmitButton } from "@/components/ui/submit-button";

export const dynamic = "force-dynamic";

export default async function PollDetailPage({
  params,
}: {
  params: Promise<{ householdId: string; pollId: string }>;
}) {
  const { householdId, pollId } = await params;
  await assertActiveMembership(householdId);
  const supabase = await createClient();
  const { data: poll } = await supabase
    .from("household_polls")
    .select("id, question, status, allow_multiple, anonymous, deadline_at")
    .eq("household_id", householdId)
    .eq("id", pollId)
    .maybeSingle();
  if (!poll) notFound();

  const { data: tallies } = await supabase.rpc("poll_option_tallies", {
    p_poll_id: pollId,
  });
  const { data: hasVoted } = await supabase.rpc("poll_current_member_has_voted", {
    p_poll_id: pollId,
  });

  const opts = (tallies ?? []).map((row) => ({
    id: row.option_id,
    label: row.label,
    count: Number(row.vote_count ?? 0),
  }));

  return (
    <main className="space-y-4" data-testid="poll-detail">
      <h1 className="font-[family-name:var(--font-display)] text-2xl">
        {poll.question}
      </h1>
      <p className="text-xs text-text-muted">
        Results are coordination inputs only — they do not change permissions or
        finances.
        {poll.anonymous
          ? " This poll is anonymous: only aggregate counts are shown."
          : ""}
        {hasVoted ? " You have already responded." : ""}
      </p>

      <ul className="space-y-2" data-testid="poll-tallies">
        {opts.map((o) => (
          <li
            key={o.id}
            className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm"
          >
            <span>{o.label}</span>
            <span className="tabular-nums text-text-muted">{o.count}</span>
          </li>
        ))}
      </ul>

      {poll.status === "open" ? (
        <ActionForm
          action={votePollAction}
          className="space-y-3"
          pendingLabel="Saving vote…"
        >
          <input type="hidden" name="householdId" value={householdId} />
          <input type="hidden" name="pollId" value={pollId} />
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Your response</legend>
            {opts.map((o) => (
              <label key={o.id} className="flex min-h-11 items-center gap-2 text-sm">
                <input
                  type={poll.allow_multiple ? "checkbox" : "radio"}
                  name="optionId"
                  value={o.id}
                />
                {o.label}
              </label>
            ))}
          </fieldset>
          <SubmitButton>{hasVoted ? "Replace vote" : "Submit vote"}</SubmitButton>
        </ActionForm>
      ) : null}
    </main>
  );
}
