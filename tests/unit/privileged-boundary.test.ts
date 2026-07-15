import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(process.cwd(), "src");

function walk(dir: string, files: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, files);
    else if (/\.(ts|tsx)$/.test(name)) files.push(full);
  }
  return files;
}

describe("privileged client containment", () => {
  it("does not import privileged client from app routes, actions, or components", () => {
    const forbiddenRoots = [
      join(ROOT, "app"),
      join(ROOT, "components"),
      join(ROOT, "lib", "payments"),
      join(ROOT, "lib", "expenses"),
    ];
    const offenders: string[] = [];
    for (const root of forbiddenRoots) {
      for (const file of walk(root)) {
        if (file.includes(`${join("lib", "supabase", "privileged")}`)) continue;
        const text = readFileSync(file, "utf8");
        if (
          text.includes("createPrivilegedClient") ||
          text.includes("createAdminClient") ||
          text.includes("@/lib/supabase/privileged")
        ) {
          offenders.push(file.replace(process.cwd(), ""));
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("hardening migration requires GUC + service_role, not bare null uid", () => {
    const hardening = readFileSync(
      join(
        process.cwd(),
        "supabase",
        "migrations",
        "20260716020000_phase3_hardening.sql",
      ),
      "utf8",
    );
    expect(hardening).toContain("_allow_privileged_mutation");
    expect(hardening).toContain("householdos.privileged_mutation");
    expect(hardening).toContain("service_role");
    expect(hardening).toContain("cleanup_test_household_data");
    // Bypass helper must not treat null uid alone as privileged.
    const allowFn = hardening.slice(
      hardening.indexOf("create or replace function public._allow_privileged_mutation"),
      hardening.indexOf("create or replace function public.enforce_payment_rpc_only"),
    );
    expect(allowFn).not.toMatch(/auth\.uid\(\)\s+is\s+null/);
  });
});
