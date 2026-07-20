import { describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

describe("package:source", () => {
  it("archives tracked files without env secrets or build artifacts", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "hos-pkg-"));
    const out = path.join(tmp, "src.tar.gz");
    execSync(`git archive --format=tar.gz --output="${out}" HEAD`, {
      cwd: process.cwd(),
    });
    expect(fs.existsSync(out)).toBe(true);
    const listing = execSync(`tar -tzf "${out}"`, { encoding: "utf8" });
    expect(listing).not.toMatch(/\.env\.local/);
    expect(listing).not.toMatch(/^node_modules\//m);
    expect(listing).not.toMatch(/^\.next\//m);
    expect(listing).toMatch(/package\.json/);
  });
});
