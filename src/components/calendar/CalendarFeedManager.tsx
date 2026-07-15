"use client";

import { useActionState, useState } from "react";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  createCalendarFeedAction,
  regenerateCalendarFeedAction,
  revokeCalendarFeedAction,
} from "@/app/actions/calendar";
import { FEED_SCOPES } from "@/lib/calendar/feed-token";
import type { ActionResult } from "@/app/actions/auth";
import type { CalendarFeedTokenSummary } from "@/lib/calendar/queries";

const SCOPE_LABELS: Record<string, string> = {
  visible_to_me: "Everything I can see",
  household_public_only: "Household-visible events only",
};

function FeedUrlReveal({ feedUrl }: { feedUrl: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(feedUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="space-y-2 rounded-md border border-border-strong bg-surface-secondary p-3">
      <p className="text-sm font-medium text-text-primary">
        Copy this URL now — it is shown only once.
      </p>
      <div className="flex gap-2">
        <input
          readOnly
          value={feedUrl}
          onFocus={(e) => e.currentTarget.select()}
          className="min-h-11 w-full rounded-md border border-border bg-input-bg px-3 py-2 font-mono text-xs text-text-primary"
          aria-label="Calendar feed URL"
        />
        <button
          type="button"
          onClick={copy}
          className="inline-flex min-h-11 shrink-0 items-center rounded-md border border-border bg-surface px-3 text-sm font-medium text-text-secondary hover:bg-surface-interactive"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <SubscribeInstructions />
    </div>
  );
}

function SubscribeInstructions() {
  return (
    <details className="text-sm text-text-secondary">
      <summary className="cursor-pointer font-medium text-text-primary">
        How to subscribe
      </summary>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        <li>
          <span className="font-medium">Apple Calendar:</span> File → New Calendar
          Subscription, then paste the URL.
        </li>
        <li>
          <span className="font-medium">Google Calendar:</span> Other calendars →
          From URL, then paste the URL.
        </li>
        <li>
          <span className="font-medium">LifeOS / other apps:</span> add a new
          subscribed / read-only calendar and paste the URL.
        </li>
      </ul>
      <p className="mt-2 text-xs text-text-muted">
        Feeds are read-only. Your calendar app controls how often it refreshes.
      </p>
    </details>
  );
}

function CreateFeedForm({ householdId }: { householdId: string }) {
  const [state, formAction, pending] = useActionState<
    ActionResult | null,
    FormData
  >(createCalendarFeedAction, null);

  const feedUrl = state?.ok ? state.data?.feedUrl : undefined;

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="householdId" value={householdId} />
      <label className="block text-sm font-medium text-text-primary">
        Feed name
        <input
          name="label"
          defaultValue="Personal calendar feed"
          maxLength={120}
          className="mt-1 min-h-11 w-full rounded-md border border-border bg-input-bg px-3 py-2 text-sm"
        />
      </label>
      <label className="block text-sm font-medium text-text-primary">
        Include
        <select
          name="scope"
          defaultValue="visible_to_me"
          className="mt-1 min-h-11 w-full rounded-md border border-border bg-input-bg px-3 py-2 text-sm"
        >
          {FEED_SCOPES.map((s) => (
            <option key={s} value={s}>
              {SCOPE_LABELS[s] ?? s}
            </option>
          ))}
        </select>
      </label>
      <SubmitButton pendingLabel="Creating feed…" disabled={pending}>
        Create feed
      </SubmitButton>
      {state && !state.ok ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
      {feedUrl ? <FeedUrlReveal feedUrl={feedUrl} /> : null}
    </form>
  );
}

function FeedRow({
  householdId,
  feed,
}: {
  householdId: string;
  feed: CalendarFeedTokenSummary;
}) {
  const [regenState, regenAction] = useActionState<ActionResult | null, FormData>(
    regenerateCalendarFeedAction,
    null,
  );
  const [revokeState, revokeAction] = useActionState<
    ActionResult | null,
    FormData
  >(revokeCalendarFeedAction, null);

  const newUrl = regenState?.ok ? regenState.data?.feedUrl : undefined;
  const revoked = Boolean(feed.revokedAt) || Boolean(revokeState?.ok);

  return (
    <li className="space-y-3 rounded-md border border-border bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-text-primary">{feed.label}</p>
          <p className="text-xs text-text-muted">
            {SCOPE_LABELS[feed.scope] ?? feed.scope}
            {revoked ? " · Revoked" : " · Active"}
          </p>
          <p className="mt-1 text-xs text-text-muted">
            {feed.lastAccessedAt
              ? `Last used ${new Date(feed.lastAccessedAt).toLocaleDateString()}`
              : "Not used yet"}
          </p>
        </div>
        {!revoked ? (
          <div className="flex gap-2">
            <form action={regenAction}>
              <input type="hidden" name="householdId" value={householdId} />
              <input type="hidden" name="feedId" value={feed.id} />
              <button
                type="submit"
                className="inline-flex min-h-11 items-center rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-text-secondary hover:bg-surface-interactive"
                onClick={(e) => {
                  if (
                    !window.confirm(
                      "Regenerate this feed? The old URL stops working immediately.",
                    )
                  ) {
                    e.preventDefault();
                  }
                }}
              >
                Regenerate
              </button>
            </form>
            <form action={revokeAction}>
              <input type="hidden" name="householdId" value={householdId} />
              <input type="hidden" name="feedId" value={feed.id} />
              <button
                type="submit"
                className="inline-flex min-h-11 items-center rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-destructive hover:bg-surface-interactive"
                onClick={(e) => {
                  if (
                    !window.confirm(
                      "Revoke this feed? Any calendar app using it will stop syncing.",
                    )
                  ) {
                    e.preventDefault();
                  }
                }}
              >
                Revoke
              </button>
            </form>
          </div>
        ) : null}
      </div>
      {regenState && !regenState.ok ? (
        <p className="text-sm text-destructive" role="alert">
          {regenState.error}
        </p>
      ) : null}
      {newUrl ? <FeedUrlReveal feedUrl={newUrl} /> : null}
    </li>
  );
}

export function CalendarFeedManager({
  householdId,
  feeds,
}: {
  householdId: string;
  feeds: CalendarFeedTokenSummary[];
}) {
  return (
    <div className="space-y-6">
      <section className="space-y-3 rounded-md border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold text-text-primary">Create a feed</h2>
        <p className="text-sm text-text-secondary">
          Subscribe to your household events from Apple Calendar, Google Calendar,
          or another app. The link is a secret — treat it like a password.
        </p>
        <CreateFeedForm householdId={householdId} />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-text-primary">Your feeds</h2>
        {feeds.length === 0 ? (
          <p className="text-sm text-text-muted">No feeds yet.</p>
        ) : (
          <ul className="space-y-3">
            {feeds.map((feed) => (
              <FeedRow key={feed.id} householdId={householdId} feed={feed} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
