import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { scanSourceForDeadPatterns } from "@/lib/interaction/dead-patterns";

function walk(dir: string, acc: Array<{ path: string; contents: string }> = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "node_modules" || entry === ".next") continue;
      walk(full, acc);
    } else if (/\.(tsx|ts|jsx|js)$/.test(entry)) {
      acc.push({ path: full.replace(/\\/g, "/"), contents: readFileSync(full, "utf8") });
    }
  }
  return acc;
}

describe("interactive dead-pattern scan", () => {
  it("finds no placeholder or empty destinations in app UI", () => {
    const files = [
      ...walk(join(process.cwd(), "src/app")),
      ...walk(join(process.cwd(), "src/components")),
    ];
    const hits = scanSourceForDeadPatterns(files);
    expect(hits, hits.map((h) => `${h.file}:${h.line} ${h.excerpt}`).join("\n")).toEqual([]);
  });
});
