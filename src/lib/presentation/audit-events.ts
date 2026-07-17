/**
 * Human-readable audit / activity event labels.
 * Prefer actor-aware phrasing when an actor display name is provided.
 */

const EVENT_TEMPLATES: Record<
  string,
  { you: string; other: string; generic: string }
> = {
  "recipe.import_cancelled": {
    you: "You cancelled a recipe import",
    other: "{actor} cancelled a recipe import",
    generic: "A recipe import was cancelled",
  },
  "recipe.import_extracted": {
    you: "You imported recipe details",
    other: "{actor} imported recipe details",
    generic: "Recipe details were imported",
  },
  "shopping.list_created": {
    you: "You created a shopping list",
    other: "{actor} created a shopping list",
    generic: "A shopping list was created",
  },
  "expense.created": {
    you: "You added an expense",
    other: "{actor} added an expense",
    generic: "An expense was added",
  },
  "payment.submitted": {
    you: "You submitted a payment",
    other: "{actor} submitted a payment",
    generic: "A payment was submitted",
  },
  "payment.confirmed": {
    you: "You confirmed a payment",
    other: "{actor} confirmed a payment",
    generic: "A payment was confirmed",
  },
  "chore.completed": {
    you: "You completed a chore",
    other: "{actor} completed a chore",
    generic: "A chore was completed",
  },
  "chore.created": {
    you: "You created a chore",
    other: "{actor} created a chore",
    generic: "A chore was created",
  },
  "calendar.event_created": {
    you: "You created a calendar event",
    other: "{actor} created a calendar event",
    generic: "A calendar event was created",
  },
  "maintenance.request_created": {
    you: "You reported a maintenance issue",
    other: "{actor} reported a maintenance issue",
    generic: "A maintenance issue was reported",
  },
  "governance.document_published": {
    you: "You published a household document",
    other: "{actor} published a household document",
    generic: "A household document was published",
  },
  "membership.joined": {
    you: "You joined the household",
    other: "{actor} joined the household",
    generic: "Someone joined the household",
  },
};

function titleCaseFromSnake(value: string): string {
  return value
    .replace(/[._]/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatAuditEventLabel(
  eventType: string,
  options?: {
    actorName?: string | null;
    isCurrentUser?: boolean;
  },
): string {
  const template = EVENT_TEMPLATES[eventType];
  if (!template) {
    return titleCaseFromSnake(eventType);
  }
  if (options?.isCurrentUser) return template.you;
  if (options?.actorName) {
    return template.other.replace("{actor}", options.actorName);
  }
  return template.generic;
}

export function formatRelativeTimestamp(
  iso: string,
  now: Date = new Date(),
): string {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return "";
  const diffMs = now.getTime() - then.getTime();
  const abs = Math.abs(diffMs);
  const minutes = Math.round(abs / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return then.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
