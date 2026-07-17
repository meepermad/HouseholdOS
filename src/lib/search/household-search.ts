import "server-only";
import { createClient } from "@/lib/supabase/server";

export type SearchDomain =
  | "calendar"
  | "chores"
  | "expenses"
  | "inventory"
  | "supplies"
  | "pantry"
  | "shopping"
  | "meals"
  | "recipes"
  | "maintenance"
  | "governance"
  | "responsibilities";

export type SearchHit = {
  id: string;
  domain: SearchDomain;
  title: string;
  snippet: string;
  href: string;
};

export type GroupedSearchResults = Partial<Record<SearchDomain, SearchHit[]>>;

function clip(value: string | null | undefined, max = 120): string {
  if (!value) return "";
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

function matchQuery(haystack: string, query: string): boolean {
  return haystack.toLowerCase().includes(query.toLowerCase());
}

/** Authorized cross-domain search. Uses the user-scoped client only (RLS). */
export async function searchHousehold(
  householdId: string,
  rawQuery: string,
): Promise<GroupedSearchResults> {
  const query = rawQuery.trim();
  if (query.length < 2) return {};

  const supabase = await createClient();
  const grouped: GroupedSearchResults = {};
  const pattern = `%${query.replace(/%/g, "")}%`;

  async function add(
    domain: SearchDomain,
    hits: SearchHit[],
  ) {
    if (hits.length === 0) return;
    grouped[domain] = hits.slice(0, 8);
  }

  try {
    const { data } = await supabase
      .from("calendar_events")
      .select("id, title, description")
      .eq("household_id", householdId)
      .or(`title.ilike.${pattern},description.ilike.${pattern}`)
      .limit(8);
    await add(
      "calendar",
      (data ?? [])
        .filter((r) => matchQuery(`${r.title} ${r.description ?? ""}`, query))
        .map((r) => ({
          id: r.id,
          domain: "calendar" as const,
          title: r.title,
          snippet: clip(r.description),
          href: `/app/${householdId}/calendar/events/${r.id}`,
        })),
    );
  } catch {
    /* degrade */
  }

  try {
    const { data } = await supabase
      .from("chore_definitions")
      .select("id, title, description")
      .eq("household_id", householdId)
      .ilike("title", pattern)
      .limit(8);
    await add(
      "chores",
      (data ?? []).map((r) => ({
        id: r.id,
        domain: "chores" as const,
        title: r.title,
        snippet: clip(r.description),
        href: `/app/${householdId}/chores`,
      })),
    );
  } catch {
    /* degrade */
  }

  try {
    const { data } = await supabase
      .from("expenses")
      .select("id, merchant, description")
      .eq("household_id", householdId)
      .or(`merchant.ilike.${pattern},description.ilike.${pattern}`)
      .limit(8);
    await add(
      "expenses",
      (data ?? []).map((r) => ({
        id: r.id,
        domain: "expenses" as const,
        title: r.merchant || "Expense",
        snippet: clip(r.description),
        href: `/app/${householdId}/money/expenses/${r.id}`,
      })),
    );
  } catch {
    /* degrade */
  }

  try {
    const { data } = await supabase
      .from("inventory_items")
      .select("id, name, description")
      .eq("household_id", householdId)
      .ilike("name", pattern)
      .limit(8);
    await add(
      "inventory",
      (data ?? []).map((r) => ({
        id: r.id,
        domain: "inventory" as const,
        title: r.name,
        snippet: clip(r.description),
        href: `/app/${householdId}/house/inventory/${r.id}`,
      })),
    );
  } catch {
    /* degrade */
  }

  try {
    const { data } = await supabase
      .from("supply_items")
      .select("id, name, notes")
      .eq("household_id", householdId)
      .ilike("name", pattern)
      .limit(8);
    await add(
      "supplies",
      (data ?? []).map((r) => ({
        id: r.id,
        domain: "supplies" as const,
        title: r.name,
        snippet: clip(r.notes),
        href: `/app/${householdId}/house/supplies/${r.id}`,
      })),
    );
  } catch {
    /* degrade */
  }

  try {
    const { data } = await supabase
      .from("maintenance_requests")
      .select("id, title, description")
      .eq("household_id", householdId)
      .ilike("title", pattern)
      .limit(8);
    await add(
      "maintenance",
      (data ?? []).map((r) => ({
        id: r.id,
        domain: "maintenance" as const,
        title: r.title,
        snippet: clip(r.description),
        href: `/app/${householdId}/maintenance/${r.id}`,
      })),
    );
  } catch {
    /* degrade */
  }

  try {
    const { data } = await supabase
      .from("governance_documents")
      .select("id, title, summary")
      .eq("household_id", householdId)
      .ilike("title", pattern)
      .limit(8);
    await add(
      "governance",
      (data ?? []).map((r) => ({
        id: r.id,
        domain: "governance" as const,
        title: r.title,
        snippet: clip((r as { summary?: string }).summary),
        href: `/app/${householdId}/governance/documents/${r.id}`,
      })),
    );
  } catch {
    /* degrade */
  }

  try {
    const { data } = await supabase
      .from("responsibility_areas")
      .select("id, name, description")
      .eq("household_id", householdId)
      .ilike("name", pattern)
      .limit(8);
    await add(
      "responsibilities",
      (data ?? []).map((r) => ({
        id: r.id,
        domain: "responsibilities" as const,
        title: r.name,
        snippet: clip(r.description),
        href: `/app/${householdId}/responsibilities/${r.id}`,
      })),
    );
  } catch {
    /* degrade */
  }

  return grouped;
}

export function groupSearchDomains(
  grouped: GroupedSearchResults,
): { domain: SearchDomain; hits: SearchHit[] }[] {
  const order: SearchDomain[] = [
    "calendar",
    "chores",
    "responsibilities",
    "expenses",
    "inventory",
    "supplies",
    "pantry",
    "shopping",
    "meals",
    "recipes",
    "maintenance",
    "governance",
  ];
  return order
    .filter((d) => (grouped[d]?.length ?? 0) > 0)
    .map((domain) => ({ domain, hits: grouped[domain]! }));
}
