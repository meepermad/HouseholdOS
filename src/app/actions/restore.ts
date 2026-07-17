"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/app/actions/auth";
import { assertActiveMembership } from "@/lib/household-context";
import { can } from "@/lib/permissions";
import { toPublicErrorMessage } from "@/lib/errors";
import {
  parseHouseholdArchive,
  previewArchiveRestore,
  rowsForDomain,
  type RestoreDomain,
} from "@/lib/export/restore";
import { createClient } from "@/lib/supabase/server";

const DOMAINS: RestoreDomain[] = [
  "inventory",
  "supplies",
  "pantry",
  "shopping",
  "chores",
  "calendar",
  "utilities",
];

export async function previewRestoreArchiveAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const householdId = String(formData.get("householdId") ?? "");
    const ctx = await assertActiveMembership(householdId);
    if (!can(ctx.roles, "settings.update") && !can(ctx.roles, "household.update")) {
      return { ok: false, error: "Only coordinators can restore archives." };
    }
    const raw = String(formData.get("archiveJson") ?? "");
    const archive = parseHouseholdArchive(JSON.parse(raw));
    const preview = previewArchiveRestore(archive);
    return {
      ok: true,
      message: `Preview ready: ${preview.counts.inventory} inventory, ${preview.counts.supplies} supplies, ${preview.counts.pantry} pantry (financial data excluded).`,
      data: {
        sourceHouseholdId: preview.sourceHouseholdId,
        inventory: String(preview.counts.inventory),
        supplies: String(preview.counts.supplies),
        pantry: String(preview.counts.pantry),
        shopping: String(preview.counts.shopping),
        chores: String(preview.counts.chores),
        calendar: String(preview.counts.calendar),
        utilities: String(preview.counts.utilities),
      },
    };
  } catch (e) {
    return { ok: false, error: toPublicErrorMessage(e) };
  }
}

export async function restoreArchiveIntoHouseholdAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const householdId = String(formData.get("householdId") ?? "");
    const confirm = formData.get("confirmSafety") === "on" || formData.get("confirmSafety") === "true";
    if (!confirm) {
      return { ok: false, error: "Confirm that this is a selective nonfinancial restore." };
    }
    const ctx = await assertActiveMembership(householdId);
    if (!can(ctx.roles, "settings.update") && !can(ctx.roles, "household.update")) {
      return { ok: false, error: "Only coordinators can restore archives." };
    }

    const raw = String(formData.get("archiveJson") ?? "");
    const archive = parseHouseholdArchive(JSON.parse(raw));
    const selected = DOMAINS.filter((d) => formData.get(`domain_${d}`) === "on");
    if (selected.length === 0) {
      return { ok: false, error: "Select at least one nonfinancial domain." };
    }

    const supabase = await createClient();
    let created = 0;
    let failed = 0;

    for (const domain of selected) {
      for (const row of rowsForDomain(archive, domain)) {
        const ok = await restoreRow(supabase, householdId, domain, row);
        if (ok) created += 1;
        else failed += 1;
      }
    }

    revalidatePath(`/app/${householdId}`);
    revalidatePath(`/app/${householdId}/settings/import`);
    return {
      ok: true,
      message: `Restored ${created} records (${failed} skipped). Expenses and payments were not imported.`,
    };
  } catch (e) {
    return { ok: false, error: toPublicErrorMessage(e) };
  }
}

async function restoreRow(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  householdId: string,
  domain: RestoreDomain,
  row: Record<string, unknown>,
): Promise<boolean> {
  const name = String(row.name ?? row.title ?? "").trim();
  if (!name) return false;
  try {
    switch (domain) {
      case "inventory": {
        const { error } = await supabase.rpc("create_inventory_item", {
          p_household_id: householdId,
          p_name: name,
          p_category: String(row.category ?? "other"),
          p_condition: String(row.condition ?? "unknown"),
          p_description: row.description ? String(row.description) : undefined,
        });
        return !error;
      }
      case "supplies": {
        const { error } = await supabase.rpc("create_supply_item", {
          p_household_id: householdId,
          p_name: name,
          p_category: String(row.category ?? "other"),
          p_quantity: row.quantity != null ? Number(row.quantity) : undefined,
          p_quantity_unit: String(row.quantity_unit ?? "item"),
          p_notes: row.notes ? String(row.notes) : undefined,
        });
        return !error;
      }
      case "pantry": {
        const { error } = await supabase.rpc("create_pantry_item", {
          p_household_id: householdId,
          p_name: name,
          p_category: String(row.category ?? "other"),
          p_visibility: "household",
          p_quantity_unit: String(row.quantity_unit ?? "item"),
          p_notes: row.notes ? String(row.notes) : undefined,
        });
        return !error;
      }
      case "shopping": {
        const { error } = await supabase.rpc("create_shopping_item", {
          p_household_id: householdId,
          p_name: name,
          p_quantity: row.quantity != null ? Number(row.quantity) : undefined,
          p_description: row.description ? String(row.description) : undefined,
        });
        return !error;
      }
      case "chores": {
        const due = new Date();
        due.setDate(due.getDate() + 1);
        const { error } = await supabase.rpc("create_one_time_chore", {
          p_household_id: householdId,
          p_title: name,
          p_category: String(row.category ?? "other"),
          p_due_at: due.toISOString(),
          p_description: row.description ? String(row.description) : undefined,
        });
        return !error;
      }
      case "calendar": {
        const startsAt = String(row.starts_at ?? row.start ?? "");
        if (!startsAt) return false;
        const endsAt =
          String(row.ends_at ?? "") ||
          new Date(new Date(startsAt).getTime() + 3600000).toISOString();
        const { error } = await supabase.rpc("create_calendar_event", {
          p_household_id: householdId,
          p_title: name,
          p_starts_at: startsAt,
          p_ends_at: endsAt,
          p_category: "other",
          p_visibility: "household",
          p_time_zone: "America/Chicago",
          p_client_idempotency_key: `restore-${householdId}-${name}-${startsAt}`.slice(0, 120),
        });
        return !error;
      }
      case "utilities": {
        const { error } = await supabase.from("household_utilities").insert({
          household_id: householdId,
          name,
          category: String(row.category ?? "other"),
        });
        return !error;
      }
    }
  } catch {
    return false;
  }
}
