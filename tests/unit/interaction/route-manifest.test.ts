import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { buildRouteManifest } from "@/lib/interaction/route-manifest";

const APP_ROOT = join(process.cwd(), "src/app");

function listPageFiles(dir: string = APP_ROOT): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...listPageFiles(full));
    else if (entry === "page.tsx" || entry === "page.ts") out.push(full);
  }
  return out;
}

function fileToRoute(file: string): string {
  const rel = relative(APP_ROOT, file).replace(/\\/g, "/");
  return (
    "/" +
    rel
      .replace(/\/page\.tsx?$/, "")
      .replace(/^\(.*?\)\//g, "")
      .replace(/\/\([^/]+\)/g, "")
      .replace(/^page\.tsx?$/, "")
  ).replace(/\/+/g, "/") || "/";
}

function hrefToCandidates(href: string): string[] {
  const path = (href.split(/[?#]/, 1)[0] ?? href).replace(/\/$/, "") || "/";
  const withParam = path.replace(
    /\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi,
    "/[id]",
  );
  const household = path.replace(
    /\/app\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i,
    "/app/[householdId]",
  );
  return [path, withParam, household, household.replace(/\/[0-9a-f-]{36}/gi, "/[id]")];
}

describe("route manifest", () => {
  it("resolves every nav, quick-add, and notification destination to a page", () => {
    const pages = new Set(listPageFiles().map(fileToRoute));
    const routes = buildRouteManifest();
    const missing = routes.filter((route) => {
      const candidates = hrefToCandidates(route.href);
      return !candidates.some((candidate) => {
        if (pages.has(candidate) || pages.has(`${candidate}/`)) return true;
        const parts = candidate.split("/").filter(Boolean);
        const generalized = "/" + parts
          .map((part, index) =>
            part.startsWith("[")
              ? part
              : index > 0 && pages.has(
                  "/" +
                    parts
                      .map((p, i) => (i === index ? `[${p}Id]` : p))
                      .join("/"),
                )
                ? `[${part}Id]`
                : part,
          )
          .join("/");
        return [...pages].some((page) => {
          const pageParts = page.split("/").filter(Boolean);
          const candParts = candidate.split("/").filter(Boolean);
          if (pageParts.length !== candParts.length) return false;
          return pageParts.every((part, i) => part === candParts[i] || part.startsWith("["));
        }) || pages.has(generalized);
      });
    });
    expect(missing, missing.map((m) => `${m.id} → ${m.href}`).join("\n")).toEqual([]);
  });
});
