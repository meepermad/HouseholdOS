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
    .select("id, question, status, allow_multiple, anonymous")
    .eq("household_id", householdId)
    .eq("id", pollId)
    .maybeSingle();
  if (!poll) notFound();

  const { data: options } = await supabase
    .from("household_poll_options")
    .select("id, label, sort_order")
    .eq("poll_id", pollId)
    .order("sort_order");
  const opts = options ?? [];

  const { data: votes } = await supabase
    .from("household_poll_votes")
    .select("option_id")
    .eq("poll_id", pollId);
  const voteRows = votes ?? [];
  const tallies = Object.fromEntries(
    opts.map((o) => [o.id, voteRows.filter((v) => v.option_id === o.id).length]),
  );

  return (
    <main className="space-y-4" data-testid="poll-detail">
      <h1 className="font-[family-name:var(--font-display)] text-2xl">
        {poll.question}
      </h1>
      <p className="text-xs text-text-muted">
        Results are coordination inputs only — they do not change permissions or
        finances.
      </p>

      <ul className="space-y-2">
        {opts.map((o) => (
          <li
            key={o.id}
            className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm"
          >
            <span>{o.label}</span>
            <span className="tabular-nums text-text-muted">
              {tallies[o.id] ?? 0}
            </span>
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
          <SubmitButton>Submit vote</SubmitButton>
        </ActionForm>
      ) : null}
    </main>
  );
}
