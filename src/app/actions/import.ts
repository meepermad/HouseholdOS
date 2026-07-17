"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/app/actions/auth";
import { assertActiveMembership } from "@/lib/household-context";
import { toPublicErrorMessage } from "@/lib/errors";
import { parseCsv, IMPORT_MAX_BYTES, IMPORT_MAX_ROWS } from "@/lib/import/csv";
import { autoMapColumns } from "@/lib/import/map-columns";
import { validateImportRows } from "@/lib/import/validate";
import type { ImportDomain } from "@/lib/import/domains";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UntypedDb = any;

async function db(householdId: string) {
  const ctx = await assertActiveMembership(householdId);
  const { createClient } = await import("@/lib/supabase/server");
  return { ctx, supabase: (await createClient()) as UntypedDb };
}

export async function createImportBatchAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult & { batchId?: string; preview?: unknown }> {
  try {
    const householdId = String(formData.get("householdId") ?? "");
    const domain = String(formData.get("domain") ?? "") as ImportDomain;
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return { ok: false, error: "Choose a CSV file." };
    }
    if (file.size > IMPORT_MAX_BYTES) {
      return { ok: false, error: "CSV file is too large." };
    }
    const text = await file.text();
    const { headers, rows } = parseCsv(text);
    if (headers.length === 0) {
      return { ok: false, error: "CSV has no header row." };
    }
    if (rows.length > IMPORT_MAX_ROWS) {
      return {
        ok: false,
        error: `CSV exceeds ${IMPORT_MAX_ROWS} data rows.`,
      };
    }

    const mapping = autoMapColumns(domain, headers);
    const validated = validateImportRows(domain, rows, mapping);
    const { supabase } = await db(householdId);
    const idempotencyKey = String(formData.get("idempotencyKey") ?? "") || null;

    const { data: batchId, error } = await supabase.rpc("create_import_batch", {
      p_household_id: householdId,
      p_domain: domain,
      p_file_name: file.name,
      p_idempotency_key: idempotencyKey,
    });
    if (error) return { ok: false, error: error.message };

    const payload = validated.map((r, i) => ({
      rowNumber: r.rowNumber,
      raw: Object.fromEntries(headers.map((h, idx) => [h, rows[i]?.[idx] ?? ""])),
      mapped: r.mapped,
      status: r.status,
      messages: r.messages,
    }));

    const { error: mapError } = await supabase.rpc("save_import_mapping", {
      p_batch_id: batchId,
      p_column_map: mapping,
      p_rows: payload,
    });
    if (mapError) return { ok: false, error: mapError.message };

    revalidatePath(`/app/${householdId}/settings/import`);
    return {
      ok: true,
      message: `Parsed ${validated.length} rows.`,
      batchId: String(batchId),
      preview: { headers, mapping, validated },
    };
  } catch (e) {
    return { ok: false, error: toPublicErrorMessage(e) };
  }
}

export async function confirmImportBatchAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const householdId = String(formData.get("householdId") ?? "");
    const batchId = String(formData.get("batchId") ?? "");
    const { supabase } = await db(householdId);

    await supabase.rpc("mark_import_batch_status", {
      p_batch_id: batchId,
      p_status: "executing",
      p_result_summary: null,
      p_error_summary: null,
    });

    const { data: batch } = await supabase
      .from("household_import_batches")
      .select("domain")
      .eq("id", batchId)
      .single();

    const { data: rows } = await supabase
      .from("household_import_rows")
      .select("id, mapped, status, row_number")
      .eq("batch_id", batchId)
      .in("status", ["valid", "warning"]);

    let imported = 0;
    let failed = 0;
    const domain = batch?.domain as ImportDomain;

    for (const row of rows ?? []) {
      const mapped = row.mapped as Record<string, string>;
      try {
        const ok = await executeMappedRow(supabase, householdId, domain, mapped);
        if (ok) imported += 1;
        else failed += 1;
      } catch {
        failed += 1;
      }
    }

    await supabase.rpc("mark_import_batch_status", {
      p_batch_id: batchId,
      p_status: failed > 0 && imported === 0 ? "failed" : "completed",
      p_result_summary: { imported, failed },
      p_error_summary: failed > 0 ? `${failed} rows failed` : null,
    });

    revalidatePath(`/app/${householdId}/settings/import`);
    revalidatePath(`/app/${householdId}/house`);
    return {
      ok: true,
      message: `Import finished: ${imported} imported, ${failed} failed.`,
    };
  } catch (e) {
    return { ok: false, error: toPublicErrorMessage(e) };
  }
}

async function executeMappedRow(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  householdId: string,
  domain: ImportDomain,
  mapped: Record<string, string>,
): Promise<boolean> {
  switch (domain) {
    case "inventory": {
      const { error } = await supabase.rpc("create_inventory_item", {
        p_household_id: householdId,
        p_name: mapped.name,
        p_category: mapped.category || "other",
        p_condition: mapped.condition || "unknown",
        p_description: mapped.notes || null,
      });
      return !error;
    }
    case "supplies": {
      const { error } = await supabase.rpc("create_supply_item", {
        p_household_id: householdId,
        p_name: mapped.name,
        p_category: "other",
        p_quantity: mapped.quantity ? Number(mapped.quantity) : null,
        p_quantity_unit: mapped.unit || "item",
        p_notes: mapped.notes || null,
      });
      return !error;
    }
    case "pantry": {
      const { error } = await supabase.rpc("create_pantry_item", {
        p_household_id: householdId,
        p_name: mapped.name,
        p_category: "other",
        p_visibility: "household",
        p_quantity_unit: mapped.unit || "item",
        p_notes: mapped.notes || null,
      });
      return !error;
    }
    case "shopping": {
      const { error } = await supabase.rpc("create_shopping_item", {
        p_household_id: householdId,
        p_name: mapped.name,
        p_quantity: mapped.quantity ? Number(mapped.quantity) : null,
        p_description: mapped.notes || null,
      });
      return !error;
    }
    case "responsibilities": {
      const { error } = await supabase.rpc("create_responsibility_area", {
        p_household_id: householdId,
        p_name: mapped.name,
        p_category: mapped.category || "other",
        p_start_date: new Date().toISOString().slice(0, 10),
        p_description: mapped.description || null,
        p_handoff_expectations: null,
      });
      return !error;
    }
    case "utilities": {
      const { error } = await supabase.from("household_utilities").insert({
        household_id: householdId,
        name: mapped.name,
        category: mapped.category || "other",
        due_day_of_month: mapped.due_day ? Number(mapped.due_day) : null,
        estimated_amount_cents: mapped.estimated_amount
          ? Math.round(Number(mapped.estimated_amount) * 100)
          : null,
      });
      return !error;
    }
    default:
      // chores / calendar_events need richer RPC signatures — mark skipped
      return false;
  }
}
