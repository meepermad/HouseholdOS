"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/app/actions/auth";
import { assertActiveMembership } from "@/lib/household-context";
import { toPublicErrorMessage } from "@/lib/errors";
import type { SetupStepKey, SetupStepStatus } from "@/lib/setup/steps";
import {
  PANTRY_TEMPLATES,
  RESPONSIBILITY_TEMPLATES,
  SUPPLY_TEMPLATES,
} from "@/lib/setup/templates";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UntypedDb = any;

async function db(householdId: string) {
  const ctx = await assertActiveMembership(householdId);
  const { createClient } = await import("@/lib/supabase/server");
  return { ctx, supabase: (await createClient()) as UntypedDb };
}

function invalidate(householdId: string) {
  revalidatePath(`/app/${householdId}`);
  revalidatePath(`/app/${householdId}/setup`);
  revalidatePath(`/app/${householdId}/settings`);
}

export async function ensureSetupProgressAction(
  householdId: string,
): Promise<ActionResult & { progress?: unknown }> {
  try {
    const { supabase } = await db(householdId);
    const { data, error } = await supabase.rpc("ensure_household_setup_progress", {
      p_household_id: householdId,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, message: "Setup loaded.", progress: data };
  } catch (e) {
    return { ok: false, error: toPublicErrorMessage(e) };
  }
}

export async function updateSetupStepAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const householdId = String(formData.get("householdId") ?? "");
    const step = String(formData.get("step") ?? "") as SetupStepKey;
    const status = String(formData.get("status") ?? "") as SetupStepStatus;
    const { supabase } = await db(householdId);
    const { error } = await supabase.rpc("update_household_setup_step", {
      p_household_id: householdId,
      p_step: step,
      p_status: status,
      p_draft: null,
    });
    if (error) return { ok: false, error: error.message };
    invalidate(householdId);
    return { ok: true, message: "Progress saved." };
  } catch (e) {
    return { ok: false, error: toPublicErrorMessage(e) };
  }
}

export async function dismissSetupAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const householdId = String(formData.get("householdId") ?? "");
    const { supabase } = await db(householdId);
    const { error } = await supabase.rpc("dismiss_household_setup", {
      p_household_id: householdId,
    });
    if (error) return { ok: false, error: error.message };
    invalidate(householdId);
    return { ok: true, message: "Setup reminder dismissed." };
  } catch (e) {
    return { ok: false, error: toPublicErrorMessage(e) };
  }
}

export async function completeSetupAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const householdId = String(formData.get("householdId") ?? "");
    const { supabase } = await db(householdId);
    const { error } = await supabase.rpc("complete_household_setup", {
      p_household_id: householdId,
    });
    if (error) return { ok: false, error: error.message };
    invalidate(householdId);
    return { ok: true, message: "Setup marked complete." };
  } catch (e) {
    return { ok: false, error: toPublicErrorMessage(e) };
  }
}

export async function applyResponsibilityTemplatesAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const householdId = String(formData.get("householdId") ?? "");
    const selected = formData.getAll("templateKey").map(String);
    const { supabase } = await db(householdId);
    let created = 0;
    for (const tpl of RESPONSIBILITY_TEMPLATES) {
      if (!selected.includes(tpl.key)) continue;
      const { error } = await supabase.rpc("create_responsibility_area", {
        p_household_id: householdId,
        p_name: tpl.name,
        p_category: tpl.category,
        p_start_date: new Date().toISOString().slice(0, 10),
        p_description: tpl.description,
        p_handoff_expectations: null,
      });
      if (!error) created += 1;
    }
    await supabase.rpc("update_household_setup_step", {
      p_household_id: householdId,
      p_step: "responsibilities",
      p_status: "completed",
      p_draft: null,
    });
    invalidate(householdId);
    return { ok: true, message: `Added ${created} responsibility areas.` };
  } catch (e) {
    return { ok: false, error: toPublicErrorMessage(e) };
  }
}

export async function applySupplyTemplatesAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const householdId = String(formData.get("householdId") ?? "");
    const selected = formData.getAll("templateKey").map(String);
    const { supabase } = await db(householdId);
    let created = 0;
    for (const tpl of SUPPLY_TEMPLATES) {
      if (!selected.includes(tpl.key)) continue;
      const { error } = await supabase.rpc("create_supply_item", {
        p_household_id: householdId,
        p_name: tpl.name,
        p_category: "cleaning",
        p_notes: null,
      });
      if (!error) created += 1;
    }
    for (const tpl of PANTRY_TEMPLATES) {
      if (!selected.includes(tpl.key)) continue;
      const { error } = await supabase.rpc("create_pantry_item", {
        p_household_id: householdId,
        p_name: tpl.name,
        p_category: "staple",
        p_notes: null,
      });
      if (!error) created += 1;
    }
    await supabase.rpc("update_household_setup_step", {
      p_household_id: householdId,
      p_step: "pantry_supplies",
      p_status: "completed",
      p_draft: null,
    });
    invalidate(householdId);
    return { ok: true, message: `Added ${created} pantry/supply items.` };
  } catch (e) {
    return { ok: false, error: toPublicErrorMessage(e) };
  }
}
